'use strict';

const slugify = require('./slugify');

function StringUtil () {
  this.slugify = function (str) {
    return slugify(str, {
      locale: 'vi',
      lower: true
    });
  }
}

module.exports = new StringUtil();
