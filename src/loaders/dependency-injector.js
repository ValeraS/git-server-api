const { Container } = require('typedi');
const Logger = require('./logger');
const RepoService = require('../services/repo');
const { RepoModel, Repo, GitRunner } = require('../models/repo');

function containerWrapper(classFunction, container) {
  return (...args) => new classFunction(...args, container);
}

module.exports = ({ pathToRepos }) => {
  try {
    Container.set('logger', Logger);
    Container.set('ChildProcess', require('child_process'));
    Container.set('GitRunner', containerWrapper(GitRunner, Container));
    Container.set('Repo', containerWrapper(Repo, Container));
    Container.set('RepoModel', new RepoModel(pathToRepos, Container));
    Container.set('RepoService', new RepoService(Container));
  } catch (err) {
    Logger.error('Error on dependency injector loader: %o', err);
    throw err;
  }
};
