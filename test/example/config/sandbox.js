var path = require('path');

var contextPath = '/filestore';

module.exports = {
  application: {
    contextPath: contextPath
  },
  plugins: {
    appFilestore: {
      uploadDir: path.join(__dirname, '../data')
    },
    appWebweaver: {
    }
  }
};
