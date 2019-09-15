const path = require('path');
const fs = require('fs');
const util = require('util');
const rimraf = util.promisify(require('rimraf'));

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

function RepoService(pathToRepos, container) {
  this._pathToRepos = pathToRepos;
  this._logger = container.get('logger');
  this._repoModel = container.get('RepoModel');
}

RepoService.prototype.getRepos = async function() {
  return this._getRepos();
};

RepoService.prototype.getRepo = async function(repoId) {
  if (!(await this._repoExists(repoId))) {
    return null;
  }
  return this._repoModel.get(repoId);
};

RepoService.prototype.commits = async function(repo, commitHash, from, count) {
  const { commits, commitCount } = await repo.commits(commitHash, from, count);
  return {
    total: commitCount,
    commits: commits.split('\n').reduce((commits, el) => {
      if (el) {
        const [hash, date, author, subject] = el.split('\t');
        commits.push({
          hash,
          date,
          author,
          subject,
        });
      }
      return commits;
    }, []),
  };
};

RepoService.prototype.diff = async function(repo, commitHash) {
  return repo.diff(commitHash);
};

RepoService.prototype.tree = async function(repo, commitHash = '@', path = '') {
  const out = await repo.tree(commitHash, path);
  const tree = out.split('\n').reduce((records, el) => {
    if (!el) {
      return records;
    }
    const [metadata, filename] = el.split('\t');
    const [, type, hash] = metadata.split(/\s+/);
    records.push({
      filename,
      type,
      hash,
    });
    return records;
  }, []);
  return tree;
};

RepoService.prototype.blob = function(repo, commitHash, path) {
  return repo.blob(commitHash, path);
};

RepoService.prototype.countSymbols = function(repo) {
  return repo.countSymbols();
};

RepoService.prototype.addRepo = async function(repoId, repoUrl) {
  const urlObj = new URL(repoUrl);
  urlObj.protocol = 'http';
  const href = urlObj.href.replace(/^http/, 'git');
  this._logger.info(href);
  await this._repoModel.add(repoId, href);
  this._repoList.push(repoId);
};

RepoService.prototype.deleteRepo = async function(repoId) {
  this._repoList = this._repoList.filter(el => el !== repoId);
  const pathToRepo = path.resolve(this._pathToRepos, repoId);
  await rimraf(pathToRepo);
};

RepoService.prototype._repoExists = async function(repoId) {
  return (await this._getRepos()).includes(repoId);
};

RepoService.prototype._getRepos = async function() {
  if (this._repoList) {
    return this._repoList;
  }
  try {
    const fileNames = await readdir(this._pathToRepos);
    const dirs = (await Promise.all(
      fileNames.map(async filename => ({
        filename,
        stat: await stat(path.resolve(this._pathToRepos, filename)),
      }))
    )).reduce((dirs, fileStat) => {
      if (fileStat.stat.isDirectory()) {
        dirs.push(fileStat.filename);
      }
      return dirs;
    }, []);
    this._repoList = dirs;
    return dirs;
  } catch (err) {
    this._logger.error('Error on getRepos: %o', err);
    throw err;
  }
};

module.exports = RepoService;
