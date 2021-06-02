#!/usr/bin/env node

const { CLICommands, nicePrint } = require('@solid-js/cli')
const { File } = require('@solid-js/files')
const path = require('path')
const { chimeraPush } = require('./push')

// ----------------------------------------------------------------------------- RESEARCH

/**
 * TODO :
 * - Common folders with symlink
 * - Better .env.chimera injection
 * 		- do it with Files locally before push ?
 * 		- remove line in bash on server ?
 * - Options :
 * 		-q --quiet option
 * 		-h --help option
 * 		-v --verbose option
 * - DOC DOC DOC !
 */

// V1.0 MVP
// - client
// 		chimera push
// - scripts
// 		keep folders between pushes

// V1.1
// - server
// 		UI - Connect with http
// 		API - Exec API Commands with an api key
// 		API - start / stop / delete / list / stats

// V1.1+
// -> Common folders between branches
// -> Common services between branches (ex : 1 mysql)
// chimera stop --branch
// chimera delete --branch

// V1.2+
// -> Images repo for projects ( node server image / lamp image ... )
// -> Images repo for useful services ( preconfigured gitlab for ex )
// chimera download --branch --volume

// -> Build au niveau du CI (build local) ?
// + Plus pro, plus clean
// + Permet de swap l'image en 2 sec
// - Besoin d'un repo d'images
// - Transfert de fichier + fat

// -> Build au niveau de Chimera (build distant) ?
// - Moins pro
// - Swap plus long car pendant le build, l'image ne tourne pas
// + Le dossier docker peut-être SHA pour éviter de re-build
// + Moins de data à transfert (on transfert pas l'image mais son fichier texte)
// + Plus facile à implémenter
// + Pas de repo d'images à gérer

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
		keep: []
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

	if ( cliOptions.debug )			options.debug = true

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

	// TODO : DOC
	if ( cliOptions.showConfig ) {
		console.log( options )
		process.exit()
	}

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
