const { Container } = require('typedi');
const path = require('path');

const MAGIC_GIT_FIRST_PARENT = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function Repo(repoId, gitRunner) {
  this._repoId = repoId;
  this._gitRunner = gitRunner;
  this._env = {};
}

Repo.prototype._maxCommitCount = 10;

Repo.prototype.commits = async function(
  commitHash,
  skip = 0,
  maxCount = this._maxCommitCount
) {
  const commitCount = parseInt(
    await this._gitRunner.getOutput(['rev-list', commitHash, '--count']),
    10
  );
  const commits = await this._gitRunner.getOutput([
    'log',
    commitHash,
    `--skip=${skip}`,
    `--max-count=${Math.min(maxCount, this._maxCommitCount)}`,
    '--format=%H\t%aI\t%an\t%s',
  ]);

  return { commits, commitCount };
};

Repo.prototype.diff = async function(commitHash) {
  const parents = await this._gitRunner.getOutput([
    'log',
    '-1',
    '--format=%P',
    commitHash,
  ]);
  const firstParent = /\s*/.test(parents)
    ? MAGIC_GIT_FIRST_PARENT
    : parents.split(/\s+/)[0];
  const task = await this._gitRunner.run([
    'diff',
    `${firstParent}..${commitHash}`,
  ]);
  return {
    done: task.done,
    stream: task.process.stdout,
  };
};

Repo.prototype.tree = function(commitHash, pathToFile) {
  return this._gitRunner.getOutput(['ls-tree', `${commitHash}:${pathToFile}`]);
};

Repo.prototype.blob = async function(commitHash, pathToFile) {
  const task = await this._gitRunner.run([
    'show',
    `${commitHash}:${pathToFile}`,
  ]);
  return {
    done: task.done,
    stream: task.process.stdout,
  };
};

function GitRunner(baseDir) {
  this._baseDir = baseDir;
  this._runQueue = [];
}

GitRunner.prototype.run = function(command, opts = {}) {
  const result = deferred();
  this._runQueue.push([command, opts, result.resolve]);
  this._schedule();
  return result.done;
};

GitRunner.prototype.getOutput = async function(command, opts = {}) {
  const task = await this.run(command, opts);
  const stdOut = [];
  task.process.stdout.on('data', buffer => stdOut.push(buffer));
  await task.done;
  return Buffer.concat(stdOut).toString('utf-8');
};

GitRunner.prototype._command = 'git';
GitRunner.prototype._schedule = function() {
  if (!!this._childProcess || this._runQueue.length === 0) {
    return;
  }

  const [command, opts, callback] = this._runQueue.shift();

  const ChildeProcess = Container.get('ChildProcess');
  const spawned = ChildeProcess.spawn(this._command, command.slice(0), {
    cwd: this._baseDir,
    env: this._env,
    windowsHide: true,
  });

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

    process.nextTick(this._schedule.bind(this));
    return result.done;
  });

  const result = { process: spawned, done: resultPromise };

  callback(result);
};

GitRunner.prototype._fail = function(err) {
  Container.get('logger').info('Error on run git command', err);
  this._runQueue.length = 0;
};

function RepoModel(pathToRepos) {
  this._pathToRepos = pathToRepos;
}

RepoModel.prototype.get = function(repoId) {
  const runner = new GitRunner(path.resolve(this._pathToRepos, repoId));
  return new Repo(repoId, runner);
};

RepoModel.prototype.add = function(repoId, url) {
  const runner = new GitRunner(this._pathToRepos);
  return runner.getOutput(['clone', url, repoId]);
};

function deferred() {
  const d = {};
  d.done = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return d;
}

module.exports = pathToRepos => new RepoModel(pathToRepos);
