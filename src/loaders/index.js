const expressLoader = require('./express');
const dependencyInjectorLoader = require('./dependency-injector');
const Logger = require('./logger');
const RepoService = require('../services/repo');
const RepoModel = require('../models/repo');

module.exports = async ({ app, pathToRepos }) => {
  await dependencyInjectorLoader({
    services: [
      {
        name: 'RepoService',
        service: RepoService(pathToRepos),
      },
      {
        name: 'RepoModel',
        service: RepoModel(pathToRepos),
      },
      {
        name: 'ChildProcess',
        service: require('child_process'),
      },
      {
        name: 'logger',
        service: Logger,
      },
    ],
  });
  Logger.info('Dependency Injector loaded');

  await expressLoader({ app });
  Logger.info('Express loaded');
};
