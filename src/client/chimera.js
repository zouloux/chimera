#!/usr/bin/env node

const { CLICommands, nicePrint, execAsync, printLoaderLine, setLoaderScope } = require('@solid-js/cli')
const { File, FileFinder, Directory } = require('@solid-js/files')
const path = require('path')

// ----------------------------------------------------------------------------- RESEARCH

// V1.0 MVP
// - client
// 		chimera push
// - scripts
// 		keep folders between pushes
// - server
// 		UI - Connect with http
// 		API - Exec API Commands with an api key
// 		API - start / stop / delete / list / stats

// V1.1
// -> Common folders between branches
// -> Common services between branches (ex : 1 mysql)
// chimera stop --branch
// chimera delete --branch

// V1.2+
// -> Images repo for projects ( node server image / lamp image ... )
// -> Images repo for useful services ( preconfigured gitlab for ex )
// chimera download --branch --volume

// -> Build au niveau du CI (build local) ?
// + Plus pro, plus clean
// + Permet de swap l'image en 2 sec
// - Besoin d'un repo d'images
// - Transfert de fichier + fat

// -> Build au niveau de Chimera (build distant) ?
// - Moins pro
// - Swap plus long car pendant le build, l'image ne tourne pas
// + Le dossier docker peut-être SHA pour éviter de re-build
// + Moins de data à transfert (on transfert pas l'image mais son fichier texte)
// + Plus facile à implémenter
// + Pas de repo d'images à gérer

// ----------------------------------------------------------------------------- CLI COMMANDS

CLICommands.add('push', async (cliArguments, cliOptions, commandName) => {
	//console.log('PUSH', cliArguments[0], cliOptions.host, cliOptions.branch)

	// Default options
	let options = {
		dockerFile: 'chimera-docker-compose.yaml'
	}

	// Load options from .chimera json5 file
	const chimeraConfigFile = new File('.chimera')
	if ( chimeraConfigFile.exists() ) {
		chimeraConfigFile.load()
		try {
			const configOptions = chimeraConfigFile.json5()
			// Remove options which are only for cli
			delete configOptions.branch
			delete configOptions.env
			options = { ...options, ...configOptions }
		}
		catch (e) {
			console.error( e )
			nicePrint(`{r/b}Error while parsing {b}.chimera{/r} file.`, { code: 1 })
		}
	}

	// Override with cli options and arguments
	if ( cliArguments[0] )
		options.project = cliArguments[0]
	else if ( cliOptions.project )
		options.project = cliOptions.project
	if ( cliOptions.host )
		options.host = cliOptions.host
	if ( cliOptions.branch )
		options.branch = cliOptions.branch
	if ( cliOptions.path )
		options.paths = (
			Array.isArray( cliOptions.path )
			? cliOptions.path : [ cliOptions.path ]
		)
	if ( cliOptions.dockerFile )
		options.dockerFile = cliOptions.dockerFile

	options.env = (
		cliOptions.env.indexOf('.') === 0
		? cliOptions.env
		: '.env.' + cliOptions.env
	)

	// Default parameters
	if ( !options.branch )
		options.branch = 'master'

	// Check parameters
	!options.host && nicePrint(`
		{r/b}Missing {b}host{/r} parameters.
		Specify it with {b}--host{/} option, or set it in {b}.chimera{/}
	`, { code: 2 })
	!options.project && nicePrint(`
		{r/b}Missing {b}project{/r} parameters.
		Specify it with first argument like {b}chimera push $project{/}, or as {b}--project{/}, or set it in {b}.chimera{/}
	`, { code: 3 })
	!options.paths && nicePrint(`
		{r/b}Missing {b}paths{/r} parameters.
		Specify it with {b}--path{/} option
		Or add a {b}paths{/} array to {b}.chimera{/}
	`, { code: 3 })

	await chimeraPush( options )
}, {
	host	: null,
	project	: null,
	env		: '.env',
	branch	: 'master'
})

CLICommands.start( ( commandName, error, cliArguments, cliOptions, results ) => {
	if ( !commandName || results.length === 0 ) {
		nicePrint(`
			{r/b}Missing command name.
			Available commands :
			- push
		`, { code: 3 })
	}
});

// ----------------------------------------------------------------------------- CHIMERA PUSH

async function chimeraPush ( options )
{
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

	// console.log( options );
	// console.log( rootFiles )
	// console.log( options.paths );

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
	const projectID = `projects/${options.project}/${options.branch}/`
	const chimeraProjectPath = `${chimeraHome}${projectID}`

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

	const buildSSHCommand = ( sshCommand ) => `ssh ${port ? `-p ${port}` : ''} ${options.host} "${sshCommand}"`

	const buildSSHMkdirCommand = ( subDirPath ) => {
		return buildSSHCommand(`mkdir -p ${chimeraProjectPath}${subDirPath}`)
	}

	const buildRsyncCommand = ( filePath ) => {
		let root = ''
		if ( Array.isArray(filePath) )
			filePath = filePath.join(' ')
		else {
			if ( FileFinder.list( filePath ).length === 0 )
				return [ filePath ]
			root = path.relative( process.cwd(), path.resolve(filePath, '../') )
		}
		// FIXME : Publish .bin files ?
		const command = [`rsync`, `-r -z -u -t`];
		if ( port )
			command.push(`-e 'ssh -p ${port}'`)
		// command.push(`-v --dry-run`);
		command.push(`${filePath} ${options.host}:${chimeraProjectPath}${root}`)
		return [ filePath, buildSSHMkdirCommand(root), command.join(' ') ]
	}

	const transferCommands = [
		buildRsyncCommand(rootFiles ),
		...imageFiles.map( buildRsyncCommand ),
		...options.paths.map( buildRsyncCommand )
	]

	function fatalError ( e = null, code = 1 ) {
		e && console.error( e )
		process.exit( code )
	}

	// setLoaderScope( options.project )

	// ---- STOP CONTAINER
	const stopLoader = printLoaderLine(`Stopping container`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-stop.sh ${projectID}`) )
	}
	catch (e) {
		stopLoader(`Cannot stop container`, 'error')
		fatalError( e )
	}
	stopLoader(`Stopped container`)

	// ---- SEND FILES
	for ( const transferBlock of transferCommands ) {
		const name = transferBlock[0]
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
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-install.sh ${projectID} ${dockerComposeFilePath} ${projectPrefix}`))
	}
	catch (e) {
		installLoader(`Cannot install container`, 'error')
		fatalError( e )
	}
	installLoader(`Container installed`)

	// ---- BUILD CONTAINER
	const buildLoader = printLoaderLine(`Building container`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-build.sh ${projectID}`))
	}
	catch (e) {
		buildLoader(`Cannot build container`, 'error')
		fatalError( e )
	}
	buildLoader(`Built container`)

	// ---- START CONTAINER
	const startedLoader = printLoaderLine(`Starting container ${projectPrefix}`)
	try {
		await execAsync( buildSSHCommand(`cd ${chimeraHome}; ./chimera-project-start.sh ${projectID}`))
	}
	catch (e) {
		startedLoader(`Cannot start container`, 'error')
		fatalError( e )
	}
	startedLoader(`Started container ${projectPrefix}`, 'success')
}
