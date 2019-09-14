const express = require('express');
const config = require('./config');
const loaders = require('./loaders');
const Logger = require('./loaders/logger');

module.exports = async pathToRepos => {
  const app = express();

  await loaders({ app, pathToRepos });

  app.listen(config.port, err => {
    if (err) {
      Logger.error(err);
      process.exit(1);
      return;
    }
    Logger.info(`Server listening on port ${config.port}`);
  });
};
