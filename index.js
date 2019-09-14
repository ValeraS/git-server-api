const fs = require('fs');
const path = require('path');

const startServer = require('./src/server');

let pathToRepos = process.argv[2];
if (!pathToRepos) {
  console.error('Path to repos is not provided');
  process.exit(1);
}

pathToRepos = path.resolve(pathToRepos);
fs.stat(pathToRepos, (err, stats) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  if (!stats.isDirectory()) {
    console.error(`Path ${pathToRepos} should be a directory`);
    process.exit(1);
  }

  startServer(pathToRepos);
});
