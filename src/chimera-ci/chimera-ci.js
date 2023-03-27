#!/usr/bin/env node

const { CLICommands, nicePrint } = require('@solid-js/cli')
const { multiInject } = require('@solid-js/core')
const { File } = require('@solid-js/files')
const path = require('path')
const { chimeraPush } = require('./commands/push')
const { chimeraInstall } = require( "./commands/install" );
const { prepareDefaultOptions, checkProject, checkHost } = require( "./commands/_common" );

// ----------------------------------------------------------------------------- RESEARCH

/**
 * TODO :
 * - DOC DOC DOC !
 * - Options :
 *      --show-config -> DOC
 * 		-q --quiet -> IMPLEMENT + DOC
 * 		-h --help -> IMPLEMENT + DOC
 * 		-v --verbose -> IMPLEMENT + DOC
 *
 * V1.1 - CHIMERA PUSH
 * - Shared folders
 * 		- Like keep folders but shared between all project branches
 * - Better .env.chimera injection ?
 * 		- do it with Files locally before push ?
 * 		- remove line in bash on server ?
 * - Check .chimera.yml file and throw if invalid
 * - Check if chimera server and client has compatible versions
 * - GITLAB DELETE HOOK
 * 		- Stop containers and remove all data of a removed branch from gitlab
 *  	https://docs.gitlab.com/ee/user/project/integrations/webhooks.html
 */

// ----------------------------------------------------------------------------- BEFORE TASKS

CLICommands.before( () => {
	// Check if this module is linked from zouloux's _framework directory ;)
	const isLinkedFromFramework = (__dirname.indexOf('/_framework') !== -1)
	nicePrint(`{d}Using Chimera CI {b/d}v${require('./package.json').version}${isLinkedFromFramework ? '{/} - {b/w}linked' : ''}`)
})

// ----------------------------------------------------------------------------- INSTALL

async function install ( cliOptions, options ) {
	// Override with cli options and arguments
	if ( cliOptions['force-update'] )
		options.forceUpdate = cliOptions['force-update']

	// Check options
	checkHost( options )

	// Execute install
	await chimeraInstall( options );
}

CLICommands.add('install', async (cliArguments, cliOptions, commandName) => {
	// Prepare default options
	const options = prepareDefaultOptions( {}, cliOptions )
	await install( cliOptions, options );
})

// ----------------------------------------------------------------------------- CLI COMMANDS

CLICommands.add('push', async (cliArguments, cliOptions, commandName) => {
	// Default options
	let options = {
		project: null,
		host: null,
		branch: 'main',
		dockerFile: null,
		afterScripts: [],
		paths: [],
		keep: [],
		exclude: []
	}

	// Load options from .chimera.yml file
	const chimeraConfigFile = new File('.chimera.yml')
	if ( await chimeraConfigFile.exists() ) {
		await chimeraConfigFile.load()
		try {
			const configOptions = chimeraConfigFile.yaml()
			// Remove options which are only for cli
			delete configOptions.branch
			delete configOptions.env
			options = { ...options, ...configOptions }
		}
		catch (e) {
			console.error( e )
			nicePrint(`{r/b}Error while parsing {b}.chimera.yml{/r} file.`, { code: 1 })
		}
	}

	// Prepare default options
	prepareDefaultOptions( options, cliOptions )

	// Override with cli options and arguments
	if ( cliOptions.project )
		options.project = cliOptions.project
	if ( cliOptions.branch )
		options.branch = cliOptions.branch
	if ( cliOptions['docker-file'] )
		options.dockerFile = cliOptions['docker-file']
	if ( cliOptions['docker'] === false )
		options.noDocker = !cliOptions['docker']
	if ( cliOptions['delete'] === false )
		options.noDelete = !cliOptions['delete']
	if ( cliOptions['project-root'] )
		options.projectRoot = cliOptions['project-root']
	if ( cliOptions['sym-links'] === false )
		options.noSymLinks = !cliOptions['sym-links']

	if ( cliOptions['after-script'] )
		multiInject(options, 'afterScripts', cliOptions['after-script'])
	if ( cliOptions.path )
		multiInject(options, 'paths', cliOptions.path)
	if ( cliOptions.keep )
		multiInject(options, 'keep', cliOptions.keep)
	if ( cliOptions.exclude )
		multiInject(options, 'exclude', cliOptions.exclude)

	// Default paths are no paths
	if ( !options.paths )
		options.paths = []

	// Get dotenv path
	options.env = (
		cliOptions.env.indexOf('.') === 0
		? cliOptions.env
		: '.env.' + cliOptions.env
	)

	// Check options
	checkHost( options );
	checkProject( options )

	// Project root, do not use process.cwd which can be wrong
	options.cwd = path.resolve('.')

	// Install if we got the option
	if ( cliOptions.install )
		await install(cliOptions, options)

	// Execute push
	await chimeraPush( options )
}, {
	host	: null,
	project	: null,
	env		: '.env',
	branch	: 'main'
})

// ----------------------------------------------------------------------------- DELETE

CLICommands.add('delete', async (cliArguments, cliOptions, commandName) => {
	// FIXME : TODO
	console.error(`Command not available yet`);
	process.exit(1);
})

// ----------------------------------------------------------------------------- START

CLICommands.start( ( commandName, error, cliArguments, cliOptions, results ) => {
	if ( !commandName || results.length === 0 ) {
		nicePrint(`
			{r/b}Missing command name.
			Available commands :
			- install
			- push
		`, { code: 3 })
	}
});
