const { Container } = require('typedi');
const Logger = require('./logger');

module.exports = ({ services }) => {
  try {
    services.forEach(({ name, service }) => Container.set(name, service));
  } catch (err) {
    Logger.error('Error on dependency injector loader: %o', err);
  }
};
