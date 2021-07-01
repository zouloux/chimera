const path = require( "path" );
const { getPreferences } = require( "./_common" );

const { execAsync, askInput, nicePrint } = require( "@solid-js/cli" );
const { FileFinder, Directory } = require( "@solid-js/files" );


async function checkExecutable ( executableName )
{
	let whichExec;
	try {
		whichExec = await execAsync(`which ${executableName}`, 0)
	}
	catch (e) { return false }
	const execFile = FileFinder.find('file', whichExec)
	return execFile.length === 1
}

async function setup ()
{
	const preferences = getPreferences()

	// Check git
	if ( !(await checkExecutable('git')) )
		nicePrint(`{b/r}Please install Git to continue.`, { code: 2 })

	// Check docker
	if ( !(await checkExecutable('docker')) )
		nicePrint(`
			{b/r}Please install Docker to continue.
			→ https://docs.docker.com/get-docker/
		`, { code: 2 })

	// Check docker
	if ( !(await checkExecutable('mkcert')) )
		nicePrint(`
			{b/r}Please install mkcert to continue.
			→ https://github.com/FiloSottile/mkcert
		`, { code: 2 })

	// Ask for default distant chimera
	const chimeraHost = await askInput(`Chimera SSH host, with port (ex : root@chimera.my-host.com:2002)`)

	if ( !preferences.chimeraPath )
	{
		// Ask where to install repo
		const chimeraPath = await askInput(`Chimera repository needs to be cloned somewhere.`, {
			defaultValue: '~/chimera'
		})

		// Check if directory already exists
		const whereFile = new Directory( chimeraPath )
		if ( whereFile.length > 0 ) {
			nicePrint(`{b/r}This directory already exists, can't clone here.`, { code: 3 })
		}

		// Clone repo
		try {
			await execAsync(`git clone git@github.com:zouloux/chimera.git ${chimeraPath}`, 0)
		}
		catch (e) {
			nicePrint(`{b/r}Error while cloning Chimera repository.`)
			console.error(e);
			process.exit(3);
		}

		preferences.chimeraPath = chimeraPath
	}

	// Save preferences
	preferences.ready = true;
	preferences.chimeraHost = chimeraHost
	preferences.save();

	// All good
	nicePrint(`{g/b}Chimera is ready`)
}


module.exports = {
	setup,
}