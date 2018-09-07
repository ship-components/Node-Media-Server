const Ceres = require('ceres-framework');

const logger = Ceres.logger('NodeMediaServer');

module.exports = {
  LOG_TYPES: {
    NONE: 0,
    ERROR: 1,
    NORMAL: 2,
    DEBUG: 3,
    FFDEBUG: 4
  },
  setLogType: () => undefined,
  log: (...args) => {
    logger.info(...args);
  },
  error: (...args) => {
    logger.error(...args);
  },
  debug: (...args) => {
    logger.debug(args);
  },
  ffdebug: (...args) => {
    logger.silly(args);
  }
}
