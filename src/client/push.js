const { nicePrint, execAsync, printLoaderLine } = require('@solid-js/cli')
const { File, FileFinder, Directory } = require('@solid-js/files')
const { trailing } = require('@solid-js/core')
const path = require('path')

function fatalError ( e = null, code = 1 ) {
	e && console.error( e )
	process.exit( code )
}

module.exports.chimeraPush = async function( options )
{
	// -------------------------------------------------------------------------

	// Target docker compose for chimera
	let dockerComposeFilePath = options.dockerFile
	if ( File.find(dockerComposeFilePath).length === 0 )
		dockerComposeFilePath = 'docker-compose.yaml'

	// If default docker-compose not found
	if ( File.find(dockerComposeFilePath).length === 0 )
		nicePrint(`{r/b}Docker compose file {b}${options.dockerFile}{/r} or {b}${dockerComposeFilePath}{/r} not found.`, { code: 4 })

	// Files to transfer
	const rootFiles = [ options.env, dockerComposeFilePath ]
	const imageFiles = [];

	// Check dot env
	if ( File.find(options.env).length === 0 )
		nicePrint(`{r/b}Env file {b}${options.env}{/r} not found.`, { code: 5 })

	// Load docker compose
	const dockerComposeFile = new File( dockerComposeFilePath )
	if ( !dockerComposeFile.exists() )
		nicePrint(`{r/b}Docker file {b}${dockerComposeFilePath} not found`, { code: 6 } )
	dockerComposeFile.load()
	const dockerComposeContent = dockerComposeFile.yaml()

	// Get docker compose services images
	Object.keys( dockerComposeContent.services ).map( serviceName => {
		const service = dockerComposeContent.services[ serviceName ]
		if ( !('build' in service) ) return
		if ( Directory.find( service.build ).length === 0 )
			nicePrint(`
				{r/n}Cannot find image {b}${service.build}{/r} in docker service {b}${serviceName}
			`, { code: 7 })
		imageFiles.push( service.build )
	})

	// TODO : Verbose
	// console.log( options );
	// console.log( rootFiles )
	// console.log( options.paths );

	// -------------------------------------------------------------------------

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

	// Path to project and binaries
	const chimeraHome = `~/chimera/`
	const projectRoot = `projects/${options.project}/${options.branch}/`
	const projectShared = `${projectRoot}shared/`
	const projectTrunk = `${projectRoot}trunk/`
	const chimeraProjectTrunk = `${chimeraHome}${projectTrunk}`

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
	const buildSSHCommand = ( sshCommand ) => `ssh ${port ? `-p ${port}` : ''} -o StrictHostKeyChecking=no ${options.host} "${sshCommand}"`

	// Build rsync command to synchronise files and directories
	const buildRsyncCommand = ( filePath ) => {
		// Destination directory to be pre-created
		let destination = ''

		// If several files are sent, always start from root
		if ( Array.isArray(filePath) )
			filePath = filePath.join(' ')

		// If file does not exists, skip it (register name but no command)
		else if ( FileFinder.list( filePath ).length === 0 )
			return [ filePath ]

			// Only one file or directory
		// Target parent directory to prepare and create before transfer
		else
			destination = path.relative( process.cwd(), path.resolve(filePath, '../') )

		// Generate rsync command
		// FIXME : Publish .bin files ?
		// TODO : Add exclude option to config
		const rsyncCommand = [`rsync`, `-r -z -u -t --delete --exclude '**/.DS_Store'`];
		// command.push(`-v --dry-run`);

		// Add port through SSH to command if we got a port
		if ( port )
			rsyncCommand.push(`-e 'ssh -p ${port}'`)

		// Source file without trailing slash to avoid wrong destination
		const source = trailing(filePath, false, '/')

		// Generate rsync command
		rsyncCommand.push(`${source} ${options.host}:${chimeraProjectTrunk}${destination}`)

		return [
			filePath,
			// Prepare destination parent directory
			destination && buildSSHCommand(`mkdir -p ${chimeraProjectTrunk}${destination}`),
			// Then, generated rsync command
			rsyncCommand.join(' ')
		]
	}

	// -------------------------------------------------------------------------

	// List all transfer commands
	const transferCommands = [
		// Upload root files
		buildRsyncCommand( rootFiles ),
		// Upload docker image files
		...imageFiles.map( buildRsyncCommand ),
		// All options files to send
		...options.paths.filter( v => v ).map( buildRsyncCommand )
	]

	// -------------------------------------------------------------------------

	// setLoaderScope( options.project )

	// ---- STOP CONTAINER
	const stopLoader = printLoaderLine(`Stopping container`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-stop.sh ${chimeraProjectTrunk}`) )
	}
	catch (e) {
		stopLoader(`Cannot stop container`, 'error')
		fatalError( e )
	}
	stopLoader(`Stopped container`)

	// ---- SEND FILES
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

	// ---- INSTALL CONTAINER
	// TODO -> Create symlinks persistent folders
	const installLoader = printLoaderLine(`Install container`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-install.sh ${projectTrunk} ${projectShared} ${dockerComposeFilePath} ${projectPrefix}`))
	}
	catch (e) {
		installLoader(`Cannot install container`, 'error')
		fatalError( e )
	}
	installLoader(`Container installed`)

	// ---- BUILD CONTAINER
	const buildLoader = printLoaderLine(`Building container`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-build.sh ${projectTrunk}`))
	}
	catch (e) {
		buildLoader(`Cannot build container`, 'error')
		fatalError( e )
	}
	buildLoader(`Container built`)

	// ---- AFTER SCRIPTS
	if ( options.afterScripts.length > 0 ) {
		const afterScriptsLoader = printLoaderLine(`Executing after scripts`)
		options.debug && console.log( options.afterScripts )
		try {
			await execAsync( buildSSHCommand(`cd ${chimeraProjectTrunk}; ${options.afterScripts.join('; ')}`), true )
		}
		catch (e) {
			afterScriptsLoader(`After scripts failed`, 'error')
			fatalError( e )
		}
		afterScriptsLoader(`After scripts succeeded`)
	}

	// ---- PATCH RW RIGHTS
	const patchRightsLoader = printLoaderLine(`Patching R/W rights`)
	options.debug && console.log( options.afterScripts )
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-patch-rights.sh ${projectTrunk}`), true )
	}
	catch (e) {
		patchRightsLoader(`Patching R/W right failed`, 'error')
		fatalError( e )
	}
	patchRightsLoader(`R/W rights patched`)

	// ---- START CONTAINER
	const startedLoader = printLoaderLine(`Starting container ${projectPrefix}`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-start.sh ${projectTrunk}`))
	}
	catch (e) {
		startedLoader(`Cannot start container`, 'error')
		fatalError( e )
	}
	startedLoader(`Started container ${projectPrefix}`, 'success')
}
