const Ceres = require('ceres-framework');

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
    Ceres.logger('NodeMediaServer').info(...args);
  },
  error: (...args) => {
    Ceres.logger('NodeMediaServer').error(...args);
  },
  debug: (...args) => {
    Ceres.logger('NodeMediaServer').debug(...args);
  },
  warn: (...args) => {
    Ceres.logger('NodeMediaServer').warn(...args);
  },
  ffdebug: (...args) => {
    Ceres.logger('NodeMediaServer').silly('[ffmpeg]', ...args);
  }
}
