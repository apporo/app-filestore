'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const mkdirp = require('mkdirp');
const mv = require('mv');
const uuid = require('uuid');

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');
const debuglog = Devebot.require('pinbug')('app-filestore:handler');

function FilestoreHandler(params) {
  params = params || {};

  let self = this;
  let LX = params.loggingFactory.getLogger();

  let pluginCfg = params.sandboxConfig || {};
  let contextPath = pluginCfg.contextPath || '/filestore';

  let uploadDir = pluginCfg.uploadDir;
  let thumbnailDir = pluginCfg.thumbnailDir || uploadDir;

  let mongoManipulator = params["mongojs#manipulator"];

  /**
   * 
   * @param {*} args
   *   fileType: 'path', 'stream' or 'base64'
   *   fileSource: url, stream, or base64 String
   *   fileInfo: (size, name, path. ...)
   */
  this.saveFile = function(args) {
    let {fileId, fileType, fileSource, fileInfo} = args || {};
    if (debuglog.enabled) {
      debuglog(' - saveFile: %s', JSON.stringify(args, null, 2));
    }

    fileId = fileId || uuid.v4();
    let fileName = fileInfo.name || fileId;
    let ctx = {};

    return Promise.resolve().then(function(result) {
      if (lodash.isEmpty(fileInfo)) {
        return Promise.reject('invalid_upload_fields');
      }

      fileInfo.fileId = fileId;
      fileInfo.status = 'intermediate';

      return mongoManipulator.updateDocument(
        pluginCfg.collections.FILE,
        { fileId: fileId }, fileInfo, { multi: true, upsert: true });
    }).then(function() {
      ctx.uploadDirPath = path.join(uploadDir, fileId);
      return Promise.promisify(mkdirp)(ctx.uploadDirPath);
    }).then(function() {
      switch(fileType) {
        case 'path':
        return Promise.promisify(function(done) {
          // fileSource is the path of temporary file in this scenario
          mv(fileSource, path.join(ctx.uploadDirPath, fileName), function(err) {
            done(err);
          });
        })();
        case 'base64':
        let fs_writeFile = Promise.promisify(fs.writeFile, {context: fs});
        return fs_writeFile(path.join(ctx.uploadDirPath, fileName), fileSource, {
          encoding: 'base64'
        });
      }
    }).then(function() {
      fileInfo.path = path.join(ctx.uploadDirPath, fileName);
      fileInfo.status = 'ok';
      return mongoManipulator.updateDocument(
        pluginCfg.collections.FILE,
        { fileId: fileId }, fileInfo, { multi: true, upsert: false });
    }).then(function() {
      if (debuglog.enabled) {
        debuglog(' - the /upload has been successful.');
      }
      let returnInfo = {};
      returnInfo['fileId'] = fileId;
      returnInfo['fileUrl'] = '/filestore/download/' + fileId;
      return returnInfo;
    });
  }
};

FilestoreHandler.referenceList = ["mongojs#manipulator"]

module.exports = FilestoreHandler;
