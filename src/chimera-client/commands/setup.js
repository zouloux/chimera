const { resolveHome } = require( "@solid-js/files" );
const { askList, printLoaderLine } = require( "@solid-js/cli" );
const { getPreferences } = require( "./_common" );
const { execAsync, askInput, nicePrint } = require( "@solid-js/cli" );
const { FileFinder, Directory } = require( "@solid-js/files" );

// ----------------------------------------------------------------------------- UTILS

async function checkExecutable ( executableName )
{
	let whichExec;
	try {
		whichExec = await execAsync(`which ${executableName}`, 0)
	}
	catch (e) { return false }
	const execFile = await FileFinder.find('file', whichExec)
	return execFile.length === 1
}

// ----------------------------------------------------------------------------- SETUP

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
	// const chimeraHost = await askInput(`Chimera SSH host, with port (ex : root@chimera.my-host.com:2002)`, {
	// 	defaultValue: preferences.chimeraHost
	// })

	if ( preferences.chimeraPath ) {
		nicePrint(`{b}Chimera repository is already installed.`)
		const update = await askList(`Do you wish to update it ?`, ['yes', 'no'])
		if ( update[0] === 0 ) {
			// const loader = printLoaderLine(`Updating Chimera repository`)
			try {
				await execAsync(`git pull`, 2, { cwd: resolveHome(preferences.chimeraPath) })
			}
			catch (e) {
				// loader(`Unable to update Chimera repository`, 'error')
				console.error(e);
				process.exit(3);
			}
			// loader(`Updated Chimera repository`)
		}
	}
	else {
		// Ask where to install repo
		nicePrint(`
			Chimera repository needs to be cloned somewhere.
			{b/o}This folder will contain services data (like Databases) and should be kept carefully.
		`)
		const chimeraPath = await askInput(`Please specify where to clone Chimera repository`, {
			defaultValue: '~/chimera'
		})

		// Check if directory already exists
		const whereFile = new Directory( chimeraPath )
		if ( whereFile.length > 0 ) {
			nicePrint(`{b/r}This directory already exists, can't clone here.`, { code: 3 })
		}

		// Clone repo
		const loader = printLoaderLine(`Cloning Chimera repository`)
		try {
			await execAsync(`git clone git@github.com:zouloux/chimera.git ${chimeraPath}`, 0)
		}
		catch (e) {
			loader(`Unable to clone Chimera repository`, 'error')
			console.error(e);
			process.exit(3);
		}
		loader(`Cloned Chimera repository`)

		preferences.chimeraPath = chimeraPath
	}

	// Save preferences
	preferences.ready = true;
	// preferences.chimeraHost = chimeraHost
	preferences.save();

	// All good
	nicePrint(`{g/b}Chimera is ready`)
}

// ----------------------------------------------------------------------------- EXPORTS / API

module.exports = {
	setup,
}