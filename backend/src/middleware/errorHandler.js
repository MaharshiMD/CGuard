const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
};

module.exports = errorHandler;