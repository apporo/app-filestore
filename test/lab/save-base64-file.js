var fs = require('fs');
var path = require('path');
var app = require('../example/index');

app.getSandboxService = function(serviceName) {
  return this.server.invoke(function(injector) {
    return injector.lookup('sandboxManager').getSandboxService(serviceName);
  });
}

app.getSandboxService('app-filestore/handler').then(function(handler) {
  var fileBase64 = fs.readFileSync(path.join(__dirname, './images/logbeat.png')).toString('base64');
  false && console.log('file content in base64 format: \n%s', fileBase64);
  var ok = handler.saveFile({
    fileSource: fileBase64,
    fileInfo: {},
    fileType: 'base64'
  });
  return ok;
}).then(function(result) {
  console.log(result);
  return app.server.close();
});
