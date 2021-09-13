const { nicePrint, execAsync, printLoaderLine } = require('@solid-js/cli')
const { File, FileFinder, Directory } = require('@solid-js/files')
const { trailing, leading } = require('@solid-js/core')
const path = require('path')

function fatalError ( e = null, code = 1 ) {
	e && console.error( e )
	process.exit( code )
}

function processPaths ( pathsToProcess ) {
	return pathsToProcess.map( p => {
		p = trailing(p, false, '/')
		if ( p.indexOf('./') === 0 )
			p = p.substr(2, p.length)
		return p
	})
}

const chimeraKeepVariableName = 'CHIMERA_KEEP'

const defaultDockerFiles = [
	'docker-compose.chimera.yaml',
	'docker-compose.chimera.yml',
	'docker-compose.yaml',
	'docker-compose.yml',
]

async function chimeraPush ( options )
{
	// ------------------------------------------------------------------------- PREPARE OPTIONS

	// Target docker compose for chimera
	let dockerComposeFilePath = options.dockerFile

	// Check if specified docker file exists
	if ( dockerComposeFilePath && !FileFinder.existsSync(dockerComposeFilePath) )
		nicePrint(`{r/b}Specified docker compose file {b}${dockerComposeFilePath}{/r} not found.`, { code: 4 })

	// Get first default docker file available
	let defaultDockerFileIndex = 0
	do {
		// Default docker file not found
		if ( !(defaultDockerFileIndex in defaultDockerFiles) )
			nicePrint(`{r/b}Docker compose file not found.`, { code: 4 })
		// Target docker file
		dockerComposeFilePath = defaultDockerFiles[ defaultDockerFileIndex ]
		defaultDockerFileIndex ++
	}
	while ( !FileFinder.existsSync(dockerComposeFilePath) )

	// Files to transfer
	const rootFiles = [ options.env, dockerComposeFilePath ]
	const imageFiles = [];

	// Check dot env
	if ( (await File.find(options.env)).length === 0 )
		nicePrint(`{r/b}Env file {b}${options.env}{/r} not found.`, { code: 5 })

	// Load docker compose
	const dockerComposeFile = new File( dockerComposeFilePath )
	let dockerComposeContent
	try {
		await dockerComposeFile.load()
		dockerComposeContent = dockerComposeFile.yaml()
	}
	catch (e) {
		nicePrint(`{r/b}Invalid docker file {b}${dockerComposeFilePath}{/r}.`, { code: 5 })
	}

	// Only send volumes automatically if path is not set
	const sendVolumes = !(options.paths && options.paths.length > 0)

	// Browse docker services
	for ( const serviceName of Object.keys( dockerComposeContent.services ) ) {
		const service = dockerComposeContent.services[ serviceName ]
		// Get docker compose services images to build
		if ( 'build' in service ) {
			// Get image path
			let imagePath;
			if ( typeof service.build === 'string' )
				imagePath = service.build;
			else if ( 'context' in service.build && typeof service.build.context === 'string' )
				imagePath = service.build.context
			// Check if directory exists and add
			if ( !imagePath || (await Directory.find( imagePath )).length === 0 )
				nicePrint(`
					{r/n}Cannot find image {b}${imagePath}{/r} in docker service {b}${serviceName}
				`, { code: 7 })
			imageFiles.push( imagePath )
		}
		// Do not send volumes if have some paths defined
		if (!sendVolumes) return
		// Parse volumes to get what to send and what to keep
		if (!service.volumes) return
		service.volumes.map( volume => {
			// Only mapped volumes
			if ( volume.indexOf(':') === -1 ) return
			const localPart = volume.split(':')[0]
			// Get volumes to send, only when starting with ./
			if ( localPart.indexOf('./') === 0 )
				options.paths.push( localPart )
			// Get kept volumes
			if ( localPart.indexOf('${'+chimeraKeepVariableName) !== -1 )
				options.keep.push(
					leading(localPart.split('}')[1], false, '/')
				)
		})
	}

	// Remove all relative start (./)
	// Remove all trailing slashes
	options.paths = processPaths( options.paths )
	options.keep = processPaths( options.keep )
	options.exclude = processPaths( options.exclude )

	// Remove duplicates
	options.paths 			= [...new Set(options.paths)]
	options.keep 			= [...new Set(options.keep)]
	options.afterScripts 	= [...new Set(options.afterScripts)]
	options.exclude 		= [...new Set(options.exclude)]

	// Show config object and halt
	if ( options.showConfig ) {
		console.log( options )
		process.exit()
	}

	// ------------------------------------------------------------------------- BUILD COMMANDS

	// Path to project and binaries
	const remoteChimeraHome = `~/chimera/`
	const projectRoot = `projects/${options.project}/${options.branch}/`
	const projectKeep = `${projectRoot}keep/`
	const projectTrunk = `${projectRoot}trunk/`
	const relativeChimeraKeep = path.relative(projectTrunk, projectKeep)
	const chimeraProjectTrunk = `${remoteChimeraHome}${projectTrunk}`

	// Project prefix for internal network and container identifying
	const projectPrefix = (
		options.branch === 'master'
		? options.project
		: `${options.project}_${options.branch}`
	)

	// Split port from chimera host to a separated variable
	let port
	if ( options.host.indexOf(':') !== -1 ) {
		const split = options.host.split(':')
		options.host = split[0]
		port = split[1]
	}

	// Build a command to be executed on Chimera server
	const buildSSHCommand = ( sshCommand ) => {
		const command = `ssh ${port ? `-p ${port}` : ''} -o StrictHostKeyChecking=no ${options.host} "${sshCommand}"`
		options.debug && console.log('> '+command)
		return command
	}

	/**
	 * http://www.delafond.org/traducmanfr/man/man1/rsync.1.html
	 * -a : Mode archive (va copier les liens symboliques sans les résoudres)
	 * 		-> -rlptgoD
	 * -r : Recursif
	 * -v : Verbose / -q : Quiet
	 * -z : Compresser
	 * -u : Mode differentiel, ne change que les fichiers modifiés
	 * -t : Préserve les dates
	 * --progress
	 * --stats
	 */

	// Build rsync command to synchronise files and directories
	const buildRsyncCommand = ( filePath ) => {
		// Destination directory to be pre-created
		let destination = ''

		// Force filePath to be an array
		if ( !Array.isArray(filePath) )
			filePath = [ filePath ]

		// Convert all file paths
		const fileList = filePath.map( f => {
			// File without trailing slash to avoid wrong destination
			f = trailing(f, false, '/')
			// Remove file from list if does not exists
			// FIXME : strict mode which warn or halt ?
			if ( FileFinder.existsSync( f ) ) return null
			// Resolve file path relative to project root
			f = path.relative( options.cwd, path.resolve(f) )
			// Compute destination directory, only compatible with filePath with 1 path
			destination = path.relative( options.cwd, path.join(f, '../') )
			return f
		}).filter( f => f)

		// If file does not exists, skip it (register name but no command)
		if ( fileList.length === 0 )
			return [ filePath ]

		// Generate rsync command
		// FIXME : Publish .bin files ?
		let rsyncCommand = [`rsync`, `-r -z -u -t --delete --exclude '**/.DS_Store'`];

		options.dryRun && rsyncCommand.push(`-v --dry-run`);

		// Add exclude
		if ( options.exclude && options.exclude.length > 0 )
			rsyncCommand.push( options.exclude.map(e => `--exclude '${e}'`).join(' ') )

		// Add port through SSH to command if we got a port
		if ( port )
			rsyncCommand.push(`-e 'ssh -p ${port}'`)

		// Convert file path array to string
		const source = fileList.join(' ')

		// Generate destination command
		const destinationCommand = destination && buildSSHCommand(`mkdir -p ${chimeraProjectTrunk}${destination}`)

		// Generate rsync command
		rsyncCommand.push(`${source} ${options.host}:${chimeraProjectTrunk}${destination}`)
		rsyncCommand = rsyncCommand.join(' ')

		if (options.dryRun) {
			console.log(destinationCommand);
			console.log(rsyncCommand);
		}

		return [ source, destinationCommand, rsyncCommand ]
	}

	// ------------------------------------------------------------------------- SEND FILES

	async function execTransferCommands ( transferCommands ) {
		for ( const transferBlock of transferCommands ) {
			const name = transferBlock[0]
			options.debug && console.log(transferBlock);
			const transferLoader = printLoaderLine(`Sending ${name}`)
			try {
				if ( transferBlock.length === 1 )
					transferLoader(`Skipped ${name}`)
				else {
					transferBlock[1] && await execAsync( transferBlock[1] )
					transferBlock[2] && await execAsync( transferBlock[2] )
					transferLoader(`Sent ${name}`)
				}
			}
			catch ( e ) {
				transferLoader(`Cannot send ${name}`)
				fatalError( e )
			}
		}
	}

	// ------------------------------------------------------------------------- CHIMERA SEQUENCE

	// ---- STOP CONTAINER
	if (!options.dryRun) {
		const stopLoader = printLoaderLine(`Stopping container`)
		try {
			await execAsync( buildSSHCommand(`cd ${remoteChimeraHome}; ./chimera-project-stop.sh ${chimeraProjectTrunk}`) )
		}
		catch (e) {
			stopLoader(`Cannot stop container`, 'error')
			fatalError( e )
		}
		stopLoader(`Stopped container`)
	}

	// ---- TRANSFER ROOT FILES
	options.dryRun && console.log(imageFiles)
	await execTransferCommands([
		// Upload root files
		buildRsyncCommand( rootFiles ),
		// Upload docker image files
		...imageFiles.map( buildRsyncCommand ),
	])

	// ---- SEND PROJECT FILES
	await execTransferCommands(
		options.paths.filter( v => v ).map( buildRsyncCommand )
	);

	// ---- INSTALL CONTAINER
	if (!options.dryRun) {
		const installLoader = printLoaderLine(`Installing container`)
		try {
			const installArgumentList = [
				//    1            2                3                     4                  5
				projectTrunk, projectKeep, relativeChimeraKeep, dockerComposeFilePath, projectPrefix,
				// 6, 7, 8 ...
				...options.keep
			]
			const installArguments = installArgumentList.filter(v => v).join(' ')
			await execAsync( buildSSHCommand(`cd ${remoteChimeraHome}; ./chimera-project-install.sh ${installArguments}`))
		}
		catch (e) {
			installLoader(`Cannot install container`, 'error')
			fatalError( e )
		}
		installLoader(`Container installed`)
	}

	// ---- BUILD CONTAINER
	if (!options.dryRun) {
		const buildLoader = printLoaderLine(`Building container`)
		try {
			await execAsync( buildSSHCommand(`cd ${remoteChimeraHome}; ./chimera-project-build.sh ${projectTrunk}`))
		}
		catch (e) {
			buildLoader(`Cannot build container`, 'error')
			fatalError( e )
		}
		buildLoader(`Container built`)
	}

	// ---- AFTER SCRIPTS
	if ( options.afterScripts.length > 0 && !options.dryRun ) {
		const afterScriptsLoader = printLoaderLine(`Executing after scripts`)
		options.debug && console.log( options.afterScripts )
		try {
			await execAsync( buildSSHCommand(`cd ${chimeraProjectTrunk}; ${options.afterScripts.join('; ')}`), 'out' )
		}
		catch (e) {
			afterScriptsLoader(`After scripts failed`, 'error')
			fatalError( e )
		}
		afterScriptsLoader(`After scripts succeeded`)
	}

	// ---- PATCH RW RIGHTS
	if (!options.dryRun) {
		const patchRightsLoader = printLoaderLine(`Patching R/W rights`)
		options.debug && console.log( options.afterScripts )
		try {
			await execAsync( buildSSHCommand(`cd ${remoteChimeraHome}; ./chimera-project-patch-rights.sh ${projectRoot}`), true )
		}
		catch (e) {
			patchRightsLoader(`Patching R/W right failed`, 'error')
			fatalError( e )
		}
		patchRightsLoader(`R/W rights patched`)
	}

	// ---- START CONTAINER
	if (!options.dryRun) {
		const startedLoader = printLoaderLine(`Starting container ${projectPrefix}`)
		try {
			await execAsync( buildSSHCommand(`cd ${remoteChimeraHome}; ./chimera-project-start.sh ${projectTrunk}`))
		}
		catch (e) {
			startedLoader(`Cannot start container`, 'error')
			fatalError( e )
		}
		startedLoader(`Started container ${projectPrefix}`, 'success')
	}
}


module.exports = {
	chimeraPush,
}