'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');

function Servlet(params = {}) {
  const { mongoManipulator } = params;

  this.start = function() {
    return Promise.resolve();
  };

  this.stop = function() {
    return Promise.resolve();
  };
};

Servlet.referenceHash = {
  mongoManipulator: "mongojs#manipulator"
};

module.exports = Servlet;
