const Configstore = require('configstore');
// Compiled output lives in dist/lib/, so the package.json sits two levels up.
const { name } = require('../../package.json');

module.exports = () => new Configstore(name);
