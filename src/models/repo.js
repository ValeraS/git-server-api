const path = require('path');
const fs = require('fs');
const util = require('util');
const rimraf = util.promisify(require('rimraf'));

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const MAGIC_GIT_FIRST_PARENT = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function Repo(repoId, gitRunner, container) {
  this._repoId = repoId;
  this._gitRunner = gitRunner;
  this._env = {};
  this._logger = container.get('logger');
}

Object.defineProperty(Repo.prototype, 'repoId', {
  get: function() {
    return this._repoId;
  },
});

Repo.prototype.log = function(options) {
  return this._run('log', options);
};

Repo.prototype.diff = function(options) {
  return this._run('diff', options);
};

Repo.prototype.revList = function(options) {
  return this._run('rev-list', options);
};

Repo.prototype.tree = function(options) {
  return this._run('ls-tree', options);
};

Repo.prototype.show = function(options) {
  return this._run('ls-tree', options);
};

Repo.prototype.grep = function(options) {
  return this._run('grep', options);
};

Repo.prototype._run = function(command, options, opts = {}) {
  const cmd = [command];
  if (Array.isArray(options)) {
    cmd.push(...options);
  }
  return this._gitRunner.run(cmd, opts);
};

function GitRunner(baseDir, container) {
  this._baseDir = baseDir;
  this._runQueue = [];
  this._logger = container.get('logger');
  this._childProcess = container.get('ChildProcess');
}

GitRunner.prototype.run = function(command, opts = {}) {
  const result = deferred();
  this._runQueue.push([command, opts, result.resolve]);
  this._schedule();
  const deferredTask = result.done;
  deferredTask.getOutput = () => this._getOutput(deferredTask);
  return deferredTask;
};

GitRunner.prototype._getOutput = async function(deferredTask) {
  const task = await deferredTask;
  const stdOut = [];
  task.process.stdout.on('data', buffer => stdOut.push(buffer));
  await task.done;
  return Buffer.concat(stdOut).toString('utf-8');
};

GitRunner.prototype._command = 'git';
GitRunner.prototype._schedule = function() {
  if (!!this._spawned || this._runQueue.length === 0) {
    return;
  }

  const [command, opts, callback] = this._runQueue.shift();

  const spawned = (this._spawned = this._childProcess.spawn(
    this._command,
    command.slice(0),
    {
      cwd: this._baseDir,
      env: this._env,
      windowsHide: true,
    }
  ));

  const processResult = deferred();

  const stdErr = [];
  spawned.on('error', err => {
    stdErr.push(Buffer.from(err.stack, 'ascii'));
  });

  spawned.stderr.on('data', buffer => {
    stdErr.push(buffer);
  });

  const onFinish = exitCode => {
    processResult.resolve(exitCode);
  };
  spawned.on('close', onFinish);
  spawned.on('exit', onFinish);

  const resultPromise = processResult.done.then(async exitCode => {
    const result = deferred();
    const done = err => {
      if (err) {
        this._fail(err);
        result.reject(new Error(err));
      }
      result.resolve();
    };

    if (exitCode && opts.onError) {
      opts.onError(exitCode, Buffer.concat(stdErr).toString('utf-8'), done);
    } else if (exitCode) {
      done(Buffer.concat(stdErr).toString('utf-8'));
    } else {
      done();
    }

    delete this._spawned;

    process.nextTick(this._schedule.bind(this));
    return result.done;
  });

  const result = { process: spawned, done: resultPromise };

  callback(result);
};

GitRunner.prototype._fail = function(err) {
  this._logger.info('Error on run git command', err);
  this._runQueue.length = 0;
};

function RepoModel(pathToRepos, container) {
  this._pathToRepos = pathToRepos;
  this._repoFactory = container.get('Repo');
  this._gitRunnerFactory = container.get('GitRunner');
  this._logger = container.get('logger');
}

RepoModel.prototype.MAGIC_GIT_FIRST_PARENT = MAGIC_GIT_FIRST_PARENT;

RepoModel.prototype.get = function(repoId) {
  const runner = this._gitRunnerFactory(
    path.resolve(this._pathToRepos, repoId)
  );
  return this._repoFactory(repoId, runner);
};

RepoModel.prototype.add = function(repoId, url) {
  const runner = this._gitRunnerFactory(this._pathToRepos);
  return runner.run(['clone', url, repoId]).getOutput();
};

RepoModel.prototype.delete = async function(repo) {
  const pathToRepo = path.resolve(this._pathToRepos, repo.repoId);
  await rimraf(pathToRepo);
};

RepoModel.prototype.getRepoList = async function() {
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
};

function deferred() {
  const d = {};
  d.done = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return d;
}

module.exports = {
  Repo,
  RepoModel,
  GitRunner,
};
