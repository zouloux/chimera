const path = require( "path" );
const { resolveHome } = require( "@solid-js/files" );
const { taskError } = require( "./_common" );
const { execAsync } = require( "@solid-js/cli" );
const { tryTask } = require( "@solid-js/cli" );
const { askList } = require( "@solid-js/cli" );
const { File, FileFinder } = require( "@solid-js/files" );
const { getPreferences } = require( "./_common" );

// ----------------------------------------------------------------------------- UTILS

const getServicesRoot = () => resolveHome(
	path.join(getPreferences().chimeraPath, 'server/services')
)

async function getServicesList ()
{
	const directories = await FileFinder.listAsync( path.join(getServicesRoot(), '*') )
	return directories.map( directory => path.basename( directory) )
}

async function getAndAskService ( targetedService, action )
{
	const services = await getServicesList()
	let selectedService
	targetedService && services.map( service => {
		if ( service.toLowerCase() === targetedService.toLowerCase() )
			selectedService = service
	})
	return (
		selectedService ? selectedService
		: await askList(`Which service to ${action} ?`, services, { returnType: 'value' })
	)
}

// ----------------------------------------------------------------------------- LIST

async function list ()
{
	const services = await getServicesList()
	services.map( service => {
		console.log(service)
	})
}

// ----------------------------------------------------------------------------- START

async function start ( serviceToStart )
{
	const service = await getAndAskService(serviceToStart, 'start')
	const servicePath = path.join(getServicesRoot(), service)

	const startFile = new File( path.join(servicePath, 'start.sh') )
	if ( startFile.exists() ) {
		await execAsync(startFile.path, 3, {
			cwd: servicePath,
			env: process.env
		})
		process.exit();
	}

	await tryTask(`Starting ${service} container`, async () => {
		await execAsync(`docker-compose up --build --detach --force-recreate`, 0, {
			cwd: servicePath
		})
	}, taskError)

}

// ----------------------------------------------------------------------------- STOP

async function stop ( serviceToStop )
{
	const service = await getAndAskService(serviceToStop, 'start')
	const servicePath = path.join(getServicesRoot(), service)

	await tryTask(`Stopping ${service} container`, async () => {
		await execAsync(`docker-compose down --remove-orphans`, 0, {
			cwd: servicePath
		})
	}, taskError)
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	list,
	start,
	stop,
}