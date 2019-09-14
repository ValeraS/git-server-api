const { Router } = require('express');
const gitApi = require('./routes/git-api');

module.exports = () => {
  const app = Router();

  gitApi(app);

  return app;
};
