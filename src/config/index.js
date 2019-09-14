require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  api: {
    prefix: process.env.API_PREFIX || '/api',
  },
  logging: {
    verbose: process.env.VERBOSE == 1 || true,
  },
};
