const { nicePrint, prepareSSHOptions } = require( "@solid-js/cli" );
const { trailing } = require( "@solid-js/core" );


module.exports = {

	// ------------------------------------------------------------------------- OPTIONS

	prepareDefaultOptions ( options, cliOptions )
	{
		// Parse cli options
		if ( cliOptions.host ) 				options.host = cliOptions.host
		if ( cliOptions.user ) 				options.user = cliOptions.user
		if ( cliOptions.password ) 			options.password = cliOptions.password
		if ( cliOptions.home ) 				options.home = cliOptions.home
		if ( cliOptions.port ) 				options.port = cliOptions.port
		if ( cliOptions.githubToken ) 		options.githubToken = cliOptions.githubToken
		if ( cliOptions.debug ) 			options.debug = true
		if ( cliOptions['show-config'] ) 	options.showConfig = true
		if ( cliOptions['dry-run'] ) 		options.dryRun = true

		// Parse ssh options
		prepareSSHOptions( options )

		// Compute chimera home
		options.remoteChimeraHome = trailing(options.home ? options.home : `~/chimera/`, true);

		return options;
	},

	checkHost ( options ) {
		!options.host && nicePrint(`
			{r/b}Missing {b}host{/r} parameter.
			Specify it with {b}--host{/} option, or set it in {b}.chimera.yml{/}
			See Chimera doc to inject configure your CI to inject $CHIMERA_HOST on all projects.
		`, { code: 3 })
	},

	checkProject ( options ) {
		!options.project && nicePrint(`
			{r/b}Missing {b}project{/r} parameter.
			Specify it with project option like {b}chimera push --project $PROJECT{/}, or set it in {b}.chimera.yml{/}
		`, { code: 4 })
	},
}