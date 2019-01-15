module.exports = {
  LOG_TYPES: {
    NONE: 0,
    ERROR: 1,
    NORMAL: 2,
    DEBUG: 3,
    FFDEBUG: 4,
  },
  setLogType: () => undefined,
  log: (...args) => {
    console.log(...args);
  },
  error: (...args) => {
    console.log(...args);
  },
  debug: (...args) => {
    console.log(...args);
  },
  warn: (...args) => {
    console.log(...args);
  },
  ffdebug: (...args) => {
    console.log('[ffmpeg]', ...args);
  },
};
