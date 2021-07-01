#!/usr/bin/env node

const { CLICommands, nicePrint, askInput, askList } = require('@solid-js/cli')
const { File } = require('@solid-js/files')
const path = require('path')
const { getPreferences } = require( "./commands/_common" );
const version = require('./package.json').version

// ----------------------------------------------------------------------------- RESEARCH

/**
 * TODO
 */

// ----------------------------------------------------------------------------- UTILS

const printUsingVersion = () => nicePrint(`{d}Using Chimera client {b/d}v${version}`)

const checkReady = () => {
	if ( getPreferences().ready ) return
	nicePrint(`
		{r/b}Chimera is not configured.
		{d}Please run {b}chimera setup{/}{d} to continue.
	`, { code: 1 })
}

async function askAction ( title, actions, cliArguments, handler )
{
	cliArguments[0] ??= await askList(title, actions, { returnType: 'value' });
	const action = cliArguments[0].toLowerCase()

	if ( actions.indexOf( action ) !== -1 )
		await handler( action )
	else
		nicePrint(`{b/r}Command ${action} invalid`, { code: 2 })
}

// ----------------------------------------------------------------------------- SETUP / CONFIG

CLICommands.add('setup', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	await require('./commands/setup').setup();
}, {})

CLICommands.add('config', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	console.log( getPreferences() ) // TODO : Better CLI
}, {})

// ----------------------------------------------------------------------------- PROXY

CLICommands.add('proxy', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	checkReady()
	askAction(`Action on proxy`, [ 'start', 'stop' ], cliArguments, action => {
		require('./commands/proxy')[ action ]()
	})
}, {})

// ----------------------------------------------------------------------------- SERVICES

CLICommands.add('service', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	checkReady()
	askAction(`Action on service`, [ 'list', 'start', 'stop' ], cliArguments, action => {
		require('./commands/service')[ action ]()
	})
}, {
	remote: false
})

// ----------------------------------------------------------------------------- PROJECT

CLICommands.add('project', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	checkReady()
	askAction(`Action on project`, [ 'start', 'stop', 'open', 'sync' ], cliArguments, action => {
		require('./commands/service')[ action ]()
	})
}, {
	remote: false
})

// ----------------------------------------------------------------------------- CONNECT

CLICommands.add('connect', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	checkReady();
	askAction(`Connect action`, [ 'screen', 'exec' ], cliArguments, action => {
		require('./commands/service')[ action ]()
	})
}, {
	remote: false
})

// ----------------------------------------------------------------------------- START

CLICommands.start( ( commandName, error, cliArguments, cliOptions, results ) => {
	if ( !commandName || results.length === 0 ) {
		printUsingVersion()
		// TODO -> Automatic version
		// TODO -> Help
		nicePrint(`
			{r/b}Missing command name.
			Available commands :
		`, { code: 3 })
	}
});
