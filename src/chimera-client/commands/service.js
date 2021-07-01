

// ----------------------------------------------------------------------------- LIST

async function list ()
{
	console.log('LIST')
}

// ----------------------------------------------------------------------------- START

async function start ()
{
	// TODO : Call setup.sh if it exists
	console.log('START')
}

// ----------------------------------------------------------------------------- STOP

async function stop ()
{
	console.log('STOP')
}

// ----------------------------------------------------------------------------- EXPORTS API

module.exports = {
	start,
	stop,
}