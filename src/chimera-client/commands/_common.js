const path = require( "path" );
const { FileFinder } = require("@solid-js/files")
const Preferences = require('preferences')
const { askList } = require( "@solid-js/cli" );
const { nicePrint, execAsync } = require( "@solid-js/cli" );
const { File } = require('@solid-js/files')

// ----------------------------------------------------------------------------- PREFERENCES

const preferences = new Preferences('zouloux.chimera-client', {
	ready: false
}, {
	encrypt: false
})

function getPreferences () { return preferences }

// ----------------------------------------------------------------------------- BROWSE HELPER

function browseParentsForFile ( cwd, fileName ) {
	let currentFilePath = path.join( cwd, fileName )
	while ( FileFinder.find('file', currentFilePath).length === 0 ) {
		currentFilePath = path.resolve( path.join( path.dirname( currentFilePath ), '../', fileName ) )
		if ( path.dirname(currentFilePath) === '/' ) return null
	}
	return currentFilePath
}

// ----------------------------------------------------------------------------- PROJECT FILE

function findProject ( allowFail = false ) {
	const projectPath = browseParentsForFile( process.cwd(), '.chimera.yml' )
	if ( !projectPath )
		if ( allowFail )
			return null
		else
			nicePrint(`{b/r}CWD not in a Chimera project.`, { code: 4 })

	const projectFile = new File( projectPath )
	let projectConfig
	try {
		projectFile.load()
		projectConfig = projectFile.yaml()
	} catch (e) {
		nicePrint(`{b/r}Invalid .chimera.yml file.`, { code: 5 })
	}

	if ( typeof projectConfig.project !== 'string' )
		nicePrint(`{b/r}Mandatory 'project' property is missing from .chimera.yml file.`, { code: 1 })

	return {
		root: path.dirname( projectPath ),
		config: projectConfig,
	}
}

// ----------------------------------------------------------------------------- ASK CONTAINER

function parseContainerList ( buffer )
{
	const lines = buffer.split("\n")
	if ( lines[0].indexOf('CONTAINER') !== 0 )
		throw new Error(`Cannot connect to docker.`)
	let containers = []
	lines.shift()
	lines.map( line => {
		const columns = line.split(" ").filter( v => v )
		if ( !columns[0] || !columns[1] ) return;
		const split = columns[1].split('_')
		containers.push({
			id: columns[0],
			name: columns[1],
			niceName: 1 in split ? split[1] : split[0],
			isProject: split[0].toLowerCase() === 'project'
		})
	})
	return containers;
}

async function getContainerList ( onlyProjects = false )
{
	let containerListBuffer
	try {
		containerListBuffer = await execAsync(`docker ps`)
	}
	catch ( e ) {
		nicePrint(`{b/r}${e}`, { code: 1 })
	}
	let containers = parseContainerList( containerListBuffer )
	if ( onlyProjects )
		containers = containers.filter( container => container.isProject )
	return containers
}

// ----------------------------------------------------------------------------- TASKS / LOGS

const taskError = (t, e) => { t.error(2, e) }

// ----------------------------------------------------------------------------- API / EXPORTS

module.exports = {
	getPreferences,
	browseParentsForFile,
	findProject,
	getContainerList,
	taskError,
}