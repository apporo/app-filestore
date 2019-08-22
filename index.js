module.exports = require('devebot').registerLayerware(__dirname, [
  'app-errorlist',
  'app-tracelog',
  'app-webweaver'
], [
  'devebot-co-mongojs'
]);
