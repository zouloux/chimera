#!/usr/bin/env node

const { CLICommands, nicePrint } = require('@solid-js/cli')
const { File } = require('@solid-js/files')
const path = require('path')
const { chimeraPush } = require('./commands/push')

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
 *
 * V1.2 - CHIMERA SYNC
 * - Sync data between local env and chimera
 * - Sync folder can be configured in .chimera.yml
 * - Can sync kept folder only ?
 * - Choose branch to sync (shared, master, my-branch ...)
 * - Direction -> up / down / (merge ?)
 * - Can sync database (merge will not work)
 *
 * V1.3 - GITLAB DELETE HOOK
 * - Stop containers and remove all data of a removed branch from gitlab
 *   https://docs.gitlab.com/ee/user/project/integrations/webhooks.html
 */

// ----------------------------------------------------------------------------- UTILS

const printUsingVersion = () => nicePrint(`{d}Using Chimera CI {b/d}v${require('./package.json').version}`)

// Inject some value into an array which is on an object.
// Will merge arrays if value is an array.
function multiInject ( object, arrayPropertyName, valueToInject ) {
	object[ arrayPropertyName ] = [
		...object[ arrayPropertyName ],
		...( Array.isArray( valueToInject ) ? valueToInject : [ valueToInject ] )
	]
}

// ----------------------------------------------------------------------------- CLI COMMANDS

CLICommands.add('push', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion();

	// Default options
	let options = {
		project: null,
		host: null,
		branch: 'master',
		dockerFile: null,
		afterScripts: [],
		paths: [],
		keep: [],
		exclude: []
	}

	// Load options from .chimera.yml file
	const chimeraConfigFile = new File('.chimera.yml')
	if ( chimeraConfigFile.exists() ) {
		chimeraConfigFile.load()
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

	// Override with cli options and arguments
	if ( cliOptions.project ) 		options.project = cliOptions.project
	if ( cliOptions.host )			options.host = cliOptions.host
	if ( cliOptions.branch )		options.branch = cliOptions.branch
	if ( cliOptions.dockerFile )	options.dockerFile = cliOptions.dockerFile

	if ( cliOptions.afterScript )	multiInject(options, 'afterScripts', cliOptions.afterScript)
	if ( cliOptions.path )			multiInject(options, 'paths', cliOptions.path)
	if ( cliOptions.keep )			multiInject(options, 'keep', cliOptions.keep)
	if ( cliOptions.exclude )		multiInject(options, 'exclude', cliOptions.exclude)

	if ( cliOptions.debug )				options.debug = true
	if ( cliOptions['show-config'] )	options.showConfig = true

	options.env = (
		cliOptions.env.indexOf('.') === 0
		? cliOptions.env
		: '.env.' + cliOptions.env
	)

	// Check parameters
	!options.host && nicePrint(`
		{r/b}Missing {b}host{/r} parameter.
		Specify it with {b}--host{/} option, or set it in {b}.chimera.yml{/}
		See Chimera doc to inject configure your CI to inject $CHIMERA_HOST on all projects.
	`, { code: 2 })
	!options.project && nicePrint(`
		{r/b}Missing {b}project{/r} parameter.
		Specify it with first argument like {b}chimera push --project $PROJECT{/}, or set it in {b}.chimera.yml{/}
	`, { code: 3 })
	!options.paths && nicePrint(`
		{r/b}Missing {b}paths{/r} parameters.
		Specify it with {b}--path{/} option
		Or add a {b}paths{/} array to {b}.chimera.yml{/}
	`, { code: 3 })

	// Execute push
	await chimeraPush( options )
}, {
	host	: null,
	project	: null,
	env		: '.env',
	branch	: 'master',
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
		printUsingVersion();
		nicePrint(`
			{r/b}Missing command name.
			Available commands :
			- push
		`, { code: 3 })
	}
});
