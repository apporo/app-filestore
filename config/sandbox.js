module.exports = {
  plugins: {
    appFilestore: {
      contextPath: '/filestore',
      collections: {
        FILE: 'files'
      },
      errorCodes: {
      }
    }
  },
  bridges: {
    mongojs: {
      appFilestore: {
        manipulator: {
          connection_options: {
            host: '127.0.0.1',
            port: '27017',
            name: 'filestore'
          }
        }
      }
    }
  }
};
