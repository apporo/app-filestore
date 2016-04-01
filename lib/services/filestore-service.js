'use strict';

var events = require('events');
var util = require('util');
var path = require('path');

var lodash = require('devebot').pkg.lodash;
var debuglog = require('devebot').debug('filestore:service');

var Service = function(params) {
  debuglog(' + constructor begin ...');
  
  Service.super_.apply(this);

  params = params || {};

  var self = this;
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
  
  self.logger = params.loggingFactory.getLogger();
  
  debuglog(' - attach plugin app-filestore into app-webserver');

  var cfgFilestore = lodash.get(params, ['sandboxconfig', 'plugins', 'appFilestore'], {});
  var contextPath = cfgFilestore.contextPath || '/filestore';

  var webserverTrigger = params.webserverTrigger;
  var express = webserverTrigger.getExpress();
  var position = webserverTrigger.getPosition();

  var app = express();

  webserverTrigger.inject(app, contextPath, position.inRangeOfMiddlewares(), 'filestore');

  self.getServiceInfo = function() {
    return {};
  };

  self.getServiceHelp = function() {
    return {};
  };
  
  debuglog(' - constructor end!');
};

Service.argumentSchema = {
  "id": "filestoreService",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "sandboxconfig": {
      "type": "object"
    },
    "profileconfig": {
      "type": "object"
    },
    "generalconfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "webserverTrigger": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
