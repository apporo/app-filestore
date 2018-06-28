var path = require('path');

var contextPath = '/example';

module.exports = {
  application: {
    contextPath: contextPath
  },
  plugins: {
    appFilestore: {
      contextPath: contextPath,
      uploadDir: path.join(__dirname, '../data')
    },
    appWebweaver: {
    }
  }
};
