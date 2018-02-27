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
    Message.progress(message);
  }

  /**
   * Print Messages. Executed process.on('exit').
   */
  printMessages() {
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
  validateRootDirForInit() {
    let stat;
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
    return true;
  }
}

module.exports = MFWCommandPrototypeClass;
