const { execAsync } = require( "@solid-js/cli" );

// ----------------------------------------------------------------------------- UTILS


// ----------------------------------------------------------------------------- SCREEN

async function screen ( remote, container )
{

}

// ----------------------------------------------------------------------------- EXEC

async function exec ( remote, container )
{
	if ( !remote ) {
		const command = `docker exec -i ${container.id} /bin/bash`
		const childProcess = require('child_process').exec(command, {
			env: process.env,
			cwd: process.cwd()
		});
		childProcess.stdout.pipe(process.stdout);
		childProcess.stderr.pipe(process.stderr);
		process.stdin.pipe(childProcess.stdin)


		// await execAsync(`docker exec -i ${container.id} /bin/bash`, 2, {
		// 	env: process.env,
		// 	stdio: [process.stdin, 'pipe', 'pipe']
		// 	// stdio: 'pipe'

		// const pty = require('pty.js');
		// const tty = require('tty')
		//
		//
		// const terminal = pty.spawn(command, [], {
		// 	name: 'xterm-color',
		// 	cols: process.stdout.columns,
		// 	rows: process.stdout.rows,
		// 	cwd: process.cwd(),
		// 	env: process.env
		// });
		//
		// terminal.on('data', function(data) {
		// 	console.log(data);
		// });
		//
		// process.stdin.on('data', data => {
		// 	terminal.write(data)
		// })
		//
		// term.write('ls\r');
		// term.resize(100, 40);
		// term.write('ls /\r');
		//
		// console.log(term.process);
		//

		// require('child_process').spawn(`docker exec -it ${container.id} /bin/bash`, {
		// 	stdio: 'pipe'
		// })
	}
	else {
		console.error(`Remote container connection is not implemented yet.`)
		process.exit(1)
	}
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	screen,
	exec,
}