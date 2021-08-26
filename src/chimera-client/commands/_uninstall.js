const { getPreferences } = require( "./_common" );
const { Directory } = require( "@solid-js/files" );
const { printLoaderLine, nicePrint, newLine } = require( "@solid-js/cli" );

const preferences = getPreferences()

if ( preferences.ready && preferences.chimeraPath ) {
	const loader = printLoaderLine(`Removing Chimera setup ...`)
	const chimeraDirectory = new Directory( preferences.chimeraPath )
	chimeraDirectory.remove()
	loader(`Chimera setup removed`)
}
const loader = printLoaderLine(`Clearing preferences ...`)
preferences.clear()
loader(`Preferences cleared`)

newLine()
nicePrint(`
	{d/i}You can now run :
	{d/i}- {b}npm rm -g @zouloux/chimera-client{d/i} to remove Chimera client
	{d/i}- {b}npm up -g @zouloux/chimera-client{d/i} to update Chimera client
	{d/i}- {b}chimera setup{d/i} to setup Chimera again
`)
