const debug = require('debug');
const config = require('../config');

const debugNamespaces = [];

const error = debug('error');
error.log = console.error.bind(console);
debugNamespaces.push('error');

const info = debug('info');
info.log = console.log.bind(console);

const warn = debug('warn');
warn.log = console.warn.bind(console);

if (process.env.NODE_ENV !== 'production') {
  debugNamespaces.push('warn');
  if (config.logging.verbose) {
    debugNamespaces.push('info');
  }
}

debug.enable(debugNamespaces.join(','));

module.exports = {
  error,
  info,
  warn,
};
