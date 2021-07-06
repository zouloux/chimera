const path = require( "path" );
const { createTask } = require( "@solid-js/cli" );
const { askContainer } = require( "./_common" );
const { delay } = require( "@solid-js/core" );
const { printLoaderLine } = require( "@solid-js/cli" );
const { tryTask } = require( "@solid-js/cli" );
const { execAsync } = require( "@solid-js/cli" );
const { findProject } = require( "./_common" );
const { nicePrint } = require( "@solid-js/cli" );
const { File } = require('@solid-js/files')

const defaultDockerFiles = [
	'docker-compose.chimera.yaml',
	'docker-compose.chimera.yml',
	'docker-compose.yaml',
	'docker-compose.yml',
]

// ----------------------------------------------------------------------------- UTILS

const fileExists = f => File.find( f ).length !== 0

function getDockerFile ( root )
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
	while ( !fileExists(dockerComposeFilePath) )
	return dockerComposeFilePath
}

// ----------------------------------------------------------------------------- START

async function start ( cliArguments, cliOptions )
{
	const project = findProject()
	const cwd = project.root
	const dockerFile = getDockerFile( project.root )

	let loaderLine = printLoaderLine(`Building docker project`)
	try {
		await execAsync(`docker-compose -f ${dockerFile} build --force-recreate`, 0, { cwd })
	} catch (e) {
		loaderLine(`Error while building docker project`)
		console.error( e )
		process.exit( 1 )
	}
	loaderLine(`Docker project built`);

	try {
		execAsync(`docker-compose -f ${dockerFile} up --no-build`, 3, { cwd })
	} catch (e) {
		nicePrint(`{b/r}An error occurred inside docker VM.`)
		console.error( e )
		process.exit( 1 )
	}

	if ( cliOptions.open || cliOptions.O ) {
		await delay(2)
		await open()
	}
}

// ----------------------------------------------------------------------------- OPEN

async function open ()
{
	const project = findProject()
	require('open')(`https://${project.config.project}.chimera.localhost`)
}

// ----------------------------------------------------------------------------- EXEC

async function exec ()
{
	// Find project
	const project = findProject()
	const container = await askContainer( false, project.config.project, true )

	// Connect to a piped shell
	const connectTask = createTask(`Connecting to ${container.niceName}`)
	const command = `docker exec -i ${container.id} /bin/bash`
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
		connectTask.error(`Unable to connect to ${container.niceName}`)
		console.error(nicePrint(`{b/r}${hadErrorWhileLoading}`, {output: 'return'}))
		process.exit(2)
	}

	// Pipe errors
	childProcess.stderr.on('data', data => {
		process.stderr.write(nicePrint(`{b/r}${data}`, { output: 'return' }))
	});

	// Connection success
	connectTask.success(`Connected to ${container.niceName}`)
	printShellInvite();
}

// ----------------------------------------------------------------------------- SYNC

async function sync ()
{
	// TODO
	console.log('SYNC')
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	start,
	open,
	exec,
	sync,
}