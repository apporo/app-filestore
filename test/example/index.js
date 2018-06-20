'use strict';

var devebot = require('devebot').parseArguments(require.main === module);
var path = require('path');

var app = devebot.launchApplication({
  appRootPath: __dirname
}, [{
  name: 'app-filestore',
  path: path.join(__dirname, '../../index.js')
}]);

if (require.main === module) app.server.start();

module.exports = app;
