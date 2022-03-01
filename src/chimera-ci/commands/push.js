const { nicePrint, execAsync, printLoaderLine } = require('@solid-js/cli')
const { File, FileFinder, Directory } = require('@solid-js/files')
const { trailing, leading } = require('@solid-js/core')
const path = require('path')
const { buildSSHCommand, prependSSHPass } = require( "@solid-js/cli/dist/Ssh" );
const { oraExec } = require( "@solid-js/cli/dist/Ora" );

// ----------------------------------------------------------------------------- UTILS

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

// -----------------------------------------------------------------------------

const _chimeraKeepVariableName = 'CHIMERA_KEEP'

const _defaultDockerFiles = [
	'docker-compose.chimera.yaml',
	'docker-compose.chimera.yml',
	'docker-compose.yaml',
	'docker-compose.yml',
]

// -----------------------------------------------------------------------------

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
		if ( !(defaultDockerFileIndex in _defaultDockerFiles) )
			nicePrint(`{r/b}Docker compose file not found.`, { code: 4 })
		// Target docker file
		dockerComposeFilePath = _defaultDockerFiles[ defaultDockerFileIndex ]
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
		// Parse volumes to get what to send and what to keep
		if (!service.volumes) continue
		service.volumes.map( volume => {
			// Only mapped volumes
			if ( volume.indexOf(':') === -1 ) return
			const localPart = volume.split(':')[0]
			// Get volumes to send, only when starting with ./
			if ( sendVolumes && localPart.indexOf('./') === 0 )
				options.paths.push( localPart )
			// Get kept volumes
			if ( localPart.indexOf('${'+_chimeraKeepVariableName) !== -1 )
				options.keep.push(
					leading(localPart.split('}')[1], false, '/')
				)
		})
	}

	// Remove all relative start (./)
	// Remove all trailing slashes
	options.paths 	= processPaths( options.paths )
	options.keep 	= processPaths( options.keep )
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
	let projectRoot = trailing(options.projectRoot ? options.projectRoot : `projects/`, true)
	projectRoot += `${options.project}/${options.branch}/`
	const projectKeep = `${projectRoot}keep/`
	const projectTrunk = `${projectRoot}trunk/`
	const relativeChimeraKeep = path.relative(projectTrunk, projectKeep)
	const chimeraProjectTrunk = `${options.remoteChimeraHome}${projectTrunk}`
	const chimeraProjectKeep = `${options.remoteChimeraHome}${projectKeep}`

	// Project prefix for internal network and container identifying
	const projectPrefix = (
		options.branch === 'master' || options.branch === 'main'
		? options.project
		: `${options.project}_${options.branch}`
	)

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
	const buildRsyncCommand = ( filePath, noDelete = false ) => {
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
			if ( !FileFinder.existsSync( f ) ) return null
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
		// http://www.delafond.org/traducmanfr/man/man1/rsync.1.html
		// -r : Recursive
		// -z : Compress
		// REMOVED // -u : Update, override destination file only if its date is not more recent
		// -t : Keep file times
		// REMOVED // -K : --keep-dirlinks This option causes the receiving side to treat a symlink to a directory as though it were a real directory, but only if it matches a real directory from the sender. Without this option, the receiver's symlink would be deleted and replaced with a real directory.
		// -4 : Prefer IPV4
		// --delete : Remove all files in destination that are not present anymore
		// --delete-after : Remove all files in destination that are not present anymore

		let rsyncCommand = [
			`rsync`, `-r -z -t -4`,
			 `${(noDelete || options.noDelete) ? '' : '--delete --delete-after'}`,
			`--exclude '**/.DS_Store'`
		];

		options.dryRun && rsyncCommand.push(`-v --dry-run`);

		// Exclude keep folders
		if ( options.keep ) {
			options.dryRun && console.log('keep', options.keep)
			// rsyncCommand.push( options.keep.map( k => `--exclude '${chimeraProjectKeep}${trailing(k, false)}/**'`).join(' ') )
			rsyncCommand.push( options.keep.map( k => `--exclude '${k}'`).join(' ') )
		}

		// Add exclude
		if ( options.exclude && options.exclude.length > 0 )
			rsyncCommand.push( options.exclude.map(e => `--exclude '${e}'`).join(' ') )

		// Add port through SSH to command if we got a port
		if ( options.port )
			rsyncCommand.push(`-e 'ssh -p ${options.port}'`)

		// Convert file path array to string
		const source = fileList.join(' ')

		// Generate destination command
		const destinationCommand = buildSSHCommand(`mkdir -p ${chimeraProjectTrunk}${destination}`, options)

		// Generate rsync command
		rsyncCommand.push(`${source} ${options.user}@${options.host}:${chimeraProjectTrunk}${destination}`)
		rsyncCommand = rsyncCommand.join(' ')

		// Prepend with sshpass if not using ssh key
		rsyncCommand = prependSSHPass( rsyncCommand, options )

		// Dry run
		if ( options.dryRun ) {
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
			const transferLoader = printLoaderLine(`Sending ${name} ${options.noDelete ? 'without delete' : 'with delete'}`)
			try {
				if ( transferBlock.length === 1 )
					transferLoader(`Skipped ${name}`)
				else {
					transferBlock[1] && await execAsync( transferBlock[1], options.dryRun ? 3 : null )
					transferBlock[2] && await execAsync( transferBlock[2], options.dryRun ? 3 : null )
					transferLoader(`Sent ${name}`)
				}
			}
			catch ( e ) {
				transferLoader(`Cannot send ${name}`)
				fatalError( e )
			}
		}
	}

	// ------------------------------------------------------------------------- EXEC CHIMERA SEQUENCE
	let command

	// ---- STOP CONTAINER
	if (!options.dryRun && !options.noDocker) {
		// Build command
		command = buildSSHCommand(`cd ${options.remoteChimeraHome}; ./chimera-project-stop.sh ${chimeraProjectTrunk}`, options)
		// Exec remote command
		await oraExec(command, {}, {
			text: `Stopping container`,
			successText: `Stopped container`,
			errorText: `Cannot stop container`
		})
	}

	// ---- TRANSFER ROOT FILES
	options.dryRun && console.log(imageFiles)
	await execTransferCommands([
		// Upload root files (no delete)
		buildRsyncCommand( rootFiles, true ),
		// Upload docker image files
		...imageFiles.map( buildRsyncCommand ),
	])

	// ---- SEND PROJECT FILES
	await execTransferCommands(
		options.paths.filter( v => v ).map( buildRsyncCommand )
	);

	// ---- INSTALL CONTAINER
	if (!options.dryRun) {
		// Build command
		const createSymLinks = options.noDocker ? 'symlinks' : 'skip'
		const installArgumentList = [
			//    1            2                3
			projectTrunk, projectKeep, relativeChimeraKeep,
			//       4                  5               6
			dockerComposeFilePath, projectPrefix, createSymLinks,
			// 7, 8, 9 ...
			...options.keep
		]
		const installArguments = installArgumentList.filter(v => v).join(' ')
		command = buildSSHCommand(`cd ${options.remoteChimeraHome}; ./chimera-project-install.sh ${installArguments}`, options);
		// Exec remote command
		await oraExec(command, {}, {
			text: `Installing container`,
			errorText: `Cannot install container`,
			successText: `Container installed`,
		})
	}

	// ---- BUILD CONTAINER
	if (!options.dryRun && !options.noDocker) {
		// Build remote command
		command = buildSSHCommand(`cd ${options.remoteChimeraHome}; ./chimera-project-build.sh ${projectTrunk}`, options)
		// Exec remote command
		await oraExec(command, {}, {
			text: `Building container`,
			errorText: `Cannot build container`,
			successText: `Container built`,
		});
	}

	// ---- AFTER SCRIPTS
	if ( options.afterScripts.length > 0 && !options.dryRun ) {
		// Build remote command
		options.debug && console.log( options.afterScripts )
		command = buildSSHCommand(`cd ${chimeraProjectTrunk}; ${options.afterScripts.join('; ')}`, options)
		// Exec remote command
		const scriptResult = await oraExec(command, {}, {
			text: `Executing after scripts`,
			errorText: `After scripts failed`,
			successText: `After scripts succeeded`,
		});
		scriptResult.stdout && console.log( scriptResult.stdout );
		scriptResult.stderr && console.log( scriptResult.stderr );
	}

	// ---- PATCH RW RIGHTS
	if (!options.dryRun) {
		command = buildSSHCommand(`cd ${options.remoteChimeraHome}; ./chimera-project-patch-rights.sh ${projectRoot}`, options)
		await oraExec(command, {}, {
			text: `Patching R/W rights`,
			errorText: `Patching R/W right failed`,
			successText: `R/W rights patched`,
		});
	}

	// ---- START CONTAINER
	if (!options.dryRun && !options.noDocker) {
		command = buildSSHCommand(`cd ${options.remoteChimeraHome}; ./chimera-project-start.sh ${projectTrunk}`, options)
		await oraExec(command, {}, {
			text: `Starting container ${projectPrefix}`,
			errorText: `Cannot start container`,
			successText: `Started container ${projectPrefix}`,
		});
	}
}

// ----------------------------------------------------------------------------- EXPORTS

module.exports = {
	chimeraPush,
}