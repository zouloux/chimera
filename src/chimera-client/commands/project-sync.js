const path = require( "path" );
const { execAsync, runTask, askInput, askList, nicePrint, printLoaderLine } = require( "@solid-js/cli" );
const { parseBoolean, trailing, leading } = require( "@solid-js/core" );
const { findProject } = require( "./_common" );
const { File, FileFinder } = require( "@solid-js/files" );

/**
 * TODO - MVP
 *
 *
 * TODO - V1
 * - Synchroniser avec une branche autre que master -> CHIMERA_SYNC_FILE_ROOT=/root/project/keep/*, automatique sur chimera
 * - Proposer la possibilité de supprimer le chimera-sync.sql
 * - Proposer la possibilité de garder X version de chimera-sync.sql avec dates, dans un dossier
 *
 * TODO - Moins important
 * - Sync files distant to distant, avec prompt ?
 * - Ajouter une option dans .env CHIMERA_SYNC_NO_CONFIRM pour éviter la confirmation où il faut retaper le nom de l'env
 */

// ----------------------------------------------------------------------------- CONFIG

const mysqlBackupFileName = 'chimera-sync.sql'

// ----------------------------------------------------------------------------- UTILS

const getKeys = (envs, keyStart) => Object.keys( envs ).filter( t => t.indexOf(keyStart) === 0 )
const keyfy = key => `[{[${key}]}]`
const parseHostPort = (host, defaultPort) => {
	if ( !host ) host = '';
	const split = host.split(':')
	return {
		host: split[ 0 ],
		port: split.length >= 2 ? parseInt( split[1], 10 ) : defaultPort
	}
}

// ----------------------------------------------------------------------------- PROJECT SYNC METHOD

async function projectSync ()
{
	// ------------------------------------------------------------------------- FIND DOT ENVS

	// Find project
	const project = await findProject()

	// List all dot envs
	const dotEnvs = await FileFinder.find("file", ".env*", {
		cwd: project.root
	})

	// Missing dot env
	if ( !dotEnvs.find( f => f.fullName === '.env' ) )
		nicePrint(`{b/r}.env not found.`, { code: 1 })

	// Too few dot envs
	if ( dotEnvs.length < 2 )
		nicePrint(`{b/r}To few dot env files to sync project.`, { code: 2 })

	for ( const file of dotEnvs )
		await file.load()

	// Browse dot env files
	let dotEnvParsedConfigs = dotEnvs.map( file => {
		// Read it
		let dotEnvContent;
		try {
			dotEnvContent = file.dotEnv()
		}
		catch (e) {
			nicePrint(`{b/r}Invalid dot env file ${file.fullName}.`)
			console.error( e )
			process.exit( 1 )
		}

		// Generate an env bag with current envs overridden with dot env file props
		const envProperties = {
			...process.env,
			...dotEnvContent,
		}

		// Interpolate simple variables in dot env
		// Will only work with 1:1 variable interpolation, which means value needs to start by $
		// ex : CHIMERA_SYNC_MYSQL_HOST=$DB_HOST will interpolate
		// ex : CHIMERA_SYNC_MYSQL_HOST=chimera_$DB_HOST will NOT interpolate
		// TODO : Better variable interpolation if needed
		Object.keys( dotEnvContent ).map( key => {
			// Read value and detect variables starting with $
			const value = dotEnvContent[ key ].trim();
			if ( value.indexOf('$') !== 0 ) return
			// Get variable name
			const interpolatedKey = value.substr( 1, value.length )
			// Check if this variable exists in env properties
			if ( !envProperties[ interpolatedKey ] )
				nicePrint(`{b/r}Variable {b/w}${value}{b/r} from file ${file.fullName} not found in process envs or ${file.fullName} variables.`, { code: 2 })
			// Interpolate
			dotEnvContent[ key ] = envProperties[ interpolatedKey ]
		});

		const isLocal = file.fullName === '.env';

		// Generate clean config object
		let parsedConfig = {
			// Get name from dot env extension
			name: ( isLocal ? 'local' : file.extension ),
			// MySQL transfer config
			mysql: {
				...parseHostPort(dotEnvContent.CHIMERA_SYNC_MYSQL_HOST ?? '', 3306),
				pullMethod: (dotEnvContent.CHIMERA_SYNC_MYSQL_PULL_METHOD ?? 'mysql').toLowerCase(),
				pushMethod: (dotEnvContent.CHIMERA_SYNC_MYSQL_PULL_METHOD ?? 'mysql').toLowerCase(),
				user: dotEnvContent.CHIMERA_SYNC_MYSQL_USER,
				password: dotEnvContent.CHIMERA_SYNC_MYSQL_PASSWORD,
				database: dotEnvContent.CHIMERA_SYNC_MYSQL_DATABASE,
			},
			// File transfer config
			files: {
				...parseHostPort(dotEnvContent.CHIMERA_SYNC_FILE_HOST, 2002),
				user: dotEnvContent.CHIMERA_SYNC_FILE_USER ?? 'root',
				root: dotEnvContent.CHIMERA_SYNC_FILE_ROOT ?? `~/chimera/projects/${project.config.project}/master/keep`,
			},
			// Parse boolean for allow read and allow write
			read: parseBoolean( dotEnvContent.CHIMERA_SYNC_ALLOW_READ ),
			write: parseBoolean( dotEnvContent.CHIMERA_SYNC_ALLOW_WRITE ),
			fileName: file.fullName,
			// Inject full dot env
			dotEnv: dotEnvContent,
		}

		// Detect missing keys in MySQL config node
		let missingMySQLConfigKeys = []
		Object.keys( parsedConfig.mysql ).map( key => {
			if ( parsedConfig.mysql[ key ] == null )
				missingMySQLConfigKeys.push( key )
		})

		// We have some mysql sync properties, but not all mandatory properties
		if ( missingMySQLConfigKeys.length !== 0 )
			nicePrint(`{b/r}Missing mysql sync propert${missingMySQLConfigKeys.length > 1 ? 'ies' : 'y'} ${missingMySQLConfigKeys.join(", ")} in file ${file.fullName}`, { code : 1 })

		// No MySQL config detected
		if ( missingMySQLConfigKeys.length === 4 )
			parsedConfig.mysql = false
		// MySQL host to 127 if host is localhost
		else if ( isLocal || parsedConfig.mysql.host.toLowerCase() === 'localhost' )
			parsedConfig.mysql.host = '127.0.0.1'

		// In local env, no files sync info
		if ( isLocal )
			parsedConfig.files = true
		// No files config detected
		else if ( !parsedConfig.files.host )
			parsedConfig.files = false

		// No sync properties at all, remove from list
		if ( !parsedConfig.mysql && !parsedConfig.files )
			return null

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

	// Check if dot env contains host info
	const missingSyncFileHostTemplate = f => `{b/r}${f} misses {b/w}CHIMERA_SYNC_FILE_HOST{b/r} property to sync files.`
	if ( project.config.sync && !readFromEnv.files )
		nicePrint(missingSyncFileHostTemplate(readFromEnv.fileName), { code: 1 })
	if ( project.config.sync && !writeToEnv.files )
		nicePrint(missingSyncFileHostTemplate(writeToEnv.fileName), { code: 1 })

	// Ask what to sync, only if we can sync some files or some database
	let whatToSync = 'all'
	if ( project.config.sync && !readFromEnv.mysql )
		whatToSync = 'files'
	else if ( !project.config.sync && readFromEnv.mysql )
		whatToSync = 'database'
	else if ( project.config.sync && readFromEnv.files ) {
		whatToSync = await askList(`What to sync ?`, [
			'All',
			'Database only',
			'Files only'
		], { returnType: 'value' })
		whatToSync = whatToSync.split(' ')[0].toLowerCase()
	}

	// Check if not trying to transfer files from distant to distant (without local)
	if (
		whatToSync !== 'database'
		&& ( typeof readFromEnv.files === 'object' && typeof readFromEnv.files.host === 'string' )
		&& ( typeof writeToEnv.files === 'object' && typeof writeToEnv.files.host === 'string' )
	) {
		nicePrint(`
			{b/r}Chimera sync is unable to transfer files from a distant to another distant env.
			Please sync env A with your local env, then sync your local env to env B.
		`, {code: 1})
	}

	// FIXME: verbose
	// console.log({ readFrom, writeTo, })
	// console.log( readFromEnv );
	// console.log( writeToEnv );
	// console.log(whatToSync)
	// process.exit();

	// ------------------------------------------------------------------------- PULL DB

	if ( whatToSync !== 'files' ) {
		const dumpOptions = [
			// mandatory from MySQL 8 dump to MariaDB
			// https://serverfault.com/questions/912162/mysqldump-throws-unknown-table-column-statistics-in-information-schema-1109
			`--column-statistics=0`,
			// Options
			`--quick`,
			`--single-transaction`, // NEW
			`--extended-insert`, // NEW
			// `--lock-tables=false`,
		]

		const loader = printLoaderLine(`Pulling DB from ${readFrom}`)

		// Use only MySQL to dump in 1 longer step
		if ( readFromEnv.mysql.pullMethod === 'mysql' ) {
			const options = [
				...dumpOptions,
				`--user=${readFromEnv.mysql.user}`,
				`--password=${readFromEnv.mysql.password}`,
				`--host=${readFromEnv.mysql.host}`,
				`--port=${readFromEnv.mysql.port}`,
				readFromEnv.mysql.database
			]
			// Generate and execute mysql dump command
			const command = `mysqldump ${options.join(' ')} > ${mysqlBackupFileName}`;
			// Execute dump command directly from server
			try {
				await execAsync( command, false, { cwd: project.root } )
			}
			catch ( e ) {
				loader(`Unable to pull DB from ${readFrom}`, 'error')
				console.error( e )
				process.exit(1)
			}
		}

		// Use 2 quicker steps to download dump
		else if ( readFromEnv.mysql.pullMethod === 'scp' ) {
			// Generate a uid for this dump
			const dumpUID = project.config.project+'_'+Math.floor((Math.random() * 99999999)).toString(16)
			// Generate and mysql dump command
			const options = [
				...dumpOptions,
				`--user=${readFromEnv.mysql.user}`,
				`--password=${readFromEnv.mysql.password}`,
				`--host=127.0.0.1`,
				`--port=${readFromEnv.mysql.port}`,
				readFromEnv.mysql.database
			]
			const dumpDestination = `/tmp/${dumpUID}.sql`
			const generateSSHCommand = command => `ssh ${readFromEnv.files.user}@${readFromEnv.files.host} -p ${readFromEnv.files.port} '${command}'`
			const sshDumpCommand = generateSSHCommand(`mysqldump ${options.join(' ')} > ${dumpDestination}`)
			const scpCommand = `scp -P ${readFromEnv.files.port} ${readFromEnv.files.user}@${readFromEnv.files.host}:${dumpDestination} ${path.join(project.root, mysqlBackupFileName)}`
			const sshCleanCommand = generateSSHCommand(`rm ${dumpDestination}`)

			try {
				// Dump on distant server
				await execAsync( sshDumpCommand )
				// Download dump
				await execAsync( scpCommand )
				// Clean generated dump
				await execAsync( sshCleanCommand )
			}
			catch (e) {
				loader(`Unable to pull DB from ${readFrom}`, 'error')
				console.error( e )
				process.exit(1)
			}
		}
		loader(`Pulled DB from ${readFrom}`)
	}

	// ------------------------------------------------------------------------- ALTER DB

	if ( whatToSync !== 'files' )
	{
		// Open freshly created backup file
		const backupFile = new File( path.join(project.root, mysqlBackupFileName) )
		if ( !(await backupFile.exists()) )
			nicePrint(`{b/r}Error while reading {b/w}${mysqlBackupFileName}{b/r} file.`, { code: 1 })
		await backupFile.load()

		// Get replacers
		const replaceKeyStarter = 'CHIMERA_SYNC_MYSQL_REPLACE_'
		let fromEnvReplaceKeys = getKeys( readFromEnv.dotEnv, replaceKeyStarter )

		// let toEnvReplaceKeys = getKeys( writeToEnv.dotEnv, replaceKeyStarter )
		// FIXME -> Check if "from" replacers are equals to "to" replacers
		// FIXME -> if missing some, we must halt to prevent "undefined" queries

		// Replace values
		if ( fromEnvReplaceKeys.length > 0 ) {
			const loader = printLoaderLine(`Replacing values`)
			fromEnvReplaceKeys.map( key => {
				// TODO : Verbose
				backupFile.content( a => a.replaceAll( readFromEnv.dotEnv[ key ], keyfy(key) ) )
			})
			await backupFile.save()
			fromEnvReplaceKeys.map( key => {
				// TODO : Verbose
				backupFile.content( a => a.replaceAll( keyfy(key), writeToEnv.dotEnv[ key ] ) )
			})
			await backupFile.save()
			loader(`Replaced ${fromEnvReplaceKeys.length} value${fromEnvReplaceKeys.length > 1 ? 's' : ''}`)
		}

		// Patch queries
		let patchQueryKeys = getKeys( writeToEnv.dotEnv, 'CHIMERA_SYNC_MYSQL_PATCH_QUERY_' )
		if ( patchQueryKeys.length > 0 ) {
			const loader = printLoaderLine(`Patching query`)
			patchQueryKeys.map( key => {
				// TODO : Verbose
				backupFile.content( c => {
					c = c + "\n\n-- PATCH QUERY " + key
					c = c + "\n" + writeToEnv.dotEnv[ key ] + ';'
					return c
				})
			})
			await backupFile.save()
			loader(`Patched query with ${patchQueryKeys.length} instruction${patchQueryKeys.length > 1 ? 's' : ''}`)
		}
	}

	// ------------------------------------------------------------------------- PUSH DB

	if ( whatToSync !== 'files' ) {
		const loader = printLoaderLine(`Pushing DB to ${writeTo}`)

		// Use only MySQL to push in 1 longer step
		if ( writeToEnv.mysql.pushMethod === 'mysql' ) {
			const options = [
				`--user=${ writeToEnv.mysql.user }`,
				`--password=${ writeToEnv.mysql.password }`,
				`--host=${ writeToEnv.mysql.host }`,
				`--port=${ writeToEnv.mysql.port }`,
				writeToEnv.mysql.database
			]
			const command = `mysql ${ options.join( ' ' ) } < ${ mysqlBackupFileName }`
			try {
				await execAsync( command, false, { cwd: project.root } )
			}
			catch (e) {
				loader(`Unable to push DB to ${writeTo}`, 'error')
				console.error( e )
				process.exit(1)
			}
		}
		// Use 2 quicker steps to download dump
		else if ( writeToEnv.mysql.pushMethod === 'scp' ) {
			// Generate a uid for this dump
			const dumpUID = project.config.project+'_'+Math.floor((Math.random() * 99999999)).toString(16)
			// Generate and mysql dump command
			const options = [
				`--user=${writeToEnv.mysql.user}`,
				`--password=${writeToEnv.mysql.password}`,
				`--host=127.0.0.1`,
				`--port=${writeToEnv.mysql.port}`,
				readFromEnv.mysql.database
			]
			const dumpDestination = `/tmp/${dumpUID}.sql`
			const generateSSHCommand = command => `ssh ${writeToEnv.files.user}@${writeToEnv.files.host} -p ${writeToEnv.files.port} '${command}'`
			const sshInjectCommand = generateSSHCommand(`mysql ${ options.join( ' ' ) } < ${ dumpDestination }`)
			const scpCommand = `scp -P ${writeToEnv.files.port} ${path.join(project.root, mysqlBackupFileName)} ${writeToEnv.files.user}@${writeToEnv.files.host}:${dumpDestination}`
			const sshCleanCommand = generateSSHCommand(`rm ${dumpDestination}`)

			try {
				// Upload dump
				await execAsync( scpCommand )
				// Inject on distant server
				await execAsync( sshInjectCommand )
				// Clean generated dump
				await execAsync( sshCleanCommand )
			}
			catch (e) {
				loader(`Unable to push DB to ${writeTo}`, 'error')
				console.error( e )
				process.exit(1)
			}

		}

		loader(`Pushed DB to ${writeTo}`)
	}
	// process.exit();

	// ------------------------------------------------------------------------- SYNC DATA

	if ( whatToSync !== 'database' )
	{
		// console.log(readFromEnv)
		// console.log(writeToEnv)

		// Get sync mode and remote env info
		let remoteEnv
		let syncMode
		if ( readFromEnv.name === 'local' ) {
			remoteEnv = writeToEnv.files
			syncMode = 'push'
		}
		else if ( writeToEnv.name === 'local' ) {
			remoteEnv = readFromEnv.files
			syncMode = 'pull'
		}
		else
			nicePrint(`{b/r}Fatal error, missing local env`, { code: 99 })

		// console.log({ remoteEnv, syncMode })

		for ( const syncPath of project.config.sync )
		{
			// Generate SSH command with port
			let sshCommand = 'ssh';
			if ( remoteEnv.port )
				sshCommand += ' -p '+remoteEnv.port;

			// Generate rsync command
			let rsyncCommands = [
				`rsync -e "${ sshCommand }"`,
				`-qrtc -4 --delete --progress`
			]

			// Generate remote part
			const remotePath = trailing(remoteEnv.root, true) + leading(trailing(syncPath, false), false)
			const remoteAddress = `${remoteEnv.user}@${remoteEnv.host}:${remotePath}`

			// Organize remote and local for sync mode
			if ( syncMode === 'push' )
				rsyncCommands = [ ...rsyncCommands, trailing(syncPath, true), remoteAddress ]
			else if ( syncMode === 'pull' )
				rsyncCommands = [ ...rsyncCommands, trailing(remoteAddress, true), syncPath ]

			// Concat full command
			const command = rsyncCommands.join(' ')

			// console.log({ syncPath, command });

			// Execute command and check errors
			const loader = printLoaderLine(`Syncing ${syncPath}`)
			try {
				await execAsync( command, 0 );
			}
			catch ( e ) {
				// Get first line of error
				const firstLine = e.toString().split('\n')[0].toLowerCase()

				// Distant path not found, this is not critical, just warn
				if ( firstLine.indexOf('change_dir') !== -1 && firstLine.indexOf('(2)') ) {
					loader(`Path ${syncPath} not found on ${remoteEnv.host}, skipped`, 'warning')
					continue;
				}
				// Something else happened, critical
				else {
					loader(`Unable to sync ${syncPath}`, 'error')
					console.error(e)
					process.exit(1);
				}
			}

			loader(`Synced ${syncPath}`)
		}
	}

	// ------------------------------------------------------------------------- FINISH

	//nicePrint(`{b/g} Sync complete 👍`)
}

// ----------------------------------------------------------------------------- EXPORTS

module.exports = {
	projectSync
}