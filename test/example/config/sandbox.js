var path = require('path');

var contextPath = '/example';

module.exports = {
  plugins: {
    appFilestore: {
      contextPath: contextPath,
      uploadDir: path.join(__dirname, '../data')
    }
  }
};
