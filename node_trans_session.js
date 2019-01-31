//
//  Created by Mingliang Chen on 18/3/9.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const EventEmitter = require('events');
const { spawn } = require('child_process');
const dateFormat = require('dateformat');
const mkdirp = require('mkdirp');
const fs = require('fs');
const os = require('os');

/**
 * Either takes an array or a string that we
 * turn into an array that spawn can accept
 * @param   {Mixed} val
 * @returns {String[]}
 */
function parseFlags(val) {
  if(Array.isArray(val)) {
    return val;
  } else if (typeof val === 'string') {
    return val.split(' ');
  } else {
    return [];
  }
}

/**
 * Attempts to evaluate the val if its a function
 * otherwise if its a string accept it. Lastly
 * if there neither of the above two matched
 * fallback to a string. This should let users
 * pass in custom functions to dyamically configure
 * the filename
 * @param {String|Function} val               Filename
 * @param {Object}          conf              Transcoding options
 * @param {String}          defaultValue      Default value
 */
function evaluateArgument(val, conf, defaultValue) {
  if (typeof val === 'function') {
    return val(conf);
  } else if (typeof val === 'string') {
    return val;
  } else {
    return defaultValue;
  }
}

class NodeTransSession extends EventEmitter {
  constructor(conf) {
    super();
    this.conf = conf;
  }

  /**
   * Smartly tries to resovle the directory where
   * the video should be stored
   */
  getDirectory() {
    if (typeof this.conf.directory === 'function') {
      return this.conf.directory(this.conf);
    } else if (typeof this.conf.directory === 'string') {
      return `${this.conf.directory}/${this.conf.stream}`;
    } else {
      return `${this.conf.mediaroot}/${this.conf.app}/${this.conf.stream}`;
    }
  }

  run() {
    let vc =  this.conf.vc ? this.conf.vc : 'copy';
    let ac = this.conf.args.ac == 10 ? 'copy' : this.conf.ac ? this.conf.ac : 'aac';
    let inPath = 'rtmp://127.0.0.1:' + this.conf.port + this.conf.streamPath;
    let ouPath = this.getDirectory();

    let argv = [];

    // Global
    argv = argv.concat([
      '-threads',
      (this.conf.threads || 0).toString(),
      '-loglevel',
      this.conf.loglevel || 'error',
      '-nostdin',
      '-hide_banner',
      '-nostats',
      '-y',
      '-analyzeduration',
      (this.conf.analyzeduration || 1000000).toString(),
    ]);

    // Input
    if (this.conf.inputFlags) {
      this.conf.inputFlags = parseFlags(this.conf.inputFlags);
      argv = argv.concat(this.conf.inputFlags);
    }
    argv = argv.concat([
      '-i',
      inPath,
      '-timeout',
      '30',
      '-c:v',
      vc,
      '-c:a',
      ac
    ]);

    // Output
    if (this.conf.outputFlags) {
      this.conf.outputFlags = parseFlags(this.conf.outputFlags);
      argv = argv.concat(this.conf.outputFlags);
    }

    // MP4
    if (typeof this.conf.mp4 === 'object' && this.conf.mp4 !== null && this.conf.mp4.enabled !== false) {
      const flags = parseFlags(this.conf.mp4.flags);
      const filename = `${ouPath}/${evaluateArgument(this.conf.mp4.filename, this.conf, 'index.mp4')}`;

      argv.push(
        '-map',
        '0:a?',
        '-map',
        '0:v?'
      );
      argv = argv.concat(flags);
      argv.push('-f', 'mp4', filename);

      Logger.log('[Transmuxing MP4] ' + this.conf.streamPath + ' to ' + filename);
    }

    // HLS
    if (typeof this.conf.hls === 'object' && this.conf.hls !== null && this.conf.hls.enabled !== false) {
      const flags = parseFlags(this.conf.hls.flags);;
      const filename = `${ouPath}/${evaluateArgument(this.conf.hls.filename, this.conf, 'index.m3u8')}`;

      argv.push(
        '-map',
        '0:a?',
        '-map',
        '0:v?'
      );
      argv = argv.concat(flags);
      argv.push('-f', 'hls', filename);

      Logger.log('[Transmuxing HLS] ' + this.conf.streamPath + ' to ' + filename);
    }

    // DASH
    if (typeof this.conf.dash === 'object' && this.conf.dash !== null && this.conf.dash.enabled !== false) {
      const flags = parseFlags(this.conf.dash.flags);
      const filename = `${ouPath}/${evaluateArgument(this.conf.dash.filename, this.conf, 'index.mpd')}`;

      argv.push(
        '-map',
        '0:a?',
        '-map',
        '0:v?'
      );
      argv = argv.concat(flags);
      argv.push('-f', 'dash', filename);

      Logger.log('[Transmuxing DASH] ' + this.conf.streamPath + ' to ' + filename);
    }
    mkdirp.sync(ouPath);

    Logger.info('[ffmpeg] %s %s', this.conf.ffmpeg, argv.join(' '));

    this.ffmpeg_exec = spawn(this.conf.ffmpeg, argv, {
      shell: true
    });

    const logFile = evaluateArgument(this.conf.logFile, this.conf);
    let log = null;
    if (typeof logFile === 'string') {
      Logger.info('[ffmpeg] Writing log to %s', logFile);
      // Open file in append mode
      log = fs.createWriteStream(logFile , {
        flags: 'a'
      });
      log.write(`[${new Date().toISOString()}] Starting trancoding session on ${os.hostname()} for ${this.conf.stream}\n`);
      log.write(`[${new Date().toISOString()}] Settings\n${JSON.stringify(this.conf, null, 2)}\n`);
      log.write(`[${new Date().toISOString()}] ${this.conf.ffmpeg} ${argv.join(' ')}\n`);
      // Capture stdout and stderr
      ['stderr', 'stdout'].forEach((std) => {
        this.ffmpeg_exec[std].pipe(log);
      });
    }

    this.ffmpeg_exec.on('error', (e) => {
      Logger.error(e);
      if (log) {
        log.write(`[${new Date().toISOString()}][ERROR]${e.toString()}\n`);
      }
    });

    this.ffmpeg_exec.stdout.on('data', (data) => {
      Logger.info(`[ffmpeg] ${data.toString().trim()}`);
    });

    this.ffmpeg_exec.stderr.on('data', (data) => {
      Logger.warn(`[ffmpeg] ${data.toString().trim()}`);
    });

    this.ffmpeg_exec.on('close', (code) => {
      Logger.log('[Transmuxing end] ' + this.conf.streamPath);
      this.emit('end');
      if (this.conf.removeOnExit) {
        fs.readdir(ouPath, function (err, files) {
          if (!err) {
            files.forEach((filename) => {
              if (filename.endsWith('.ts')
                || filename.endsWith('.m3u8')
                || filename.endsWith('.mpd')
                || filename.endsWith('.m4s')) {
                fs.unlinkSync(ouPath + '/' + filename);
              }
            })
          }
        });
      }
    });
  }

  end() {
    this.ffmpeg_exec.kill('SIGTERM');
  }
}

module.exports = NodeTransSession;
