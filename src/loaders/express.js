const bodyParser = require('body-parser');
const config = require('../config');
const routes = require('../api');

/**
 * @param {object} params
 * @param {express.Application} params.app
 */
module.exports = ({ app }) => {
  // Health Check endpoints
  app.get('/status', (req, res) => res.sendStatus(200));
  app.head('/status', (req, res) => res.sendStatus(200));

  // Middleware that transforms the raw string of req.body into json
  app.use(bodyParser.json());

  // Load API routes
  app.use(config.api.prefix, routes());

  // Catch 404 and forward to error handler
  app.use((req, res, next) => {
    const err = new Error('Not Found');
    err['status'] = 404;
    next(err);
  });

  // error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({
      errors: {
        message: err.message,
      },
    });
  });
};
