#!/usr/bin/env node

const { CLICommands, nicePrint } = require('@solid-js/cli')
const { File } = require('@solid-js/files')
const path = require('path')
const { chimeraPush } = require('./push')

// ----------------------------------------------------------------------------- RESEARCH

/**
 * TODO :
 * - Better .env.chimera injection
 * 		- do it with Files locally before push ?
 * 		- remove line in bash on server ?
 * - Options :
 *      --show-config option
 * 		-q --quiet option
 * 		-h --help option
 * 		-v --verbose option
 * - DOC DOC DOC !
 */

// ----------------------------------------------------------------------------- UTILS

// TODO DOC
function multiInject ( base, propertyName, value ) {
	base[ propertyName ] = [
		...base[ propertyName ],
		...( Array.isArray( value ) ? value : [ value ] )
	]
}

// ----------------------------------------------------------------------------- CLI COMMANDS

CLICommands.add('push', async (cliArguments, cliOptions, commandName) => {

	nicePrint(`{d}Using Chimera client {b/d}v${require('./package.json').version}`)

	// Default options
	let options = {
		dockerFile: 'chimera-docker-compose.yaml',
		afterScripts: [],
		paths: [],
		keep: [],
		exclude: []
	}

	// Load options from .chimera json5 file
	const chimeraConfigFile = new File('.chimera')
	if ( chimeraConfigFile.exists() ) {
		chimeraConfigFile.load()
		try {
			const configOptions = chimeraConfigFile.json5()
			// Remove options which are only for cli
			delete configOptions.branch
			delete configOptions.env
			options = { ...options, ...configOptions }
		}
		catch (e) {
			console.error( e )
			nicePrint(`{r/b}Error while parsing {b}.chimera{/r} file.`, { code: 1 })
		}
	}

	// Override with cli options and arguments

	if ( cliArguments[0] )			options.project = cliArguments[0]
	else if ( cliOptions.project ) 	options.project = cliOptions.project

	if ( cliOptions.host )			options.host = cliOptions.host
	if ( cliOptions.branch )		options.branch = cliOptions.branch
	if ( cliOptions.dockerFile )	options.dockerFile = cliOptions.dockerFile

	if ( cliOptions.path )			multiInject(options, 'paths', cliOptions.path)
	if ( cliOptions.keep )			multiInject(options, 'keep', cliOptions.keep)
	if ( cliOptions.afterScript )	multiInject(options, 'afterScripts', cliOptions.afterScript)
	if ( cliOptions.exclude )		multiInject(options, 'exclude', cliOptions.exclude)

	if ( cliOptions.debug )			options.debug = true
	if ( cliOptions['show-config'] )options.showConfig = true

	options.env = (
		cliOptions.env.indexOf('.') === 0
		? cliOptions.env
		: '.env.' + cliOptions.env
	)

	// Default parameters
	if ( !options.branch )
		options.branch = 'master'

	// Check parameters
	!options.host && nicePrint(`
		{r/b}Missing {b}host{/r} parameters.
		Specify it with {b}--host{/} option, or set it in {b}.chimera{/}
	`, { code: 2 })
	!options.project && nicePrint(`
		{r/b}Missing {b}project{/r} parameters.
		Specify it with first argument like {b}chimera push $project{/}, or as {b}--project{/}, or set it in {b}.chimera{/}
	`, { code: 3 })
	!options.paths && nicePrint(`
		{r/b}Missing {b}paths{/r} parameters.
		Specify it with {b}--path{/} option
		Or add a {b}paths{/} array to {b}.chimera{/}
	`, { code: 3 })

	// Execute push
	await chimeraPush( options )
}, {
	host	: null,
	project	: null,
	env		: '.env',
	branch	: 'master',
})

// ----------------------------------------------------------------------------- START

CLICommands.start( ( commandName, error, cliArguments, cliOptions, results ) => {
	if ( !commandName || results.length === 0 ) {
		nicePrint(`
			{r/b}Missing command name.
			Available commands :
			- push
		`, { code: 3 })
	}
});
