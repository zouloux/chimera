const path = require( "path" );
const { execAsync, runTask, askInput, askList, nicePrint } = require( "@solid-js/cli" );
const { parseBoolean } = require( "@solid-js/core" );
const { findProject } = require( "./_common" );
const { File, FileFinder } = require( "@solid-js/files" );

// ----------------------------------------------------------------------------- UTILS

const getKeys = (envs, keyStart) => Object.keys( envs ).filter( t => t.indexOf(keyStart) === 0 )
const keyfy = key => `[{[${key}]}]`

// ----------------------------------------------------------------------------- CONFIG

const backupFilePath = 'chimera-sync.sql'

// ----------------------------------------------------------------------------- PROJECT SYNC METHOD

async function projectSync ()
{
	// ------------------------------------------------------------------------- FIND DOT ENVS

	// Find project
	const project = findProject()

	// List all dot envs
	const dotEnvs = FileFinder.find("file", ".env*", {
		cwd: project.root
	})

	// Missing dot env
	if ( !dotEnvs.find( f => f.name === '.env' ) )
		nicePrint(`{b/r}.env not found.`, { code: 1 })

	// Too few dot envs
	if ( dotEnvs.length < 2 )
		nicePrint(`{b/r}To few dot env files to sync project.`, { code: 2 })

	// Browse dot env
	let dotEnvParsedConfigs = dotEnvs.map( file => {
		let dotEnvContent;
		try {
			dotEnvContent = file.dotEnv()
		}
		catch (e) {
			nicePrint(`{b/r}Invalid dot env file ${file.fullName}.`)
			console.error( e )
			process.exit( 1 )
		}

		let parsedConfig = {
			host: dotEnvContent.CHIMERA_SYNC_MYSQL_HOST,
			user: dotEnvContent.CHIMERA_SYNC_MYSQL_USER,
			password: dotEnvContent.CHIMERA_SYNC_MYSQL_PASSWORD,
			database: dotEnvContent.CHIMERA_SYNC_MYSQL_DATABASE,
		}

		// Detect missing config keys
		let missingConfigKeys = []
		Object.keys( parsedConfig ).map( key => {
			if ( !parsedConfig[ key ] )
				missingConfigKeys.push( key )
		})

		// No sync properties, remove from list
		if ( missingConfigKeys.length === 4 )
			return null

		// We have some sync properties, but not all mandatory properties
		else if ( missingConfigKeys.length !== 0 )
			nicePrint(`{b/r}Missing sync propert${missingConfigKeys.length > 1 ? 'ies' : 'y'} ${missingConfigKeys.join(", ")} in file ${file.fullName}`, { code : 1 })

		// Interpolate simple variables
		// Will only work with 1:1 variable interpolation, which means value needs to start by $
		// ex : CHIMERA_SYNC_MYSQL_HOST=$DB_HOST will interpolate
		// ex : CHIMERA_SYNC_MYSQL_HOST=chimera_$DB_HOST will NOT interpolate
		Object.keys( parsedConfig ).map( key => {
			const value = parsedConfig[ key ];
			if ( value.indexOf('$') !== 0 ) return
			const interpolatedKey = value.substr( 1, value.length )
			parsedConfig[ key ] = dotEnvContent[ interpolatedKey ]
		})

		// Parse boolean for allow read and allow write
		parsedConfig.read = parseBoolean( dotEnvContent.CHIMERA_SYNC_ALLOW_READ )
		parsedConfig.write = parseBoolean( dotEnvContent.CHIMERA_SYNC_ALLOW_WRITE )

		// Get name from dot env extension
		parsedConfig.name = (file.fullName === '.env' ? 'local' : file.extension)

		// Inject dot env for special configs
		parsedConfig.dotEnv = dotEnvContent

		return parsedConfig
	})

	// Filter envs with no sync properties
	dotEnvParsedConfigs = dotEnvParsedConfigs.filter( v => v )

	// ------------------------------------------------------------------------- ASK ENVS & DIRECTION

	// Get sync read env
	let fromList = dotEnvParsedConfigs.filter( v => v.read ).map( v => v.name )
	fromList = fromList.sort( a => {
		if ( a === 'local' ) 	return 10
		if ( a === 'chimera' ) 	return -10
		else 					return 0
	})
	if ( fromList.length === 0 )
		nicePrint(`{b/r}No sync source found. Add {b/w}CHIMERA_SYNC_ALLOW_READ=true{b/r} in associated .env file to allow sync.`, {code: 1})
	const readFrom = await askList('Sync from', fromList, { returnType: 'value' } )

	// Get sync write env
	const toList = dotEnvParsedConfigs.filter( v => (v.write && v.name !== readFrom) ).map( v => v.name )
	if ( toList.length === 0 )
		nicePrint(`{b/r}No sync destination found. Add {b/w}CHIMERA_SYNC_ALLOW_WRITE=true{b/r} in associated .env file to allow sync.`, {code: 1})
	const writeTo = await askList('Write to', toList, { returnType: 'value'} )

	// We write to local, no complex double check
	const firstSentence = `Are you sure to sync from ${readFrom} and write to ${writeTo} ?`
	if ( writeTo === 'local' ) {
		if ( await askList( firstSentence, [ 'Yes', 'No' ], { returnType: 'index' } ) === 1 )
			process.exit( 0 )
	}

	// We write to a distant env, complex double check
	else {
		let sureConfirm
		const sureSentence = nicePrint(`
			Are you sure to sync from ${readFrom} and write to ${writeTo} ?
			All data in ${writeTo} will be overridden by ${readFrom} data.
			Type {b/r}"${writeTo}"{b/w} to confirm
		`, { output: 'return' })
		do {
			sureConfirm = await askInput(sureSentence, { notEmpty: true })
		}
		while ( sureConfirm.toLowerCase() !== writeTo.toLowerCase() )
	}

	// Get envs info
	const readFromEnv = dotEnvParsedConfigs.find( v => v.name === readFrom )
	const writeToEnv = dotEnvParsedConfigs.find( v => v.name === writeTo )

	// Ask what to sync
	let whatToSync = 'all'
	if ( project.config.sync ) {
		whatToSync = await askList(`What to sync ?`, [
			'All',
			'Database only',
			'Files only'
		], { returnType: 'value' })
		whatToSync = whatToSync.split(' ')[0].toLowerCase()
	}

	console.log(whatToSync)
	process.exit();

	// FIXME: verbose
	// console.log({ readFrom, writeTo, })

	// ------------------------------------------------------------------------- PULL DB

	if ( whatToSync !== 'files' ) {
		await runTask(`Pulling DB from ${readFrom}`, async t => {
			const options = [
				// mandatory from MySQL 8 dump to MariaDB
				// https://serverfault.com/questions/912162/mysqldump-throws-unknown-table-column-statistics-in-information-schema-1109
				`--column-statistics=0`,
				// Options
				`--quick`, // NEW
				//`--single-transaction --quick --lock-tables=false`,
				// Connexion info
				`--user=${readFromEnv.user}`,
				`--password=${readFromEnv.password}`,
				`--host=${readFromEnv.host}`, // FIXME : PORT ??
				readFromEnv.database
			]
			// Generate and execute mysql dump command
			const command = `mysqldump ${options.join(' ')} > ${backupFilePath}`;
			// TODO -> verbose option
			// console.log( command );
			await execAsync( command, false, { cwd: project.root } )
			t.success();
		})
	}

	// ------------------------------------------------------------------------- ALTER DB

	if ( whatToSync !== 'files' ) {
		// Open freshly created backup file
		const backupFile = new File( path.join(project.root, backupFilePath) )
		if ( !backupFile.exists() )
			nicePrint(`{b/r}Error while reading {b/w}${backupFilePath}{b/r} file.`, { code: 1 })

		// Get replacers
		const replaceKeyStarter = 'CHIMERA_MIGRATE_MYSQL_REPLACE_'
		let fromEnvReplaceKeys = getKeys( readFromEnv.dotEnv, replaceKeyStarter )

		// let toEnvReplaceKeys = getKeys( writeToEnv.dotEnv, replaceKeyStarter )
		// FIXME -> Check if "from" replacers are equals to "to" replacers
		// FIXME -> if missing some, we must halt to prevent "undefined" queries

		// Replace from values
		fromEnvReplaceKeys.length > 0 && await runTask(`Replacing from values`, async t => {
			fromEnvReplaceKeys.map( key => {
				// TODO : Verbose
				backupFile.content( a => a.replaceAll( readFromEnv.dotEnv[ key ], keyfy(key) ) )
			})
			// TODO : Verbose
			await backupFile.saveAsync()
			t.success();
		})

		// Replace to values
		fromEnvReplaceKeys.length > 0 && await runTask(`Replacing to values`, async t => {
			fromEnvReplaceKeys.map( key => {
				// TODO : Verbose
				backupFile.content( a => a.replaceAll( keyfy(key), writeToEnv.dotEnv[ key ] ) )
			})
			// TODO : Verbose
			await backupFile.saveAsync()
			t.success();
		})

		// Patch queries
		let patchQueryKeys = getKeys( writeToEnv.dotEnv, 'CHIMERA_MIGRATE_MYSQL_PATCH_QUERY_' )
		patchQueryKeys.length > 0 && await runTask(`Patching query`, async t => {
			patchQueryKeys.map( key => {
				// TODO : Verbose
				backupFile.content( c => {
					c = c + "\n\n-- PATCH QUERY " + key
					c = c + "\n" + writeToEnv.dotEnv[ key ] + ';'
					return c
				})
			})
			await backupFile.saveAsync()
			t.success()
		})
	}

	// ------------------------------------------------------------------------- PUSH DB

	if ( whatToSync !== 'files' ) {
		await runTask( `Pushing DB to ${ writeTo }`, async t => {
			const options = [
				`--user=${ writeToEnv.user }`,
				`--password=${ writeToEnv.password }`,
				`--host=${ writeToEnv.host }`, // FIXME : port ?
				writeToEnv.database
			]
			const command = `mysql ${ options.join( ' ' ) } < ${ backupFilePath }`
			// TODO -> verbose option
			// console.log( command );
			await execAsync( command, false, { cwd: project.root } )
			t.success();
		} )
	}

	// ------------------------------------------------------------------------- SYNC DATA

	if ( whatToSync !== 'database' ) {
		/**
		 * TODO :
		 * Rsync from distant to local
		 * Rsync from local to distant
		 * V1 : Error if trying to sync files from distant to distant + explain through local
		 * V2 : Rsync from distant to distant, through local
		 */
	}
}

// ----------------------------------------------------------------------------- EXPORTS

module.exports = {
	projectSync
}