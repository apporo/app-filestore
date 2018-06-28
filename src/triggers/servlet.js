'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');

function FilestoreServlet(params) {
  params = params || {};

  let mongoManipulator = params["mongojs#manipulator"];

  this.start = function() {
    return Promise.resolve();
  };

  this.stop = function() {
    return Promise.resolve();
  };
};

FilestoreServlet.referenceList = [ "mongojs#manipulator" ];

module.exports = FilestoreServlet;
