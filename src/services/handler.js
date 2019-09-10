'use strict';

const fs = require('fs');
const path = require('path');

const mkdirp = require('mkdirp');
const mv = require('mv');
const uuid = require('uuid');

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');

const stringUtil = require('../supports/string-util');

function Handler(params = {}) {
  const { loggingFactory, mongoManipulator } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  const pluginCfg = params.sandboxConfig || {};
  const contextPath = pluginCfg.contextPath || '/filestore';
  const uploadDir = pluginCfg.uploadDir;

  this.getFileUrls = function(fileIds = []) {
    return Promise.map(fileIds, function(fileId) {
      const r = mongoManipulator.findOneDocument(pluginCfg.collections.FILE, {fileId});
      return r.then(function(fileData) {
        if (lodash.isEmpty(fileData)) {
          return { fileId }
        } else {
          return lodash.pick(fileData, ['_id', 'fileId', 'fileUrl']);
        }
      })
    }, {concurrency: 4});
  }

  /**
   * 
   * @param {*} args
   *   fileId: UUID
   *   fileType: 'path', 'stream' or 'base64'
   *   fileSource: url, stream, or base64 String
   *   fileInfo: (size, name, path. ...)
   */
  this.saveFile = function(args = {}) {
    let {fileId, fileType, fileSource, fileInfo} = args;

    L.has('debug') && L.log('debug', ' - saveFile: %s', JSON.stringify(args, null, 2));

    fileId = fileId || uuid.v4();
    fileInfo = fileInfo || {};
    fileInfo.name = fileInfo.name || fileId;

    fileInfo.originalName = fileInfo.name;
    fileInfo.name = stringUtil.slugify(fileInfo.name);

    let fileName = fileInfo.name;
    let ctx = {};

    return Promise.resolve()
    .then(function(result) {
      fileInfo.fileId = fileId;
      fileInfo.status = 'intermediate';

      return mongoManipulator.updateDocument(
        pluginCfg.collections.FILE,
        { fileId: fileId }, fileInfo, { multi: true, upsert: true });
    })
    .then(function() {
      ctx.uploadDirPath = path.join(uploadDir, fileId);
      return Promise.promisify(mkdirp)(ctx.uploadDirPath);
    })
    .then(function() {
      switch(fileType) {
        case 'path':
        return Promise.promisify(function(done) {
          // fileSource is the path of temporary file in this scenario
          mv(fileSource, path.join(ctx.uploadDirPath, fileName), function(err) {
            done(err);
          });
        })();
        case 'base64':
        // fileSource is the file content in base64 format
        const fs_writeFile = Promise.promisify(fs.writeFile, {context: fs});
        fileSource = fileSource.replace(/^data:image\/[a-zA-Z0-9]*;base64,/, "");
        return fs_writeFile(path.join(ctx.uploadDirPath, fileName), fileSource, {
          encoding: 'base64'
        });
      }
    })
    .then(function() {
      fileInfo.path = path.join(ctx.uploadDirPath, fileName);
      fileInfo.fileUrl = path.join(contextPath, '/download/' + fileId);
      fileInfo.status = 'ok';
      return mongoManipulator.updateDocument(
        pluginCfg.collections.FILE,
        { fileId: fileId }, fileInfo, { multi: true, upsert: false });
    })
    .then(function() {
      const fileCollection = mongoManipulator.mongojs.collection(pluginCfg.collections.FILE);
      const findOne = Promise.promisify(fileCollection.findOne, { context: fileCollection });
      return findOne({ fileId: fileId });
    })
    .then(function(doc) {
      L.has('debug') && L.log('debug', T.toMessage({
        text: 'The /upload has been done successfully'
      }));
      let returnInfo = {};
      returnInfo['_id'] = doc._id;
      returnInfo['fileId'] = doc.fileId;
      returnInfo['fileUrl'] = doc.fileUrl;
      return returnInfo;
    });
  }
};

function base64MimeType(encoded) {
  var result = null;
  if (typeof encoded !== 'string') {
    return result;
  }
  var mime = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
  if (mime && mime.length) {
    result = mime[1];
  }
  return result;
}

Handler.referenceHash = {
  initializer: 'initializer',
  errorManager: 'app-errorlist/manager',
  mongoManipulator: "mongojs#manipulator"
};

module.exports = Handler;

