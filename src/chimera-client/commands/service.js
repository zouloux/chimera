const path = require( "path" );
const { nicePrint } = require( "@solid-js/cli" );
const { getContainerList } = require( "./_common" );
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
	// Get installed services list from Chimera repository
	const serviceNames = await getServicesList()

	// Get all running containers
	const containers = await getContainerList()

	// Browse all available service names
	serviceNames.map( serviceName => {
		// Open service's docker-compose
		const dockerComposeFile = new File( path.join(getServicesRoot(), serviceName, 'docker-compose.yaml') )

		// Try to find sub-services in docker-compose
		let subServices = []
		if ( dockerComposeFile.exists() ) {
			const dockerComposeContent = dockerComposeFile.yaml()
			//console.log(dockerComposeContent);
			if ('services' in dockerComposeContent) {
				Object.keys(dockerComposeContent.services).map( key => {
					const subService = dockerComposeContent.services[ key ]
					const associatedContainer = containers.find( container => (
						key === container.name || key === container.niceName
						|| subService.image === container.name || subService.image === container.niceName
						|| subService.containerName === container.name || subService.containerName === container.niceName
					))
					subServices.push({
						name: subService.containerName ?? subService.image ?? key,
						container: associatedContainer
					})
				})
			}
		}

		nicePrint(`{b/w}${serviceName}`)
		subServices.map( subService => {
			nicePrint(`{d/w}- ${subService.name} (${!!subService.container ? '{d/g}running' : '{d/r}stopped'}{d})`)
		})
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