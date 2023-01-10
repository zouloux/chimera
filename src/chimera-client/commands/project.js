const path = require( "path" );
const { printLoaderLine, askList } = require( "@solid-js/cli" );
const { execAsync } = require( "@solid-js/cli" );
const { findProject } = require( "./_common" );
const { nicePrint } = require( "@solid-js/cli" );
const { FileFinder } = require('@solid-js/files')
const { delay } = require( "@solid-js/core" );

const defaultDockerFiles = [
	'docker-compose.chimera.yaml',
	'docker-compose.chimera.yml',
	'docker-compose.yaml',
	'docker-compose.yml',
]

// ----------------------------------------------------------------------------- UTILS

async function getDockerFile ( root )
{
	let dockerComposeFilePath
	// Get first default docker file available
	let defaultDockerFileIndex = 0
	do {
		// Default docker file not found
		if ( !(defaultDockerFileIndex in defaultDockerFiles) )
			nicePrint(`{r/b}Docker compose file not found.`, { code: 4 })
		// Target docker file
		dockerComposeFilePath = path.resolve(
			path.join(root, defaultDockerFiles[ defaultDockerFileIndex ])
		)
		defaultDockerFileIndex ++
	}
	while ( !await FileFinder.exists(dockerComposeFilePath) )
	return dockerComposeFilePath
}

// ----------------------------------------------------------------------------- START

async function start ( cliArguments, cliOptions )
{
	const project = await findProject()
	const cwd = project.root
	const dockerFile = await getDockerFile( project.root )

	await stop(cliArguments, cliOptions, project)

	// Build
	let loaderLine = printLoaderLine(`Building ${project.config.project}`)
	try {
		const command = `docker-compose -f ${dockerFile} build`
		require("child_process").execSync( command, { stdio: 'inherit', cwd })
	} catch (e) {
		loaderLine(`Error while building docker project`)
		console.error( e )
		process.exit( 1 )
	}
	loaderLine(`Docker project built`);

	// Open browser if needed
	if ( cliOptions.open || cliOptions.O )
		await open( false )

	// Start project in sync and sigkill
	const command = `docker-compose -f ${dockerFile} up --no-build --abort-on-container-exit --force-recreate --remove-orphans`
	try {
		require("child_process").execSync( command, { stdio: 'inherit', cwd, killSignal: "SIGKILL" })
	}
	catch (e) {}
}

// ----------------------------------------------------------------------------- STOP

async function stop ( cliArguments, cliOptions, project = null )
{
	if (!project)
		project = await findProject()
	const cwd = project.root
	const dockerFile = await getDockerFile( project.root )

	let loaderLine = printLoaderLine(`Stopping current ${project.config.project}`)
	try {
		await execAsync(`docker-compose -f ${dockerFile} down --remove-orphans -t 0`, 0, { cwd })
	} catch (e) {
		loaderLine(`Error while stopping docker project`)
		console.error( e )
		process.exit( 1 )
	}
	loaderLine(`Stopped project`)
}

// ----------------------------------------------------------------------------- ATTACH

async function attach ( cliArguments, cliOptions )
{
	const project = await findProject()
	const cwd = project.root
	const dockerFile = await getDockerFile( project.root )

	// Exec async but do not await to listen process kills
	execAsync(`docker logs --follow project_${project.config.project}`, 3, {
		detached: false
	}).catch( e => {} ) // catch to avoid node uncaught promise errors
}

// ----------------------------------------------------------------------------- OPEN

async function open ( ask = true )
{
	const project = await findProject()
	let projectName = project.config.project

	const endpoints = [
		`https://${projectName}.ssl.localhost`,
		`http://${projectName}.localhost`,
		`http://localhost`
	]

	let index = 0;
	if ( ask ) {
		const r = await askList("Which endpoint to open ?", [
			`[SSL]		${endpoints[0]}`,
			`[HTTP]	${endpoints[1]}`,
			'[DEFAULT]	${endpoints[2]}',
		])
		index = r[0]
	}

	const url = endpoints[ index ]
	nicePrint(`{d}Opening {b/w}${url}`)
	require('open')(url)
}

// ----------------------------------------------------------------------------- EXEC

async function exec ( cliArguments )
{
	// Find project
	const project = await findProject()
	const projectName = project.config.project
	const containerID = `project_${project.config.project}`
	const command = (
		// Exec with a command which was in argument
		1 in cliArguments
		? `docker exec -i ${containerID} ${cliArguments[1]}`
		// Open a new shell
		: `docker exec -it ${containerID} /bin/bash`
	)
	require("child_process").execSync( command, { stdio: 'inherit' })
	nicePrint(`{d}Closed {b/w}${projectName}{/d} shell.`)
}

// ----------------------------------------------------------------------------- SYNC

async function sync ()
{
	const { projectSync } = require('./project-sync')
	await projectSync();
}

// ----------------------------------------------------------------------------- TUNNEL

async function tunnel ()
{
	// Find project
	const project = await findProject()
	const projectName = project.config.project

	let startingLine = printLoaderLine(`Starting local tunnel ...`);

	// Generate name
	const computerHostname = require('os').hostname();
	let computerHash = require('crypto').createHash('md5').update(computerHostname).digest('hex')
	computerHash = computerHash.substr(16, 8);
	let subdomain = projectName + '--' + computerHash

	this._localTunnelInstance = await require('localtunnel')({
		port: 80,
		subdomain
	})

	this._localTunnelInstance.on('close', () => {
		startingLine
		? startingLine(`Unable to open local tunnel`, 'error')
		: nicePrint('{o}Local tunnel closed.');
		this._localTunnelInstance = null;
	})

	await delay(.1);
	const { url } = this._localTunnelInstance
	startingLine(`Local tunnel opened at {b/u}${url}`)
	startingLine = null;

	const qrTerminal = require('qrcode-terminal');
	qrTerminal.setErrorLevel('Q');
	qrTerminal.generate(url, { small: true });
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	start,
	stop,
	attach,
	open,
	exec,
	sync,
	tunnel
}