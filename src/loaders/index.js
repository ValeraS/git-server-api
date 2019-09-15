const expressLoader = require('./express');
const dependencyInjectorLoader = require('./dependency-injector');
const Logger = require('./logger');

module.exports = async ({ app, ...args }) => {
  await dependencyInjectorLoader(args);
  Logger.info('Dependency Injector loaded');

  await expressLoader({ app });
  Logger.info('Express loaded');
};
