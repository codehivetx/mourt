const Configstore = require('configstore');
const {name} = require('../package.json');

module.exports = () => new Configstore(name);
