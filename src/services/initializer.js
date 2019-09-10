'use strict';

function Service (params = {}) {
  const { packageName, sandboxConfig, errorManager } = params;

  errorManager.register(packageName, {
    errorCodes: sandboxConfig.errorCodes
  });
}

Service.referenceHash = {
  errorManager: 'app-errorlist/manager'
}

module.exports = Service;
