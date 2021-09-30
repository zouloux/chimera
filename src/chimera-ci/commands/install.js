const path = require('path')
const { oraExec, oraTask, buildSSHCommand, execAsync } = require( "@solid-js/cli" );
const { asyncMap, delay } = require( "@solid-js/core" );

// ----------------------------------------------------------------------------- CONFIG

const _filesRoot = `https://raw.githubusercontent.com/zouloux/chimera/main/server/`
const _filesToInstall = [
	'chimera-project-build.sh',
	'chimera-project-install.sh',
	'chimera-project-patch-rights.sh',
	'chimera-project-start.sh',
	'chimera-project-stop.sh',
]

// ----------------------------------------------------------------------------- CHIMERA INSTALL

async function chimeraInstall ( options )
{
	// Show config object and halt
	if ( options.showConfig ) {
		console.log( options )
		process.exit()
	}

	let doInstall = true
	let remoteCommand;

	// Check installation
	if (!options.forceUpdate) {
		doInstall = false
		const fileToCheck = path.join( options.remoteChimeraHome, _filesToInstall[0] )
		remoteCommand = buildSSHCommand(`ls -la ${fileToCheck}`, options)
		options.debug && console.log(remoteCommand)
		await oraExec(remoteCommand, {}, {
			text: 'Checking installation ...',
			successText: 'Already installed',
		}, error => {
			error.taskUpdater.info(`Not installed`)
			doInstall = true;
		});
	}

	// Already installed, do not continue
	if (!doInstall) return;

	// Install files
	await oraTask({
		text: 'Installing ...',
		successText: 'Installed'
	}, async taskUpdater => {
		await asyncMap(_filesToInstall, async (file, i) => {
			const remoteFilePath = path.join( options.remoteChimeraHome, file )
			taskUpdater.setProgress( i, _filesToInstall.length )
			taskUpdater.setAfterText( file )
			try {
				const commands = [
					`curl ${_filesRoot}${file} -o ${remoteFilePath}`,
					`chmod +x ${remoteFilePath}`
				]
				remoteCommand = buildSSHCommand(commands.join(';'), options)
				options.debug && console.log(remoteCommand)
				await execAsync(remoteCommand, 0)
				await delay(.4) // To avoid being kicked from server
			}
			catch (e) {
				taskUpdater.error(`Unable to download ${file}`)
				console.error( e )
				process.exit(1)
			}
		});
	})
}

// ----------------------------------------------------------------------------- EXPORT MEMBERS

module.exports = {
	chimeraInstall,
}