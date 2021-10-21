const path = require( "path" );
const { Directory, resolveHome } = require( "@solid-js/files" );
const { execAsync, tryTask, askList } = require( "@solid-js/cli" );
const { getPreferences, getContainerList, taskError } = require( "./_common" );
const isPortReachable = require('is-port-reachable');

// ----------------------------------------------------------------------------- UTILS

const preferences = getPreferences()
const serverRoot = resolveHome( path.join(preferences.chimeraPath, 'server') )
const portNotAvailable = port => {
	throw `Port ${port} is not available. Please close associated process.`
}

// ----------------------------------------------------------------------------- START

async function start ()
{
	// Check if nginx is already started
	// Ask to restart it if already started
	const containers = await getContainerList()
	if ( containers.find( container => container.name === 'core_nginx' ) ) {
		const restart = await askList(`Chimera proxy is already running. Do you want to restart it ?`, ['yes', 'no'])
		if ( restart[0] === 0 ) module.exports.restart();
		return;
	}

	await tryTask(`Checking ports`, async () => {
		if ( await isPortReachable(80) )
			portNotAvailable(80)
		if ( await isPortReachable(443) )
			portNotAvailable(443)
	}, taskError)

	await tryTask(`Creating chimera network`, async () => {
		try {
			await execAsync(`docker network create chimera`, 0, serverCWD)
		}
		catch (e) {}
	})

	const serverCWD = { cwd: serverRoot }

	await tryTask(`Enabling configs`, async () => {
		const configPath = 'core/nginx/data/config/virtual-hosts/';
		const makeCopyConfigCommand = (name) =>
			`cp ${configPath}${name}.conf.template ${configPath}${name}.conf`

		await execAsync(makeCopyConfigCommand('local-proxy-hostname'), 0, serverCWD)
		await execAsync(makeCopyConfigCommand('local-proxy-localhost'), 0, serverCWD)
	}, taskError)

	// Get public mdns hostname
	// TODO : Fail safe ? How does it behave on windows / linux ?
	let hostname = await execAsync(`hostname`)
	hostname = hostname.trim() + '.local'

	await tryTask(`Generating SSL certificates for ${hostname} and localhost`, async () => {
		const certsDirectory = new Directory( path.join(serverRoot, 'core/nginx/data/certs') )
		await certsDirectory.create()
		const certsPath = "core/nginx/data/certs/"
		const makeMkCertCommand = (fileName, domain) =>
			`mkcert -key-file ${certsPath}${fileName}-key.pem -cert-file ${certsPath}${fileName}-cert.pem '${domain}' '*.${domain}'`;
		await execAsync(makeMkCertCommand('hostname', hostname), 0, serverCWD);
		await execAsync(makeMkCertCommand('localhost', 'chimera.localhost'), 0, serverCWD);
	}, taskError)

	await tryTask(`Starting Nginx container`, async () => {
		await execAsync(`docker-compose up --build --detach`, 0, {
			cwd: path.join(serverRoot, 'core/nginx')
		})
	}, taskError)
}

// ----------------------------------------------------------------------------- STOP

async function stop ()
{
	await tryTask(`Stopping Nginx container`, async () => {
		await execAsync(`docker-compose down`, 0, {
			cwd: path.join(serverRoot, 'core/nginx')
		})
	}, taskError)
}

// ----------------------------------------------------------------------------- RESTART

async function restart ()
{
	await stop();
	await start();
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	start,
	stop,
	restart,
}