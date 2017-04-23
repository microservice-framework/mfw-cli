'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const path = require('path');
const prompt = require('prompt');
const colors = require('colors/safe');
const Table = require('cli-table');
const pusage = require('pidusage')

const Message = require('../includes/message.js');
const tokenGenerate = require('./token-generate.js');

prompt.message = '';
/**
 * Incapsulate logic for mfw-cli commands.
 * @constructor.
 */
function MFWCliStatusClass() {
  EventEmitter.call(this);
  var self = this;
  self.messages = {
    ok: [],
    error: [],
    warning: [],
    status: []
  };
}

util.inherits(MFWCliStatusClass, EventEmitter);

/**
 * get STATUS.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: microservice-router
 */
MFWCliStatusClass.prototype.check = function(RootDirectory, module) {
  var self = this;
  self.module = module;
  self.RootDirectory = RootDirectory;
  self.on('isRootExists', self.isRootExists);
  self.on('isModuleExists', function(err, type, module) {
    if (err) {
      return self.message('error', err.message);
    }
    if (!type) {
      return self.message('error', 'Module does not exists.');
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
MFWCliStatusClass.prototype.process = function(RootDirectory, module) {
  var self = this;
  process.on('beforeExit', function() {
    self.printMessages();
  });
  self.module = module;
  self.RootDirectory = RootDirectory;
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

  var listToStart = [];
  for (var name in modulePackageJSON.scripts) {
    if (name.indexOf('status') != -1) {
      listToStart.push(name);
    }
  }
  if (listToStart.length == 0) {
    self.progressMessage(module.module + ' don\'t have status');
    return;
  }
  for (var i in listToStart) {
    var name = listToStart[i];
    self.processCommand(module, name);
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

  var listToStart = [];
  for (var name in modulePackageJSON.scripts) {
    if (name.indexOf('status') != -1) {
      listToStart.push(name);
    }
  }
  if (listToStart.length == 0) {
    self.emit('error', 'No status support', module.module);
    return;
  }
  for (var i in listToStart) {
    var name = listToStart[i];
    self.reportStatus(module, name);
  }
}

/**
 * Report module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.reportStatus = function(module, name) {
  var self = this;
    var env = process.env;
    var child = spawn('npm', ['run', name , '-s'], {
      cwd: module.installDir,
      stdio: 'pipe',
      env: env
    });
    child.on('error', (err) => {
      self.emit('error',  err.message, module.module);
    });
    child.stdout.on("data", function(data){
      try{
        var result = JSON.parse(data);
        for (var name in result) {
          self.processPidUsageCheck(result[name], name, module);
        }
      }catch(e){
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
  if(typeof data === 'string') {
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
  pusage.stat(status.pid, function(err, stat) {
    if(err) {
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
MFWCliStatusClass.prototype.processCommand = function(module, name) {
  var self = this;
  self.progressMessage('checking ' + module.module + ':' + name);
    var env = process.env;
    var child = spawn('npm', ['run', name , '-s'], {
      cwd: module.installDir,
      stdio: 'pipe',
      env: env
    });
    child.on('error', (err) => {
      console.log(err);
    });
    child.stdout.on("data", function(data){
      try{
        var result = JSON.parse(data);
        for (var name in result) {
          self.processPidUsage(result[name], name);
        }
      }catch(e){
        self.message('error', e);
      }

    });
}

/**
 * Check module status.
 *
 * @param {object} module - module data.
 */
MFWCliStatusClass.prototype.processPidUsage = function(data, name) {
  var self = this;
  if(typeof data === 'string') {
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
  pusage.stat(status.pid, function(err, stat) {
    if(err) {
      status.error = 'Failed to get status' ;
      self.message('status', status);
      return;
    }
    status.cpu = stat.cpu;
    status.mem = Math.round(stat.memory /1024/1024);
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

  if(!self.module || self.module == 'all') {
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
 * Get package.json path based on current Enviroment.
 *
 * @return {string} - path to project package.json.
 */
MFWCliStatusClass.prototype.getPackageJSONPath = function() {
  var self = this;
  var packageJSONFile = self.RootDirectory + '/package.json';
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
  var table = new Table({ head: ["Service", "pid", "CPU", "MEM (mb)", ""] ,
    chars: { 'top': ' ' , 'top-mid': ' ' , 'top-left': ' ' , 'top-right': ' '
         , 'bottom': ' ' , 'bottom-mid': ' ' , 'bottom-left': ' ' , 'bottom-right': ' '
         , 'left': ' ' , 'left-mid': '-' , 'mid': '-' , 'mid-mid': '-'
         , 'right': ' ' , 'right-mid': ' ' , 'middle': '  ' }
  });
  for (var type in self.messages) {
    if (self.messages[type].length > 0) {
      for (var i in self.messages[type]) {
        var message = self.messages[type][i];
        switch (type){
          case 'error': {
            Message.error(message);
            break;
          }
          case 'warning': {
            Message.warning(message);
            break;
          }
          case 'ok': {
            Message.ok(message);
            break;
          }
          case 'status': {
            if(message.error) {
              table.push([
              colors.red(message.name),
              colors.gray(message.pid),
              "",
              "",
              message.error
              ]);
              break;
            }
            table.push([
              colors.green(message.name),
              colors.gray(message.pid),
              message.cpu,
              message.mem,
              ""
            ]);
            break;
          }
        }
      }
    }
  }
  console.log(table.toString());
}

/**
 * Process search command.
 */
function serviceStatus(service, options) {
  var rootDIR = getRoot(options);
  var status = new MFWCliStatusClass();
  status.process(rootDIR, service);
}

function serviceStatusCheck(rootDir, service) {
  var status = new MFWCliStatusClass();
  status.check(rootDir, service);
  return status;
}

/**
 * Get Root directory based on command options.
 */
function getRoot(options) {
  var rootDIR = options.root;
  if (!rootDIR) {
    rootDIR = process.cwd();
  }
  return path.resolve(rootDIR);
}

module.exports.Status = serviceStatus;
module.exports.StatusCheck = serviceStatusCheck;
