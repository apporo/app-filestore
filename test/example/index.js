'use strict';

var devebot = require('devebot').parseArguments(require.main === module);
var path = require('path');

var app = devebot.launchApplication({
  appRootPath: __dirname
}, [{
  name: 'app-filestore',
  path: path.join(__dirname, '../../index.js')
}]);

if (require.main === module) {
  app.server.start();
  const stop = function() {
    app.server.stop().then(function() {
      console.log("The server has been stopped.");
      process.exit(0);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGQUIT", stop);
  process.on("SIGTERM", stop);
}

module.exports = app;
