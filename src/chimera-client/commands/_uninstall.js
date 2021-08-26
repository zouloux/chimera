const { getPreferences } = require( "./_common" );
const { Directory } = require( "@solid-js/files" );

const preferences = getPreferences()

if ( preferences.ready && preferences.chimeraPath ) {
	console.log('Removing chimera setup ...')
	const chimeraDirectory = new Directory( preferences.chimeraPath )
	chimeraDirectory.remove()
	console.log('Done')
}

preferences.clear()
