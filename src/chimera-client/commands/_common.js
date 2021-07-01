
const Preferences = require('preferences')

const preferences = new Preferences('zouloux.chimera-client', {
	ready: false
}, {
	encrypt: false
})

function getPreferences () {
	return preferences
}

module.exports = {
	getPreferences,
}