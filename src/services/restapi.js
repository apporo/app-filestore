'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const easyimage = require('easyimage');
const formidable = require('formidable');
const mime = require('mime');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const uuid = require('uuid');

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const debuglog = Devebot.require('pinbug')('app-filestore:service');

function FilestoreRestapi(params = {}) {
  let L = params.loggingFactory.getLogger();
  let T = params.loggingFactory.getTracer();

  let pluginCfg = params.sandboxConfig || {};
  let contextPath = pluginCfg.contextPath || '/filestore';

  let tmpRootDir = os.tmpdir() + '/devebot/filestore';
  let uploadDir = pluginCfg.uploadDir;
  let thumbnailDir = pluginCfg.thumbnailDir || uploadDir;

  let filestoreHandler = params["handler"];
  let mongoManipulator = params["mongojs#manipulator"];
  let webweaverService = params["app-webweaver/webweaverService"];
  let express = webweaverService.express;

  let filestoreRouter = express();

  filestoreRouter.route([
    '/picture/:fileId/:width/:height',
    '/picture/:fileId/:width/:height/:filename'
  ]).get(function(req, res, next) {
    let box = {};
    Promise.resolve().then(function() {
      if (debuglog.enabled) {
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

      return mongoManipulator.findOneDocument(
        pluginCfg.collections.FILE, { 
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
      let filename = box.fileInfo.name;
      let mimetype = mime.lookup(thumbnailFile);
      if (debuglog.enabled) {
        debuglog(' - filename: %s', filename);
        debuglog(' - mimetype: %s', mimetype);
      }
      res.setHeader('Content-disposition', 'attachment; filename=' + filename);
      res.setHeader('Content-type', mimetype);
      let filestream = fs.createReadStream(thumbnailFile);
      filestream.on('end', function() {
        if (debuglog.enabled) {
          debuglog(' - the thumbnail has been full-loaded');
        }
      });
      filestream.pipe(res);
    }).catch(function(err) {
      res.status(404).send('Error: ' + JSON.stringify(err));
    });
  });

  filestoreRouter.route([
    '/download/:fileId',
    '/download/:fileId/:filename'
  ]).get(function(req, res, next) {
    Promise.resolve().then(function() {
      if (debuglog.enabled) {
        debuglog(' - /download/:fileId is request: %s', req.params.fileId);
      }
      if (lodash.isEmpty(req.params.fileId)) {
        return Promise.reject('fileId_is_empty');
      }
      return mongoManipulator.findOneDocument(
        pluginCfg.collections.FILE, { 
          fileId: req.params.fileId,
          status: 'ok'
        });
    }).then(function(fileInfo) {
      if (lodash.isEmpty(fileInfo)) {
        return Promise.reject('fileId_not_found');
      }
      let filename = fileInfo.name || path.basename(fileInfo.path);
      let filepath = path.join(uploadDir, fileInfo.fileId, fileInfo.name);
      let mimetype = mime.lookup(fileInfo.path);
      if (debuglog.enabled) {
        debuglog(' - filename: %s', filename);
        debuglog(' - filepath: %s', filepath);
        debuglog(' - mimetype: %s', mimetype);
      }
      res.setHeader('Content-disposition', 'attachment; filename=' + filename);
      res.setHeader('Content-type', mimetype);
      let filestream = fs.createReadStream(filepath);
      filestream.on('end', function() {
        if (debuglog.enabled) {
          debuglog(' - the file has been full-loaded');  
        }
      });
      filestream.pipe(res);
    }).catch(function(err) {
      res.status(404).send('Error: ' + JSON.stringify(err));
    });
  });

  filestoreRouter.route('/upload').post(function(req, res, next) {
    if (debuglog.enabled) {
      debuglog(' - the /upload is requested ...');
    }

    let tmpId = uuid.v4();
    let ctx = {
      tmpDir: path.join(tmpRootDir, tmpId)
    };

    Promise.resolve().then(function() {
      if (debuglog.enabled) {
        debuglog(' - the tmpDir: %s', ctx.tmpDir);
      }
      return Promise.promisify(mkdirp)(ctx.tmpDir);
    }).then(function() {
      return Promise.promisify(function(done) {
        let result = { fields: {}, files: {} };

        let form = new formidable.IncomingForm();
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
      if (debuglog.enabled) {
        debuglog(' - the /upload result: %s', JSON.stringify(result, null, 2));
      }
      ctx.fileId = result.fields.fileId || uuid.v4();
      ctx.fileInfo = lodash.pick(result.files.data || {}, ['size', 'path', 'name', 'type', 'mtime']);
      ctx.fileType = 'path';
      ctx.fileSource = ctx.fileInfo.path;
      if (lodash.isEmpty(ctx.fileId) || lodash.isEmpty(ctx.fileInfo)) {
        return Promise.reject('invalid_upload_fields');
      }
      return filestoreHandler.saveFile(ctx);
    }).then(function(returnInfo) {
      if (debuglog.enabled) {
        debuglog(' - the file has been saved successfully: %s', JSON.stringify(returnInfo, null, 2));
      }
      returnInfo['fileUrl'] = path.join(contextPath, '/download/' + ctx.fileId);
      res.json(returnInfo);
      return returnInfo;
    }).catch(function(err) {
      if (debuglog.enabled) {
        debuglog(' - error: %s; context: %s', JSON.stringify(err), JSON.stringify(ctx, null, 2));
      }
      res.status(404).json({ error: JSON.stringify(err) });
    }).finally(function() {
      if (ctx.tmpDir.match(tmpRootDir)) {
        rimraf(ctx.tmpDir, function(err) {
          if (err) {
            if (debuglog.enabled) {
              debuglog(' - the /upload cleanup has been error: %s', err);
            }
          } else {
            if (debuglog.enabled) {
              debuglog(' - the /upload cleanup has been successful');
            }
          }
        });
      }
    });
  });

  this.getFilestoreLayer = function() {
    return {
      name: 'app-filestore-service',
      path: contextPath,
      middleware: filestoreRouter
    }
  }

  if (pluginCfg.autowired !== false) {
    webweaverService.push([
      this.getFilestoreLayer()
    ], pluginCfg.priority);
  }
};

FilestoreRestapi.referenceList = [
  "handler",
  "app-webweaver/webweaverService",
  "mongojs#manipulator"
]

module.exports = FilestoreRestapi;
