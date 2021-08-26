#!/usr/bin/env node

const { CLICommands, nicePrint, askList } = require('@solid-js/cli')
const { getPreferences } = require( "./commands/_common" );
const version = require('./package.json').version

// Check if this module is linked from zouloux's _framework directory ;)
const isLinkedFromFramework = __dirname.indexOf('/_framework')

// Halt if module is installed locally and not linked
if ( !require('is-installed-globally') && !isLinkedFromFramework ) {
	nicePrint(`
		{b/r}Chimera-client is designed to be used as a global package only.
		{d/i}Please run: {b}npm i -g @zouloux/chimera-client
	`, { code: 1 })
}

// ----------------------------------------------------------------------------- UTILS

const printUsingVersion = () => nicePrint(`{d}Using Chimera client {b/d}v${version}${isLinkedFromFramework ? '{/} - {b/w}linked' : ''}`)

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
	askAction(`Action on proxy`, [ 'start', 'stop', 'restart' ], cliArguments, action => {
		require('./commands/proxy')[ action ](  )
	})
}, {})

// ----------------------------------------------------------------------------- PROJECT

CLICommands.add('project', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	checkReady()
	askAction(`Action on project`, [ 'start', 'open', 'exec', 'sync' ], cliArguments, action => {
		require('./commands/project')[ action ]( cliArguments, cliOptions )
	})
}, {
	open: false, O: false
})

// ----------------------------------------------------------------------------- SERVICES

CLICommands.add('service', async (cliArguments, cliOptions, commandName) => {
	printUsingVersion()
	checkReady()
	askAction(`Action on service`, [ 'list', 'start', 'stop' ], cliArguments, action => {
		require('./commands/service')[ action ]( cliArguments[1] )
	})
})

// ----------------------------------------------------------------------------- START

// TODO -> Help

CLICommands.start( async ( commandName, error, cliArguments, cliOptions, results ) => {
	// No command executed
	if ( results.length !== 0 ) return
	printUsingVersion()
	// Show error if we asked for a command
	commandName && nicePrint(`{r/b}Unknown command name ${commandName}.`)
	// Show list of available commands. Only show config if not ready.
	const availableCommands = ( !getPreferences().ready ? ['setup', 'config'] : CLICommands.list() )
	const command = await askList(`Please select Chimera command`, availableCommands)
	await CLICommands.run( command[1], cliArguments, cliOptions )
});
