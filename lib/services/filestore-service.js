'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var fs = require('fs');
var os = require('os');

var easyimage = require('easyimage');
var formidable = require('formidable');
var mime = require('mime');
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
    return params.sandboxName;
  };
  
  self.logger = params.loggingFactory.getLogger();
  
  debuglog(' - attach plugin app-filestore into app-webserver');

  var cfgFilestore = lodash.get(params, ['sandboxConfig', 'plugins', 'appFilestore'], {});
  var contextPath = cfgFilestore.contextPath || '/filestore';

  var tmpRootDir = os.tmpdir() + '/devebot/filestore';
  var uploadDir = cfgFilestore.uploadDir;
  var thumbnailDir = cfgFilestore.thumbnailDir || uploadDir;

  var webserverTrigger = params.webserverTrigger;
  var express = webserverTrigger.getExpress();
  var position = webserverTrigger.getPosition();

  var app = express();

  app.route([
    '/picture/:fileId/:width/:height',
    '/picture/:fileId/:width/:height/:filename'
  ]).get(function(req, res, next) {
    var box = {};
    Promise.resolve().then(function() {
      if (debuglog.isEnabled) {
        debuglog(' - /picture/%s/%s/%s is request', 
            req.params.fileId, req.params.width, req.params.height);
      }
      
      if (lodash.isEmpty(req.params.fileId)) {
        return Promise.reject('fileId_is_empty');
      }
      if (lodash.isEmpty(req.params.width)) {
        return Promise.reject('width_is_empty');
      }
      if (lodash.isEmpty(req.params.height)) {
        return Promise.reject('height_is_empty');
      }

      box.fileId = req.params.fileId;
      box.width = req.params.width;
      box.height = req.params.height;

      return params.filestoreMongodbWrapper.findOneDocument(
        params.filestoreMongodbWrapper.mongo_cols.FILE, { 
          fileId: req.params.fileId,
          status: 'ok'
        });
    }).then(function(fileInfo) {
      if (lodash.isEmpty(fileInfo) || lodash.isEmpty(fileInfo.name)) {
        fileInfo = {
          name: 'no-image.png',
          path: path.join(__dirname, '../../data/no-image.png')
        }
        box.originFile = path.join(__dirname, '../../data/no-image.png');
      } else {
        box.originFile = path.join(uploadDir, box.fileId, fileInfo.name);
      }

      box.fileInfo = fileInfo;
      box.thumbnailFile = path.join(thumbnailDir, box.fileId, util.format('thumbnail-%sx%s', box.width, box.height));

      return Promise.promisify(function(done) {
        fs.stat(box.thumbnailFile, function(err, stats) {
          if (!err) return done(null, box.thumbnailFile);
          easyimage.rescrop({
            src: box.originFile,
            dst: box.thumbnailFile,
            width: box.width,
            height: box.height,
            fill: true
          }).then(
            function(image) {
              debuglog(' - Converted: ' + image.width + ' x ' + image.height);
              done(null, box.thumbnailFile);
            },
            function (err) {
              debuglog(' - Error on creating thumbnail: %s', err);
              done(err);
            }
          );
        });  
      })();
    }).then(function(thumbnailFile) {
      var filename = box.fileInfo.name;
      var mimetype = mime.lookup(thumbnailFile);
      if (debuglog.isEnabled) {
        debuglog(' - filename: %s', filename);
        debuglog(' - mimetype: %s', mimetype);
      }
      res.setHeader('Content-disposition', 'attachment; filename=' + filename);
      res.setHeader('Content-type', mimetype);
      var filestream = fs.createReadStream(thumbnailFile);
      filestream.on('end', function() {
        if (debuglog.isEnabled) {
          debuglog(' - the thumbnail has been full-loaded');
        }
      });
      filestream.pipe(res);
    }).catch(function(err) {
      res.status(404).send('Error: ' + JSON.stringify(err));
    });
  });

  app.route(['/download/:fileId', '/download/:fileId/:filename']).get(function(req, res, next) {
    Promise.resolve().then(function() {
      if (debuglog.isEnabled) {
        debuglog(' - /download/:fileId is request: %s', req.params.fileId);
      }
      if (lodash.isEmpty(req.params.fileId)) {
        return Promise.reject('fileId_is_empty');
      }
      return params.filestoreMongodbWrapper.findOneDocument(
        params.filestoreMongodbWrapper.mongo_cols.FILE, { 
          fileId: req.params.fileId,
          status: 'ok'
        });
    }).then(function(fileInfo) {
      if (lodash.isEmpty(fileInfo)) {
        return Promise.reject('fileId_not_found');
      }
      var filename = fileInfo.name || path.basename(fileInfo.path);
      var filepath = path.join(uploadDir, fileInfo.fileId, fileInfo.name);
      var mimetype = mime.lookup(fileInfo.path);
      if (debuglog.isEnabled) {
        debuglog(' - filename: %s', filename);
        debuglog(' - filepath: %s', filepath);
        debuglog(' - mimetype: %s', mimetype);
      }
      res.setHeader('Content-disposition', 'attachment; filename=' + filename);
      res.setHeader('Content-type', mimetype);
      var filestream = fs.createReadStream(filepath);
      filestream.on('end', function() {
        if (debuglog.isEnabled) {
          debuglog(' - the file has been full-loaded');  
        }
      });
      filestream.pipe(res);
    }).catch(function(err) {
      res.status(404).send('Error: ' + JSON.stringify(err));
    });
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

      ctx.fileId = result.fields.fileId || uuid.v4();
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
      var returnInfo = {};
      returnInfo[ctx.apifilename || 'fileId'] = ctx.fileId;
      returnInfo['fileUrl'] = '/filestore/download/' + ctx.fileId;
      res.json(returnInfo);
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
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "generalConfig": {
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
