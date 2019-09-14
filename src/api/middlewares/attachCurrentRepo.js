const { Container } = require('typedi');

/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {*} next
 */
async function attachCurrentRepo(req, res, next) {
  const Logger = Container.get('logger');
  try {
    const service = Container.get('RepoService');
    const repoId = req.params.repositoryId;
    const repo = await service.getRepo(repoId);
    if (req.method === 'POST' && !req.param[0]) {
      // add repo request
      if (repo) {
        Logger.info(`Repo ${repoId} exists`);
        return res
          .status(400)
          .json({ errors: { message: `Repo ${repoId} exists` } });
      }
    } else if (!repo) {
      Logger.info(`Repo ${repoId} does not exist`);
      return res
        .status(404)
        .json({ errors: { message: `Repo ${repoId} does not exist` } });
    }
    res.locals.repo = repo;
    res.locals.repoId = repoId;
    next();
  } catch (err) {
    Logger.error(err);
    next(err);
  }
}

module.exports = attachCurrentRepo;
