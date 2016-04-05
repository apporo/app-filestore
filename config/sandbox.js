module.exports = {
  bridges: {
    filestoreMongodbWrapper: {
      mongodb: {
        connection_options: {
          host: '127.0.0.1',
          port: '27017',
          name: 'filestore'
        },
        cols: {
          FILE: 'files'
        }
      }
    }
  },
  plugins: {
    appFilestore: {
      contextPath: '/filestore'
    }
  }
};
