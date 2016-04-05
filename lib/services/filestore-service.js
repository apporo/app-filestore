'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var fs = require('fs');
var os = require('os');

var formidable = require('formidable');
var mkdirp = require('mkdirp');
var mv = require('mv');
var rimraf = require('rimraf');
var uuid = require('uuid');

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');

var debug = Devebot.require('debug');
var debuglog = debug('filestore:service');

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

  var tmpRootDir = os.tmpdir() + '/devebot/filestore';
  var uploadDir = cfgFilestore.uploadDir;

  var webserverTrigger = params.webserverTrigger;
  var express = webserverTrigger.getExpress();
  var position = webserverTrigger.getPosition();

  var app = express();

  app.route('/download').get(function(req, res, next) {
    
  });

  app.route('/upload').post(function(req, res, next) {
    if (debuglog.isEnabled) {
      debuglog(' - the /upload is requested ...');
    }

    var tmpId = uuid.v4();
    var ctx = {
      tmpDir: path.join(tmpRootDir, tmpId)
    };

    Promise.resolve().then(function() {
      if (debuglog.isEnabled) {
        debuglog(' - the tmpDir: %s', ctx.tmpDir);
      }
      return Promise.promisify(mkdirp)(ctx.tmpDir);
    }).then(function() {
      return Promise.promisify(function(done) {
        var result = { fields: {}, files: {} };

        var form = new formidable.IncomingForm();
        form.uploadDir = ctx.tmpDir;
        form.keepExtensions = true;
        form
          .on('field', function(field, value) {
            debuglog(' - formidable trigger a field: %s', field);
            result.fields[field] = value;
          })
          .on('file', function(field, value) {
            debuglog(' - formidable trigger a file: %s', field);
            result.files[field] = value;
          })
          .on('end', function() {
            debuglog(' -> upload has done');
            done(null, result);
          })
          .on('error', function(err) {
            debuglog(' -> upload has error: %s', JSON.stringify(err));
            done(err);
          });

        form.parse(req);
      })();
    }).then(function(result) {
      if (debuglog.isEnabled) {
        debuglog(' - the /upload result: %s', JSON.stringify(result, null, 2));
      }

      ctx.fileId = result.fields.fileId;
      ctx.apifilename = result.fields.apifilename;
      ctx.fileInfo = lodash.pick(result.files.file || {}, ['size', 'path', 'name', 'type', 'mtime']);

      if (lodash.isEmpty(ctx.fileId) || lodash.isEmpty(ctx.fileInfo)) {
        return Promise.reject('invalid_upload_fields');
      }

      ctx.fileInfo.fileId = ctx.fileId;
      ctx.fileInfo.status = 'intermediate';

      return params.filestoreMongodbWrapper.updateDocument(
        params.filestoreMongodbWrapper.mongo_cols.FILE,
        { fileId: ctx.fileId }, ctx.fileInfo, { multi: true, upsert: true });
    }).then(function() {
      ctx.uploadDirPath = path.join(uploadDir, ctx.fileId);
      return Promise.promisify(mkdirp)(ctx.uploadDirPath);
    }).then(function(result) {
      return Promise.promisify(function(done) {
        mv(ctx.fileInfo.path, path.join(ctx.uploadDirPath, ctx.fileInfo.name), function(err) {
          done(err);
        });
      })();
    }).then(function() {
      ctx.fileInfo.path = path.join(ctx.uploadDirPath, ctx.fileInfo.name);
      ctx.fileInfo.status = 'ok';
      return params.filestoreMongodbWrapper.updateDocument(
        params.filestoreMongodbWrapper.mongo_cols.FILE,
        { fileId: ctx.fileId }, ctx.fileInfo, { multi: true, upsert: false });
    }).then(function() {
      if (debuglog.isEnabled) {
        debuglog(' - the /upload has been successful.');
      }
      res.json({});
    }).catch(function(err) {
      if (debuglog.isEnabled) {
        debuglog(' - error: %s; context: %s', JSON.stringify(err), JSON.stringify(ctx, null, 2));
      }
      res.status(404).json({ error: JSON.stringify(err) });
    }).finally(function() {
      if (ctx.tmpDir.match(tmpRootDir)) {
        rimraf(ctx.tmpDir, function(err) {
          if (err) {
            if (debuglog.isEnabled) {
              debuglog(' - the /upload cleanup has been error: %s', err);
            }
          } else {
            if (debuglog.isEnabled) {
              debuglog(' - the /upload cleanup has been successful');
            }
          }
        });
      }
    })
  });

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
    },
    "filestoreMongodbWrapper": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
