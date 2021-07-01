const path = require( "path" );
const { Directory, resolveHome } = require( "@solid-js/files" );
const { nicePrint, execAsync, tryTask } = require( "@solid-js/cli" );
const { getPreferences } = require( "./_common" );

// ----------------------------------------------------------------------------- UTILS

const preferences = getPreferences()
const serverRoot = resolveHome( path.join(preferences.chimeraPath, 'server') )

const taskError = (t, e) => {
	t.error(2, e)
}

// ----------------------------------------------------------------------------- START

async function start ()
{
	await tryTask(`Enabling configs`, async () => {
		await execAsync(`cp core/nginx/data/config/virtual-hosts/localhost.conf.template core/nginx/data/config/virtual-hosts/localhost.conf`, 0, {
			cwd: serverRoot
		})
	}, taskError)

	await tryTask(`Generating SSL certificates for *.chimera.localhost`, async () => {
		const certsDirectory = new Directory( path.join(serverRoot, 'core/nginx/data/certs') )
		await certsDirectory.createAsync()
		await execAsync(`mkcert -key-file core/nginx/data/certs/localhost-key.pem -cert-file core/nginx/data/certs/localhost-cert.pem 'chimera.localhost' '*.chimera.localhost'`, 0, {
			cwd: serverRoot
		})
	}, taskError)

	await tryTask(`Starting Nginx container`, async () => {
		await execAsync(`docker-compose up --build -d`, 0, {
			cwd: path.join(serverRoot, 'core/nginx')
		})
	}, taskError)

	nicePrint(`
		{b/g}Started Chimera containers will be available at :
		→ {b}https://$CHIMERA_ID.chimera.localhost
	`)
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

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	start,
	stop,
}