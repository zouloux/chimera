const path = require( "path" );
const { onProcessKilled } = require( "@solid-js/cli" );
const { createTask } = require( "@solid-js/cli" );
const { delay } = require( "@solid-js/core" );
const { printLoaderLine } = require( "@solid-js/cli" );
const { execAsync } = require( "@solid-js/cli" );
const { findProject } = require( "./_common" );
const { nicePrint } = require( "@solid-js/cli" );
const { File, FileFinder } = require('@solid-js/files')

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

	let loaderLine = printLoaderLine(`Killing current ${project.config.project}`)
	try {
		await execAsync(`docker-compose -f ${dockerFile} down --remove-orphans`, 0, { cwd })
	} catch (e) {
		loaderLine(`Error while killing docker project`)
		console.error( e )
		process.exit( 1 )
	}
	loaderLine(`Killed project`)

	loaderLine = printLoaderLine(`Building ${project.config.project}`)
	try {
		await execAsync(`docker-compose -f ${dockerFile} build`, 0, { cwd })
	} catch (e) {
		loaderLine(`Error while building docker project`)
		console.error( e )
		process.exit( 1 )
	}
	loaderLine(`Docker project built`);

	// Exec async but do not await to listen process kills
	execAsync(`docker-compose -f ${dockerFile} up --no-build --abort-on-container-exit --force-recreate`, 3, {
		cwd,
		detached: false
	}).catch( e => {} ) // catch to avoid node uncaught promise errors

	onProcessKilled( async () => {
		await delay(1)
		const closeLine = printLoaderLine(`Stopping  ${project.config.project}`)
		try {
			await execAsync(`docker-compose -f ${dockerFile} down --remove-orphans`, 0, { cwd })
		}
		catch ( e ) {
			console.error(e);
		}
		closeLine(`${project.config.project} stopped.`);
	})

	if ( cliOptions.open || cliOptions.O ) {
		await delay(2)
		await open()
	}
}

// ----------------------------------------------------------------------------- OPEN

async function open ()
{
	const project = await findProject()

	let projectName = project.config.project

	try {
		// Read dot env in project root and try to guess if declared
		// as default or with a name
		const dotEnv = new File(path.join(project.root, '.env'))
		await dotEnv.load()
		const data = dotEnv.dotEnv()
		projectName = data.COMPOSE_HOSTNAME ?? 'default'
	}
	catch (e) {}

	let url;
	if ( projectName.trim().toLowerCase() === 'default' ) {
		// Get hostname and halt if not possible
		let hostname = await execAsync('hostname')
		hostname = hostname.trim()
		url = `https://${hostname}.local`
	}
	else {
		url = `https://${projectName}.localhost`;
	}

	nicePrint(`{d}Opening {b/w}${url}`)
	require('open')(url)
}

// ----------------------------------------------------------------------------- EXEC

async function exec ()
{
	// Find project
	const project = await findProject()
	// const container = await askContainer( false, project.config.project, true )
	const projectName = project.config.project
	const containerID = `project_${project.config.project}`

	// Connect to a piped shell
	const connectTask = createTask(`Connecting to ${projectName}`)
	const command = `docker exec -i ${containerID} /bin/bash`
	const childProcess = require('child_process').exec(command, {
		env: process.env,
		cwd: process.cwd()
	});

	// Pipe stdout
	let hadErrorWhileLoading = false
	childProcess.stdout.on('data', data => {
		process.stdout.write(
			// Style command invite
			data.indexOf('> ') === 0
			? nicePrint(`{b/w}${data}`, {
				output: 'return', newLine: false
			})
			// Regular data
			: data
		)
	})

	// Detect connection errors
	childProcess.stderr.once('data', data => { hadErrorWhileLoading = data });

	// Show a command input invite (> /root :)
	const printShellInvite = () => childProcess.stdin.write(`echo "\> $(pwd) $ "\n`)

	// Pipe stdin to child process and show invite after each command
	process.stdin.on('data', data => {
		childProcess.stdin.write(data)
		if (data.toString() === 'exit\n')
			process.exit();
		printShellInvite();
	});

	// Wait connection and detect errors
	await delay(.2)
	if (hadErrorWhileLoading) {
		connectTask.error(`Unable to connect to ${projectName}`)
		console.error(nicePrint(`{b/r}${hadErrorWhileLoading}`, {output: 'return'}))
		process.exit(2)
	}

	// Pipe errors
	childProcess.stderr.on('data', data => {
		process.stderr.write(nicePrint(`{b/r}${data}`, { output: 'return' }))
	});

	// Connection success
	connectTask.success(`Connected to ${projectName}`)
	printShellInvite();
}

// ----------------------------------------------------------------------------- SYNC

async function sync ()
{
	const { projectSync } = require('./project-sync')
	await projectSync();
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	start,
	open,
	exec,
	sync,
}