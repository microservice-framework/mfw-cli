'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const prompt = require('prompt');
const colors = require('colors/safe');
const Table = require('cli-table');
const pusage = require('pidusage')

const Message = require('../includes/message.js');
const tokenGenerate = require('./token-generate.js');
const CommonFunc = require('./common.js');

prompt.message = '';
/**
 * Incapsulate logic for mfw-cli commands.
 * @constructor.
 */
function MFWCliStatusClass(settings) {
  EventEmitter.call(this);
  var self = this;
  self.messages = {
    ok: [],
    error: [],
    warning: [],
    status: [],
    unknown: [],
  };
  self.isExiting = false;
  self.RootDirectory = settings.RootDirectory;
  self.envName = self.getEnvName();
}

util.inherits(MFWCliStatusClass, EventEmitter);

/**
 * get STATUS.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: microservice-router
 */
MFWCliStatusClass.prototype.check = function( module) {
  var self = this;
  self.module = module;

  self.on('isRootExists', self.isRootExists);
  self.on('isModuleExists', function(err, type, module) {
    if (err) {
      return self.emit('error', err.message, module.module);
    }
    if (!type) {
      return self.emit('error', 'Module does not exists.', module.module);
    }
    self.checkStatus(module);
  });
  self.checkRootDirectory();
}
/**
 * Process STATUS.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: microservice-router
 */
MFWCliStatusClass.prototype.process = function(module) {
  var self = this;
  process.on('beforeExit', function() {
    // prevent multiple printMessages on multiple beforeExit calls.
    if (!self.isExiting) {
      self.isExiting = true;
      self.printMessages();
    }
  });
  self.module = module;

  self.on('isRootExists', self.isRootExists);
  self.on('isModuleExists', function(err, type, module) {
    if (err) {
      return self.message('error', err.message);
    }
    if (!type) {
      return self.message('error', 'Module does not exists.');
    }
    self.checkProcessStatus(module);
  });
  self.checkRootDirectory();
}

/**
 * Check Project root directory. Emits isRootExists.
 */
MFWCliStatusClass.prototype.checkRootDirectory = function() {
  var self = this;
  fs.stat(self.RootDirectory, function(err, stats) {
    if (err) {
      return self.emit('isRootExists', null, false);
    }
    if (!stats.isDirectory()) {
      var err = new  Error(self.RootDirectory + ' is not a directory!');
      return self.emit('isRootExists', err, false);
    }
    self.emit('isRootExists', null, true);
  });
}

/**
 * Check module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.checkProcessStatus = function(module) {
  var self = this;
  var modulePackageJSON = false;
  try {
    modulePackageJSON = JSON.parse(fs.readFileSync(module.installDir + '/package.json'));
  } catch (e) {
    self.message('error', 'Failed to get status of ' + module.module);
    return self.message('error', e.message);
  }

  if (!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
    return self.message('error', 'Failed to get status ' + module.module + ' - no scripts defined');
  }


  module.package = modulePackageJSON;

  var listToCheck = [];
  for (var name in modulePackageJSON.scripts) {
    if (name.indexOf('status') != -1) {
      listToCheck.push({
        name: name,
        script: modulePackageJSON.scripts[name]
      });
    }
  }
  if (listToCheck.length == 0) {
    self.progressMessage(module.module + ' don\'t have status');
    return;
  }
  for (var i in listToCheck) {
    var item = listToCheck[i];
    self.processCommand(module, item);
  }
}

/**
 * Check module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.checkStatus = function(module) {
  var self = this;
  var modulePackageJSON = false;
  try {
    modulePackageJSON = JSON.parse(fs.readFileSync(module.installDir + '/package.json'));
  } catch (e) {
    self.emit('error', 'Failed to get status', module.module);
    return;
  }

  if (!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
    return self.emit('error', 'Failed to get status: no scripts defined', module.module);
  }

  var listToCheck = [];
  for (var name in modulePackageJSON.scripts) {
    if (name.indexOf('status') != -1) {
      listToCheck.push({
        name: name,
        script: modulePackageJSON.scripts[name]
      });
    }
  }
  if (listToCheck.length == 0) {
    self.emit('error', 'No status support', module.module);
    return;
  }

  for (var i in listToCheck) {
    var script = listToCheck[i];
    self.reportStatus(module, script);
  }
}

/**
 * Report module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.reportStatus = function(module, script) {
  var self = this;
  var env = process.env;
  env.npm_package_name = module.module;
  exec(script.script, {cwd: module.installDir, env: env}, function(err, stdout, stderr) {
    if (err) {
      return self.emit('error',  err.message, module.module);
    }
    try {
      var result = JSON.parse(stdout);
      for (var name in result) {
        self.processPidUsageCheck(result[name], name, module);
      }
    }catch(e) {
      self.emit('error',e.message, module.module);
    }
  });
}

/**
 * Check module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.processPidUsageCheck = function(data, name, module) {
  var self = this;
  if (typeof data === 'boolean' || typeof data === 'string') {
    var status = {
      name: name,
      pid: data,
      start: 'start',
      stop: 'stop',
    }
  } else {
    var status = {
      name: name,
      pid: data.pid,
      start: data.start,
      stop: data.stop,
    }
  }
  if (status.pid === false) {
    self.emit('error', 'No pid file available.', module.module, status);
    return;
  }
  pusage.stat(status.pid, function(err, stat) {
    if (err) {
      self.emit('error', 'Failed to get status', module.module, status);
      return;
    }
    self.emit('status', module.module, status);
    return;
  });
}

/**
 * Check module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.processCommand = function(module, script) {
  var self = this;
  self.progressMessage('checking ' + module.module + ':' + script.name);
  var env = process.env;
  env.npm_package_name = module.module;
  exec(script.script, {cwd: module.installDir, env: env}, function(err, stdout, stderr) {
    if (err) {
      return self.message('error',  err.message);
    }
    try {
      var result = JSON.parse(stdout);
      for (var name in result) {
        self.processPidUsage(result[name], name, module);
      }
    }catch(e) {
      return self.message('error',  e.message);
    }
  });
}

/**
 * Check module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.processPidUsage = function(data, name, module) {
  var self = this;
  if (typeof data === 'string' || typeof data === 'string') {
    var status = {
      name: name,
      pid: data,
      start: 'start',
      stop: 'stop',
    }
  } else {
    var status = {
      name: name,
      pid: data.pid,
      start: data.start,
      stop: data.stop,
    }
  }
  if (status.pid === false) {
    status.error = 'No pid file available.';
    self.message('status', 'Failed to get status', status);
    return;
  }
  status.package = module.package;
  pusage.stat(status.pid, function(err, stat) {
    if (err) {
      status.error = 'Failed to get status' ;
      self.message('status', status);
      return;
    }
    status.cpu = stat.cpu.toFixed(2);
    status.mem = Math.round(stat.memory / 1024 / 1024);
    self.message('status', status);
    return;
  });
}
/**
 * Check module. Emits isModuleExists.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.checkModule = function(module) {
  var self = this;
  fs.stat(module.installDir, function(err, stats) {
    if (err) {
      return self.emit('isModuleExists', null, false, module);
    }
    if (!stats.isDirectory()) {
      return self.emit('isModuleExists', new Error(dir + ' is not a directory!'), false, module);
    }
    self.emit('isModuleExists', null, true, module);
  });
}

/**
 * Event callback on isRootExists event.
 *
 * @param {object|null} err - if error happen on checking project directory.
 * @param {boolean} type - true if directory exists.
 */
MFWCliStatusClass.prototype.isRootExists = function(err, type) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  if (!type) {
    return self.message('error', 'There is no root directory.');
  }

  if (!self.module || self.module == 'all') {
    var packageJSON = self.getPackageJSON();
    if (packageJSON.services) {

      for (var shortName in packageJSON.services) {
        var moduleInfo = {
          module: shortName,
          installDir: self.RootDirectory + '/services/' + shortName,
          envFile: self.RootDirectory + '/configs/' + shortName + '.env',
        }
        self.checkModule(moduleInfo);
      }
    }
    return;
  }

  var moduleInfo = {
    module: self.module,
    installDir: self.RootDirectory + '/services/' + self.module,
    envFile: self.RootDirectory + '/configs/' + self.module + '.env',
  }
  self.checkModule(moduleInfo);
}

/**
 * Get current environment name.
 *
 * @return {string} - enviroment name. Empty for default.
 */
MFWCliStatusClass.prototype.getEnvName = function() {
  var self = this;
  var currentEnv;
  try {
    currentEnv = fs.readFileSync(self.RootDirectory + '/.env');
    currentEnv = currentEnv.trim();
  } catch(e) {
    currentEnv = '';
  }
  return currentEnv;
}

/**
 * Get package.json path based on current Enviroment.
 *
 * @return {string} - path to project package.json.
 */
MFWCliStatusClass.prototype.getPackageJSONPath = function() {
  var self = this;
  var packageJSONFile = self.RootDirectory + '/package.json';
  if (self.envName != '') {
    packageJSONFile = self.RootDirectory + '/' + self.envName + '.package.json';
  }
  return packageJSONFile;
}

/**
 * Get package.json object.
 *
 * @return {object} - {env.}package.json parsed content.
 */
MFWCliStatusClass.prototype.getPackageJSON = function() {
  var self = this;
  var packageJSON = '';

  try {
    packageJSON = JSON.parse(fs.readFileSync(self.getPackageJSONPath()));
  } catch (e) {
    self.message('error', e.message);
    console.log(e);
    packageJSON = {};
  }
  return packageJSON;
}


/**
 * Set message.
 */
MFWCliStatusClass.prototype.message = function(type, message) {
  var self = this;
  if (!self.messages[type]) {
    type = 'unknown';
  }
  self.messages[type].push(message);
}

/**
 * Print imidiate messages.
 */
MFWCliStatusClass.prototype.progressMessage = function(message) {
  console.log(colors.gray('\t-\t' + message));
}

/**
 * Print Messages. Executed process.on('exit').
 */
MFWCliStatusClass.prototype.printMessages = function() {
  var self = this;
  var rows = [];

  for (var type in self.messages) {
    if (self.messages[type].length > 0) {
      for (let message of self.messages[type]) {
        if(type == 'status'){
          var version = 'und';
          if (message.package && message.package.version) {
            version =  message.package.version;
          }
          if (message.error) {
            rows.push([
              colors.red(message.name),
              colors.gray(version),
              colors.gray(message.pid),
              '',
              '',
              message.error
            ]);
            continue;
          }
          rows.push([
            colors.green(message.name),
            colors.gray(version),
            colors.gray(message.pid),
            message.cpu,
            message.mem,
            ''
          ]);
          continue;
        }
        Message[type](message);
      }
    }
  }


  var table = new Table({ head: ['SERVICE ', 'VERSION ', 'PID ', 'CPU  ', 'MEM  ', 'Comment'] ,
    chars: { top: '' , 'top-mid': '' , 'top-left': ' ' , 'top-right': ''
      , bottom: ' ' , 'bottom-mid': '' , 'bottom-left': ' ' , 'bottom-right': ''
      , left: ' ' , 'left-mid': ' ' , mid: '-' , 'mid-mid': '-'
      , right: ' ' , 'right-mid': '' , middle: '' },
    style: { head: ['black', 'inverse']}
  });
  rows = rows.sort(function Comparator(a, b) {
    if (a[0] < b[0]) {
      return -1;
    }
    if (a[0] > b[0]) {
      return 1;
    }
    return 0;
  });
  var count = {};
  count.services = rows.length;
  count.up = 0;
  count.down = 0;
  count.cpu = 0;
  count.mem = 0;
  for (var i in rows) {
    table.push(rows[i]);
    if (rows[i][5]  == '') {
      count.up = count.up + 1;
      count.cpu = count.cpu + parseFloat(rows[i][3]);
      count.mem = count.mem + parseFloat(rows[i][4]);
    } else {
      count.down = count.down + 1;
    }
  }
  table.push([
    colors.green(count.up) + ' / ' + colors.red(count.down),
    '',
    '',
    colors.blue(count.cpu) + colors.gray(' %'),
    colors.blue(count.mem) + colors.gray(' Mb'),
  ])
  console.log(table.toString());
}

/**
 * Process search command.
 */
module.exports.Status = function(service, options) {

  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };

  var status = new MFWCliStatusClass(settings);
  status.process(service);
}

module.exports.StatusCheck = function(rootDir, service) {
  let settings = {
    RootDirectory: rootDir
  };
  let status = new MFWCliStatusClass(settings);
  status.check(service);
  return status;
}
