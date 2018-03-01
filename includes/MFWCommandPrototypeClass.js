'use strict';

const EventEmitter = require('events').EventEmitter;
const fs = require('fs-extra');
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('cross-spawn');
const path = require('path');
const prompt = require('prompt');
const CommonFunc = require('./common.js');

const Message = require('../includes/message.js');


class MFWCommandPrototypeClass extends EventEmitter {
  /**
   * Incapsulate logic for mfw-cli commands.
   * @constructor.
   * @param {object} settings
   *   - RootDirectory - resolved path to project directory.
   *   - envName - environment name.
   */
  constructor(settings) {
    super();
    if (process.argv.indexOf('--json') !== -1) {
      this.isJsonOutput = true;
    }
    this.isExiting = false;
    if (settings.RootDirectory) {
      this.RootDirectory = settings.RootDirectory;
    } else {
      this.RootDirectory = path.resolve(process.cwd());
    }
    this.messages = {
      ok: [],
      error: [],
      warning: [],
      unknown: [],
    }
    if (settings.envName) {
      this.envName = settings.envName;
    } else {
      this.envName = this.getEnvName();
    }
    if (this.envName != '') {
      this.progressMessage('Env:' + this.envName);
    }

    process.on('beforeExit', () => {
      // prevent multiple printMessages on multiple beforeExit calls.
      if (!this.isExiting) {
        this.isExiting = true;
        if (this.messages.error.length > 0) {
          process.exitCode = 1
        }
        this.printMessages();
      }
    });
  }

  /**
   * Get current environment name.
   *
   * @return {string} - enviroment name. Empty for default.
   */
  getEnvName() {
    let currentEnv;
    try {
      currentEnv = fs.readFileSync(this.RootDirectory + '/.env') + '';
      currentEnv = currentEnv.trim();
    } catch(e) {
      currentEnv = '';
    }
    return currentEnv;
  }
  /**
   * Set message.
   */
  message(type, message) {
    if (!this.messages[type]) {
      type = 'unknown';
    }
    this.messages[type].push(message);
  }

  /**
   * Print imidiate messages.
   */
  progressMessage(message) {
    if (!this.isJsonOutput) {
      Message.progress(message);
    }
  }

  /**
   * Print Messages. Executed process.on('exit').
   */
  printMessages() {
    if (this.isJsonOutput) {
      console.log(JSON.stringify(this.messages, null, 2));
      return;
    }
    for (let type in this.messages) {
      if (this.messages[type].length > 0) {
        for (let message of this.messages[type]) {
          Message[type](message);
        }
      }
    }
  }

  /**
   * Get package.json path based on current Enviroment.
   *
   * @return {string} - path to project package.json.
   */
  getPackageJSONPath() {
    let packageJSONFile = this.RootDirectory + '/package.json';
    if (this.envName != '') {
      packageJSONFile = this.RootDirectory + '/' + this.envName + '.package.json';
    }
    return packageJSONFile;
  }

  /**
   * Get package.json object.
   *
   * @return {object} - {env.}package.json parsed content.
   */
  getPackageJSON() {
    let packageJSON = '';
    try {
      packageJSON = JSON.parse(fs.readFileSync(this.getPackageJSONPath()));
    } catch (e) {
      this.message('error', e.message);
      console.log(e);
      packageJSON = {};
    }
    return packageJSON;
  }

  /**
   * Validate Root directory as a project directory..
   *
   * @return {boolean} true if valid.
   */
  validateRootDirForInit(fixMode) {
    let stat;
    // Check ROOT DIR.
    try {
      stat = fs.statSync(this.RootDirectory);
      if (!stat.isDirectory()) {
        this.message('error', 'Root dir: ' + this.RootDirectory + ' is not a directory');
        return false;
      }
      try {
        stat = fs.statSync(this.RootDirectory + '/.env');
        if (!stat.isFile()) {
          this.message('error', this.RootDirectory + '/.env is not a file');
          return false;
        }
      } catch(e) {
        // no .env file. All is good.
      }
    } catch(e) {
      this.message('ok', 'Creating ' + this.RootDirectory);
      fs.ensureDirSync(this.RootDirectory);
    }

    // Check services directory
    try {
      stat = fs.statSync(this.RootDirectory + '/services/');
      if (!stat.isDirectory()) {
        this.message('error', this.RootDirectory + '/services/ is not a directory');
        return false;
      }
    } catch(e) {
      this.message('ok', 'Creating ' + this.RootDirectory + '/services/');
      fs.ensureDirSync(this.RootDirectory + '/services/');
    }

    // Check configs directory
    try {
      stat = fs.statSync(this.RootDirectory + '/configs/');
      if (!stat.isDirectory()) {
        this.message('error', this.RootDirectory + '/configs/ is not a directory');
        return false;
      }
    } catch(e) {
      this.message('ok', 'Creating ' + this.RootDirectory + '/configs/');
      fs.ensureDirSync(this.RootDirectory + '/configs/');
    }

    // Check logs directory
    try {
      stat = fs.statSync(this.RootDirectory + '/logs/');
      if (!stat.isDirectory()) {
        this.message('error', this.RootDirectory + '/logs/ is not a directory');
        return false;
      }
    } catch(e) {
      this.message('ok', 'Creating ' + this.RootDirectory + '/logs/');
      fs.ensureDirSync(this.RootDirectory + '/logs/');
    }

    // Check pids directory
    try {
      stat = fs.statSync(this.RootDirectory + '/pids/');
      if (!stat.isDirectory()) {
        this.message('error', this.RootDirectory + '/pids/ is not a directory');
        return false;
      }
    } catch(e) {
      this.message('ok', 'Creating ' + this.RootDirectory + '/pids/');
      fs.ensureDirSync(this.RootDirectory + '/pids/');
    }

    if (fixMode !== true) {
      // Check if package.json exists.
      try {
        stat = fs.statSync(this.getPackageJSONPath());
        if (!stat.isFile()) {
          this.message('error', this.getPackageJSONPath() + ' is not a valid file');
          return false;
        }

        this.message('error', this.getPackageJSONPath() + ' exists already.');
        return false;

      } catch(e) {
        // no [env.]package.json file. All is good.
      }
    }
    return true;
  }

  /**
   * Validate Root directory as a project directory..
   *
   * @return {boolean} true if valid.
   */
  validateRootDir() {
    let stat;
    // Check ROOT DIR.
    let resultStatus = true;
    try {
      stat = fs.statSync(this.RootDirectory);
      if (!stat.isDirectory()) {
        this.message('error', 'Root dir: ' + this.RootDirectory + ' is not a directory');
        resultStatus = false;
      }
    } catch(e) {
      this.message('error', 'Root dir: ' + this.RootDirectory + ' does not exist');
      resultStatus = false;
    }

    // Check services directory
    try {
      stat = fs.statSync(this.RootDirectory + '/services/');
      if (!stat.isDirectory()) {
        this.message('error', 'Root dir: ' + this.RootDirectory + '/services/ is not a directory');
        resultStatus = false;
      }
    } catch(e) {
      this.message('error', 'Root dir: ' + this.RootDirectory + '/services/ does not exist');
      resultStatus = false;
    }

    // Check configs directory
    try {
      stat = fs.statSync(this.RootDirectory + '/configs/');
      if (!stat.isDirectory()) {
        this.message('error', 'Root dir: ' + this.RootDirectory + '/configs/ is not a directory');
        resultStatus = false;
      }
    } catch(e) {
      this.message('error', 'Root dir: ' + this.RootDirectory + '/configs/ does not exist');
      resultStatus = false;
    }

    // Check logs directory
    try {
      stat = fs.statSync(this.RootDirectory + '/logs/');
      if (!stat.isDirectory()) {
        this.message('error', 'Root dir: ' + this.RootDirectory + '/logs/ is not a directory');
        resultStatus = false;
      }
    } catch(e) {
      this.message('error', 'Root dir: ' + this.RootDirectory + '/logs/ does not exist');
      resultStatus = false;
    }

    // Check pids directory
    try {
      stat = fs.statSync(this.RootDirectory + '/pids/');
      if (!stat.isDirectory()) {
        this.message('error', 'Root dir: ' + this.RootDirectory + '/pids/ is not a directory');
        resultStatus = false;
      }
    } catch(e) {
      this.message('error', 'Root dir: ' + this.RootDirectory + '/pids/ does not exist');
      resultStatus = false;
    }

    // Check if package.json exists.
    try {
      stat = fs.statSync(this.getPackageJSONPath());
      if (!stat.isFile()) {
        this.message('error', this.getPackageJSONPath() + ' is not a valid file');
        resultStatus = false;
      } else {
        // Check if package.json is valid file.
        try {
          JSON.parse(fs.readFileSync(this.getPackageJSONPath()));
        } catch (e) {
          this.message('error', e + ' in file: ' + this.getPackageJSONPath());
          resultStatus = false;
        }
      }
    } catch(e) {
      this.message('error', this.getPackageJSONPath() + ' does not exist');
      resultStatus = false;
    }
    return resultStatus;
  }
  /**
   * Prepare module object.
   *
   * @param {string} module - service name.
   * @param {function} callback - callback when module prepared.
   */
  prepareModule(module, callback) {
    let packageJSON = this.getPackageJSON();
    if (packageJSON.services && packageJSON.services[module]) {
      let shortName = module;
      let sourceName = '';
      if (typeof packageJSON.services[shortName] !== 'string') {
        if (packageJSON.services[shortName].source) {
          sourceName = packageJSON.services[shortName].source;
        }
      } else {
        sourceName = packageJSON.services[shortName];
      }
      let moduleInfo = {
        full: sourceName,
        short: shortName,
        installDir: this.RootDirectory + '/services/' + shortName,
        envFile: this.RootDirectory + '/configs/' + shortName + '.env',
      }

      if (this.envName != '') {
        moduleInfo.envFile = this.RootDirectory + '/configs/' + this.envName
          + '.' + shortName + '.env';
      }
      return callback(moduleInfo);
    }

    fs.stat(module, (err, stats) => {
      if (!err) {
        module = path.resolve(module);
      }
      let nameArray = module.split('/');
      let shortName = nameArray.pop();

      if (!shortName || shortName == '') {
        shortName = nameArray.pop();
      }

      module = {
        full: module,
        short: shortName,
        installDir: this.RootDirectory + '/services/' + shortName,
        envFile: this.RootDirectory + '/configs/' + shortName + '.env',
      }
      if (this.envName != '') {
        module.envFile = this.RootDirectory + '/configs/' + this.envName
          + '.' + shortName + '.env';
      }
      callback(module);
    });
  }
}

module.exports = MFWCommandPrototypeClass;
