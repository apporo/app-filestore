module.exports = require('devebot').registerLayerware(__dirname, [
  'app-tracelog',
  'app-webweaver'
], [
  'devebot-co-mongojs'
]);
