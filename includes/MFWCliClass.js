'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const path = require('path');
const prompt = require('prompt');
const colors    = require('colors/safe');
const tar = require('tar');
const CommonFunc = require('./common.js');

const Message = require('../includes/message.js');
const tokenGenerate = require('./token-generate.js');
const statusCheck = require('./MFWCliStatus.js').StatusCheck;

prompt.message = '';
/**
 * Incapsulate logic for mfw-cli commands.
 * @constructor.
 */
function MFWCliClass() {
  EventEmitter.call(this);
  var self = this;
  self.messages = {
    ok: [],
    error: [],
    warning: []
  };
  process.on('beforeExit', function() {
    self.printMessages();
  });
}

util.inherits(MFWCliClass, EventEmitter);

/**
 * Prepare project directory.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} envName - Environment name. Helps to separate production, stage and etc.
 */
MFWCliClass.prototype.setup = function(RootDirectory, envName) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = envName;
  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  self.on('isRootExists', self.isRootExists);
  self.on('isDirExists', self.isDirExists);
  self.checkRootDirectory();
}

/**
 * Install service to ROOTDIR/services/SERVICE_NAME directory.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {boolean} isSaveOption - save service to (envname.)package.json file.
 * @param {boolean} isDefaultValues - silent mode. Apply default values.
 */
MFWCliClass.prototype.install = function(RootDirectory, module, isSaveOption, isDefaultValues) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.isSaveOption = isSaveOption;
  self.isDefaultValues = isDefaultValues;
  self.envName = self.getEnvName();
  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  self.on('isModuleExists', self.isModuleExists);
  self.on('isModuleDownloaded', self.isModuleDownloaded);

  self.prepareModule(module, function(module) {
    self.checkModule(module);
  });
}

/**
 * Update service in ROOTDIR/services/SERVICE_NAME directory.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name.
 *   Example: @microservice-framework/microservice-router
 *   Example: microservice-router
 */
MFWCliClass.prototype.update = function(RootDirectory, module, isDefaultValues) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.isDefaultValues = isDefaultValues;
  self.envName = self.getEnvName();
  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  self.on('isModuleExists', self.isModuleExistsForUpdate);
  self.on('isModuleDownloaded', self.isModuleDownloadedForUpdate);

  self.prepareModule(module, function(module) {
    self.checkModule(module);
  });
}

/**
 * Update all services.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 */
MFWCliClass.prototype.updateAll = function(RootDirectory) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = self.getEnvName();
  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }
  self.restoreModules();
}

/**
 * Uninstall service from ROOTDIR/services/SERVICE_NAME directory.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {boolean} isSaveOption - remove service from (envname.)package.json file.
 */
MFWCliClass.prototype.uninstall = function(RootDirectory, module, isSaveOption) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.isSaveOption = isSaveOption;
  self.envName = self.getEnvName();
  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  self.on('isModuleExists', self.isModuleExistsForUninstall);

  self.prepareModule(module, function(module) {
    self.checkModule(module);
  });
}

/**
 * Switch environment and init if new one.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} envName - environment name.
 */
MFWCliClass.prototype.envSet = function(RootDirectory, envName) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = envName;
  self.isDefaultValues = true;

  self.currentEnv = self.getEnvName();

  if (self.currentEnv == self.envName) {
    if (self.envName == '') {
      return self.message('error', 'Already in: default');
    }
    return self.message('error', 'Already in: ' + self.envName);
  }
  self.on('isPackageJSON', self.isPackageJSON);
  self.checkPackageJSON();

}

/**
 * Start service(s).
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} serviceName - service name.
 * @param {boolean} isDevelMode - do not detach services from terminal and output log to stdout.
 */
MFWCliClass.prototype.start = function(RootDirectory, serviceName, isDevelMode) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = self.getEnvName();
  self.devel = isDevelMode;

  var servicesDir = self.RootDirectory + '/services/';

  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  if (serviceName == 'all') {
    var files = fs.readdirSync(servicesDir);
    for (var i in files) {
      var filename = files[i];
      var stat = fs.statSync(servicesDir + filename);
      if (stat.isDirectory()) {
        var status = statusCheck(RootDirectory, filename);
        status.on('status', function(service, status) {
          self.message('error', status.name + ' already running.');
        });
        status.on('error', function(error, service, status) {
          if (status) {
            return self.startService(service, status.start);
          }
          self.startService(service);
        });
      }
    }
  } else {
    var status = statusCheck(RootDirectory, serviceName);
    status.on('status', function(service, status) {
      self.message('error', status.name + ' already running.');
    });
    status.on('error', function(error, service, status) {
      if (status) {
        return self.startService(service, status.start);
      }
      self.startService(service);
    });
  }
}

/**
 * Start service by name.
 *
 * @param {string} serviceName - service name.
 */
MFWCliClass.prototype.startByJSON = function(serviceName) {
  var self = this;
  var serviceDir = self.RootDirectory + '/services/' + serviceName;

  var modulePackageJSON = '';

  try {
    modulePackageJSON = JSON.parse(fs.readFileSync(serviceDir + '/package.json'));
  } catch (e) {
    self.message('error', 'Failed to start ' + serviceName);
    return self.message('error', e.message);
  }

  if (!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
    return self.message('error', 'Failed to start ' + serviceName + ' - no scripts defined');
  }
  var listToStart = [];
  for (var name in modulePackageJSON.scripts) {
    if (name.indexOf('start') != -1) {
      listToStart.push(name);
    }
  }

  if (listToStart.length == 0) {
    self.progressMessage(serviceName + ' don\'t have start');
    return;
  }
  for (var i in listToStart) {
    var name = listToStart[i];
    self.startService(serviceName, name);
  }
}
/**
 * Start service by name.
 *
 * @param {string} serviceName - service name.
 */
MFWCliClass.prototype.startService = function(serviceName, name) {
  var self = this;
  var serviceDir = self.RootDirectory + '/services/' + serviceName;
  if (!name) {
    return self.startByJSON(serviceName);
  }
  var packageJSON = self.getPackageJSON();
  var env = process.env;
  env.mfw_package_name = packageJSON.name;
  env.mfw_package_version = packageJSON.version;
  env.mfw_package_description = packageJSON.description;

  if (self.devel) {
    self.progressMessage('starting ' + serviceName + ':' + name + ' in devel mode');
    env.DEBUG = '*';
    env.DEVEL = true;

    var child = spawn('npm', ['run', name, '-s' ], {
      cwd: serviceDir,
      stdio: 'inherit',
      env: env
    });
    child.on('error', (err) => {
      console.log(err);
    });
    child.on('exit', (code) => {
      console.log('Child exited with code ' + code);
    });
  } else {
    self.progressMessage('starting '  + serviceName + ':' + name);
    var child = spawn('npm', ['run', name ], {
      cwd: serviceDir,
      env: env,
      detached: true,
      stdio: 'ignore'
    });
    if (child.exitCode) {
      self.message('error', 'Died with code' + child.exitCode);
    }else {
      self.message('ok', serviceName + ':' + name + ' started');
    }
    child.unref();
  }
}

/**
 * Stop service(s).
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} serviceName - service name.
 */
MFWCliClass.prototype.stop = function(RootDirectory, serviceName) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = self.getEnvName();

  var servicesDir = self.RootDirectory + '/services/';

  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  if (serviceName == 'all') {
    var files = fs.readdirSync(servicesDir);
    for (var i in files) {
      var filename = files[i];
      var stat = fs.statSync(servicesDir + filename);
      if (stat.isDirectory()) {
        var status = statusCheck(RootDirectory, filename);
        status.on('status', function(service, status) {
          if (status) {
            return self.stopService(service, status.stop);
          }
          self.stopService(service);
        });
        status.on('error', function(error, service, status) {
          if (status) {
            return self.message('error', status.name + ' ' + error);
          }
        });
      }
    }
  } else {
    var status = statusCheck(RootDirectory, serviceName);
    status.on('status', function(service, status) {
      if (status) {
        return self.stopService(service, status.stop);
      }
      self.stopService(service);
    });
    status.on('error', function(error, service, status) {
      if (status) {
        return self.message('error', status.name + ' ' + error);
      }
      self.message('error', service + ' ' + error);
    });
  }
}

/**
 * Start service by name.
 *
 * @param {string} serviceName - service name.
 */
MFWCliClass.prototype.stopByJSON = function(serviceName) {
  var self = this;
  var serviceDir = self.RootDirectory + '/services/' + serviceName;

  var modulePackageJSON = '';

  try {
    modulePackageJSON = JSON.parse(fs.readFileSync(serviceDir + '/package.json'));
  } catch (e) {
    self.message('error', 'Failed to start ' + serviceName);
    return self.message('error', e.message);
  }

  if (!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
    return self.message('error', 'Failed to start ' + serviceName + ' - no scripts defined');
  }
  var listToStop = [];
  for (var name in modulePackageJSON.scripts) {
    if (name.indexOf('stop') != -1) {
      listToStop.push(name);
    }
  }

  if (listToStop.length == 0) {
    self.progressMessage(serviceName + ' don\'t have stop');
    return;
  }
  for (var i in listToStop) {
    var name = listToStop[i];
    self.stopService(serviceName, name)
  }
}
/**
 * Stop service by name.
 *
 * @param {string} serviceName - service name.
 */
MFWCliClass.prototype.stopService = function(serviceName, name) {
  var self = this;
  if (!name) {
    return self.stopByJSON(serviceName);
  }
  var serviceDir = self.RootDirectory + '/services/' + serviceName;
  self.progressMessage('stopping ' + serviceName + ':' + name);
  var child = spawn('npm', ['run', name, '-s' ], {cwd: serviceDir, stdio: 'inherit'});
}

/**
 * Prepare module object.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {function} callback - callback when module prepared.
 */
MFWCliClass.prototype.prepareModule = function(module, callback) {
  var self = this;

  var packageJSON = self.getPackageJSON();
  if (packageJSON.services && packageJSON.services[module]) {
    var shortName = module;
    var sourceName = '';
    if (typeof packageJSON.services[shortName] !== 'string') {
      if (packageJSON.services[shortName].source) {
        sourceName = packageJSON.services[shortName].source;
      }
    } else {
      sourceName = packageJSON.services[shortName];
    }
    var moduleInfo = {
      full: sourceName,
      short: shortName,
      installDir: self.RootDirectory + '/services/' + shortName,
      envFile: self.RootDirectory + '/configs/' + shortName + '.env',
    }

    if (self.envName != '') {
      moduleInfo.envFile = self.RootDirectory + '/configs/' + self.envName
        + '.' + shortName + '.env';
    }
    return callback(moduleInfo);
  }

  fs.stat(module, function(err, stats) {
    if (!err) {
      module = path.resolve(module);
    }
    var nameArray = module.split('/');
    var shortName = nameArray.pop();

    if (!shortName || shortName == '') {
      shortName = nameArray.pop();
    }

    module = {
      full: module,
      short: shortName,
      installDir: self.RootDirectory + '/services/' + shortName,
      envFile: self.RootDirectory + '/configs/' + shortName + '.env',
    }
    if (self.envName != '') {
      module.envFile = self.RootDirectory + '/configs/' + self.envName
        + '.' + shortName + '.env';
    }
    callback(module);
  });
}

/**
 * Event callback for update on isModuleExists event.
 *
 * @param {object|null} err - if error happen on checking module for being installed.
 * @param {boolean} type - true if module installed.
 * @param {object} module - module data.
 */
MFWCliClass.prototype.isModuleExistsForUpdate = function(err, type, module) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }

  if (!type) {
    return self.message('error', module.full + ' is not installed yet')
  }
  module.tmpDir = tmp.dirSync();
  self.downloadPackage(module);
}

/**
 * Event callback for install on isModuleExists event.
 *
 * @param {object|null} err - if error happen on checking module for being installed.
 * @param {boolean} type - true if module installed.
 * @param {object} module - module data.
 */
MFWCliClass.prototype.isModuleExists = function(err, type, module) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }

  if (type) {
    self.message('warning', module.installDir + ' already exists. Overwriting.');
    // return;
  }
  module.tmpDir = tmp.dirSync();
  self.downloadPackage(module);
}

/**
 * Event callback for uninstall on isModuleExists event.
 *
 * @param {object|null} err - if error happen on checking module for being installed.
 * @param {boolean} type - true if module installed.
 * @param {object} module - module data.
 */
MFWCliClass.prototype.isModuleExistsForUninstall = function(err, type, module) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }

  if (!type) {
    return self.message('error', module.installDir + ' is missing');
  }
  fs.remove(module.installDir, function(err) {
    if (err) {
      return self.message('error', err.message);
    }

    self.removeModuleFromPackageJSON(module);
    return self.message('ok', module.short + ' deleted');
  });
}

/**
 * Event callback on isPackageJSON event.
 *
 * @param {object|null} err - if error happen on checking package.json.
 * @param {string} packageJSONPath - path to package.json (of the project).
 */
MFWCliClass.prototype.isPackageJSON = function(err, packageJSONPath) {
  var self = this;
  if (err) {
    console.log(err);
    return self.message('error', err.message);
  }

  var servicesDir = self.RootDirectory + '/services';
  if (self.currentEnv) {
    fs.removeSync(self.RootDirectory + '/.services.' + self.currentEnv);
    fs.renameSync(servicesDir,
    self.RootDirectory + '/.services.' + self.currentEnv);
  }

  var newEnvService = self.RootDirectory + '/.services.' + self.envName;

  fs.stat(newEnvService, function(err, stats) {
    if (err) {
      return fs.mkdir(servicesDir, function(err) {
        if (err) {
          return self.message('error', err.message);
        }
        self.restoreModules();
      });
    }
    if (!stats.isDirectory()) {
      return self.message('error', newEnvService + 'is not directory. Something is wrong here.');
    }
    fs.renameSync(newEnvService, servicesDir);
  });

  fs.writeFileSync(self.RootDirectory + '/.env', self.envName);

  if (self.envName == '') {
    return self.message('ok', 'switched to: default');
  }
  self.message('ok', 'switched to: ' + self.envName);
}

/**
 * Event callback on isRootExists event.
 *
 * @param {object|null} err - if error happen on checking project directory.
 * @param {boolean} type - true if directory exists.
 */
MFWCliClass.prototype.isRootExists = function(err, type) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }

  if (type) {
    self.message('warning', self.RootDirectory + ' already exists.');
    self.installGitIgnore();
    self.generatePackageJSON();
    var packageJSONFile = self.getPackageJSONPath();
    fs.stat(packageJSONFile, function(err, stats) {
      if (err) {
        return;
      }
      if (!stats.isDirectory()) {
        self.restoreModules();
      }
    });
    return self.checkSkel();
  }

  fs.mkdir(self.RootDirectory, function(err) {
    if (err) {
      return self.message('error', err.message);
    }
    fs.writeFileSync(self.RootDirectory + '/.env', self.envName);
    self.installGitIgnore();
    self.generatePackageJSON();
    return self.checkSkel();
  });
}

/**
 * Event callback on isDirExists event.
 *
 * @param {object|null} err - if error happen on checking directory.
 * @param {boolean} type - true if directory exists.
 * @param {string} dir - path to directory.
 */
MFWCliClass.prototype.isDirExists = function(err, type, dir) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  if (type) {
    return self.message('warning', dir + ' already exists.');
  }

  fs.mkdir(dir, function(err) {
    if (err) {
      return self.message('error', err.message);
    }
    return self.message('ok', dir + ' created.');
  });
}

/**
 * Event callback for install on isModuleDownloaded event.
 *
 * @param {object|null} err - if error happen when downloading module.
 * @param {object} module - module data.
 */
MFWCliClass.prototype.isModuleDownloaded = function(err, module) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  self.progressMessage('installing dependencies for ' + module.short);
  return exec('npm install', {cwd: module.installDir}, function(error, stdout, stderr) {
    if (error) {
      self.message('error', module.full
        + ' installed, but `npm install` failed:' + error.message);
    }
    self.checkModuleConfigured(module);
    return self.message('ok', module.full + ' installed.');
  });
}

/**
 * Event callback for update on isModuleDownloaded event.
 *
 * @param {object|null} err - if error happen when downloading module.
 * @param {object} module - module data.
 */
MFWCliClass.prototype.isModuleDownloadedForUpdate = function(err, module) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  self.progressMessage('updating dependencies for ' + module.short);
  return exec('npm update',{cwd: module.installDir}, function(error, stdout, stderr) {
    if (error) {
      return self.message('error', module.full
        + ' updated, but `npm update` failed:' + error.message);
    }
    self.configureModule(module);
    return self.message('ok', module.full + ' updated.');
  });

}

/**
 * Check Project root directory. Emits isRootExists.
 */
MFWCliClass.prototype.checkRootDirectory = function() {
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
 * Check Project directory skeleton (congis,services, pids, logs directories).
 */
MFWCliClass.prototype.checkSkel = function() {
  var self = this;
  self.checkDirectory('services');
  self.checkDirectory('logs');
  self.checkDirectory('pids');
  self.checkDirectory('configs');
}

/**
 * Check module. Emits isModuleExists.
 *
 * @param {object} module - module data.
 */
MFWCliClass.prototype.checkModule = function(module) {
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
 * Check directory. Emits isDirExists.
 */
MFWCliClass.prototype.checkDirectory = function(subDir) {
  var self = this;
  var Directory = self.RootDirectory + '/' + subDir;
  fs.stat(Directory, function(err, stats) {
    if (err) {
      return self.emit('isDirExists', null, false, Directory);
    }
    if (!stats.isDirectory()) {
      return self.emit('isDirExists', new Error(dir + ' is not a directory!'), false, Directory);
    }
    self.emit('isDirExists', null, true, Directory);
  });
}

/**
 * Download module.
 *
 * @param {object} module - module data.
 */
MFWCliClass.prototype.downloadPackage = function(module) {
  var self = this;
  self.progressMessage('downloading ' + module.short);
  exec('npm pack ' + module.full, {cwd: module.tmpDir.name},
  function(err, stdout, stderr) {
    if (err) {
      return self.emit('isModuleDownloaded', err, module);
    }
    tar.x({
      file: module.tmpDir.name + '/' + stdout.trim(),
      cwd: module.tmpDir.name
    },function(err){
      if (err) {
        return self.emit('isModuleDownloaded', err, module);
      }
      self.progressMessage('copying ' + module.short + ' to ' + module.installDir);
      fs.copy(module.tmpDir.name + '/package/',
        module.installDir, { overwrite: true },
        function(err) {
          fs.emptyDirSync(module.tmpDir.name);
          module.tmpDir.removeCallback();
          return self.emit('isModuleDownloaded', err, module);
      });
    });
  });
}

/**
 * Configure module.
 *
 * @param {object} module - module data.
 */
MFWCliClass.prototype.configureModule = function(module) {
  var self = this;
  var envSchema = module.installDir + '/schema/install.json';
  fs.stat(envSchema, function(err, stats) {
    if (err) {
      self.writeEnvFile(module);
      self.addModuleToPackageJSON(module);
      return self.message('warning', envSchema
        + ' is missing. Update ' + module.envFile + ' before use ' + module.short);
    }
    try {
      var moduleSchemaFile = path.resolve(envSchema);
      var schema = JSON.parse(fs.readFileSync(moduleSchemaFile));
    } catch(e) {
      return self.message('error', e.message);
    }

    schema = self.setModuleDefaults(schema, module);

    if (!self.isDefaultValues) {
      prompt.start();
      prompt.get(schema, function(err, result) {
        if (err) {
          return self.message('error', e.message);
        }
        // Convert JSON to ENV file format
        var envContent = '';
        for (var name in result) {
          var value = result[name];
          if (typeof value === 'number') {
            envContent = envContent + name.toUpperCase() + '=' + value + '\n';
          } else {
            envContent = envContent + name.toUpperCase() + '="' + value + '"' + '\n';
          }
        }
        self.writeEnvFile(module, envContent);
        self.addModuleToPackageJSON(module, result);
      });
      return;
    }
    // Set defaults.
    var envContent = '';
    var result = {};
    for (var name in schema.properties) {
      if (schema.properties[name] && schema.properties[name].default) {
        var value = schema.properties[name].default;
        result[name] = value;
        if (typeof value === 'number') {
          envContent = envContent + name.toUpperCase() + '=' + value + '\n';
        } else {
          envContent = envContent + name.toUpperCase() + '="' + value + '"' + '\n';
        }
      }
    }
    self.writeEnvFile(module, envContent);
    self.addModuleToPackageJSON(module, result);
  });
}

/**
 * Set default values. Patterns, ENV variables and package root variables applied.
 *
 * @param {object} schema - Object based on {module}/schema/install.json.
 * @param {object} module - module data.
 *
 * @return {object} schema with pre update
 */
MFWCliClass.prototype.setModuleDefaults = function(schema, module) {
  var self = this;

  schema.properties.secure_key = {
    type: 'string',
    description: 'SECURE_KEY',
    message: 'must be more than 6 symbols',
    conform: function(secureKey) {
      return (secureKey.length > 6);
    },
    default: tokenGenerate(24),
    required: true
  }
  schema.properties.pidfile = {
    type: 'string',
    description: 'PID file path',
    default: '../../pids/' + module.short + '.pid',
    required: true
  }
  schema.properties.logfile = {
    type: 'string',
    description: 'Log file path',
    default: '../../logs/' + module.short + '.log',
    required: true
  }

  var packageDefault = self.getPackageJSON();
  for (var name in schema.properties) {
    if (process.env[name.toUpperCase()]) {
      schema.properties[name].default = process.env[name.toUpperCase()];
      continue;
    }
    if (packageDefault.services
      && packageDefault.services[module.short]
      && packageDefault.services[module.short].settings
      && packageDefault.services[module.short].settings[name]) {
      schema.properties[name].default = packageDefault.services[module.short].settings[name];
      continue;
    }
    if (packageDefault[name]) {
      schema.properties[name].default = packageDefault[name];
    }
  }

  if(packageDefault.services
    && packageDefault.services[module.short]
    && packageDefault.services[module.short].settings) {
    for(let name in packageDefault.services[module.short].settings) {
      let value = packageDefault.services[module.short].settings[name];
      if(!schema.properties[name]) {
        schema.properties[name] = {
          default: value
        }
      }
    }
  }

  // Replace {token} with value
  for (var name in schema.properties) {
    var value = schema.properties[name].default;
    if (typeof value === 'string') {
      var matched = value.match(/([^{]*?)\w(?=\})/gmi);
      if (matched) {
        for (var i in matched) {
          var pName = matched[i];
          var replaceWith = false;
          if (process.env[pName.toUpperCase()]) {
            replaceWith = process.env[pName.toUpperCase()];
          } else if (packageDefault[pName]) {
            replaceWith = packageDefault[pName];
          } else if (schema.properties[pName] && schema.properties[pName].default) {
            replaceWith = schema.properties[pName].default;
          }
          if (replaceWith) {
            schema.properties[name].default = schema.properties[name].default.replace('{'
              + pName + '}', replaceWith);
          }
        }
      }
    }
  }

  return schema;
}

/**
 * Write configs/{env}.module.env file and link it to service/module/.env
 *
 * @param {object} module - module data.
 * @param {string} content - prepared env file content.
 */
MFWCliClass.prototype.writeEnvFile = function(module, content) {
  var self = this;
  if (!content) {
    content = '';
  }
  fs.writeFileSync(module.envFile, content);
  fs.stat(module.installDir + '/.env', function(err, stats) {
    if (err) {
      return fs.ensureSymlinkSync(module.envFile, module.installDir + '/.env');
    }
  });
}

/**
 * Generate Package (Project) JSON. {env.}project.json
 * Emits isPackageJSON.
 */
MFWCliClass.prototype.generatePackageJSON = function() {
  var self = this;
  var packageJSONFile = self.getPackageJSONPath();
  fs.stat(packageJSONFile, function(err, stats) {
    if (err) {
      prompt.start();
      try {
        var packageSchemaFile = path.resolve(__dirname + '/../templates/package.schema.json');
        var schema = JSON.parse(fs.readFileSync(packageSchemaFile));
      } catch(e) {
        self.emit('isPackageJSON', e, packageJSONFile);
        return self.message('error', e.message);
      }
      prompt.get(schema, function(err, result) {
        if (err) {
          self.emit('isPackageJSON', err, packageJSONFile);
          return self.message('error', e.message);
        }
        fs.writeFile(packageJSONFile, JSON.stringify(result, null, 2), function(err) {
          if (err) {
            self.emit('isPackageJSON', err, packageJSONFile);
            return self.message('error', err.message);
          }
          self.emit('isPackageJSON', null, packageJSONFile);
        });
      });
    }
  });
}

/**
 * Add module data to Package ( project) JSON file.
 * Happens when running install --save option.
 *
 * @param {object} module - module data.
 * @param {object} settings - Settings for the module used on deploy.
 */
MFWCliClass.prototype.addModuleToPackageJSON = function(module, settings) {
  var self = this;
  if (!self.isSaveOption) {
    return;
  }
  var packageJSONFile = self.getPackageJSONPath();
  var packageJSON = self.getPackageJSON();

  if (!packageJSON.services) {
    packageJSON.services = {}
  }

  if (!packageJSON.services[module.short]) {
    packageJSON.services[module.short] = {
      source: module.full
    };
    if (settings) {
      packageJSON.services[module.short].settings = settings;
    }
  } else {
    if (typeof packageJSON.services[module.short] === 'string') {
      packageJSON.services[module.short] = {
        source: module.full
      };
      if (settings) {
        packageJSON.services[module.short].settings = settings;
      }
    } else {
      packageJSON.services[module.short].source = module.full;
      if (settings) {
        packageJSON.services[module.short].settings = settings;
      }
    }
  }

  fs.writeFile(packageJSONFile, JSON.stringify(packageJSON, null, 2), function(err) {
    if (err) {
      return self.message('error', err.message);
    }
  });
}

/**
 * Remove module data to Package ( project) JSON file.
 * Happens when running install --save option.
 *
 * @param {object} module - module data.
 */
MFWCliClass.prototype.removeModuleFromPackageJSON = function(module) {
  var self = this;
  if (!self.isSaveOption) {
    return;
  }
  var packageJSONFile = self.getPackageJSONPath();
  var packageJSON = self.getPackageJSON();

  if (!packageJSON.services) {
    packageJSON.services = {}
  }
  if (packageJSON.services[module.short]) {
    delete packageJSON.services[module.short];
  }

  fs.writeFile(packageJSONFile, JSON.stringify(packageJSON, null, 2), function(err) {
    if (err) {
      return self.message('error', err.message);
    }
  });
}

/**
 * Get current environment name.
 *
 * @return {string} - enviroment name. Empty for default.
 */
MFWCliClass.prototype.getEnvName = function() {
  var self = this;
  var currentEnv;
  try {
    currentEnv = fs.readFileSync(self.RootDirectory + '/.env');
  } catch(e) {
    currentEnv = '';
    self.message('warning', 'no .env file found, creating a default one.');
    fs.writeFileSync(self.RootDirectory + '/.env', currentEnv);
  }
  return currentEnv;
}

/**
 * Get package.json path based on current Enviroment.
 *
 * @return {string} - path to project package.json.
 */
MFWCliClass.prototype.getPackageJSONPath = function() {
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
MFWCliClass.prototype.getPackageJSON = function() {
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
 * Check if {env.}package.json exists. Emits isPackageJSON.
 */
MFWCliClass.prototype.checkPackageJSON = function() {
  var self = this;
  var packageJSONFile = self.getPackageJSONPath();
  fs.stat(packageJSONFile, function(err, stats) {
    if (err) {
      return self.generatePackageJSON();
    }
    self.emit('isPackageJSON', null, packageJSONFile);
  });
}

/**
 * Check if Module configured.
 *
 * @param {object} module - module data.
 */
MFWCliClass.prototype.checkModuleConfigured = function(module) {
  var self = this;
  fs.stat(module.envFile, function(err, stats) {
    if (err) {
      return self.configureModule(module);
    }
    self.addModuleToPackageJSON(module);
    fs.stat(module.installDir + '/.env', function(err, stats) {
      if (err) {
        return fs.ensureSymlinkSync(module.envFile, module.installDir + '/.env');
      }
    });
  });
}

/**
 * Restore modules (services) based on {env.}package.json.
 */
MFWCliClass.prototype.restoreModules = function() {
  var self = this;
  var packageJSON = self.getPackageJSON();

  self.isDefaultValues = true;

  if (packageJSON.services) {
    self.on('isModuleExists', self.isModuleExists);
    self.on('isModuleDownloaded', self.isModuleDownloadedForUpdate);

    for (var shortName in packageJSON.services) {
      var fullName = '';
      if (typeof packageJSON.services[shortName] === 'string') {
        fullName = packageJSON.services[shortName];
      } else {
        if (packageJSON.services[shortName].source) {
          fullName = packageJSON.services[shortName].source;
        }
      }
      self.prepareModule(fullName, function(module) {
        self.checkModule(module);
      });
    }
  }
}

/**
 * Install .gitignore from template.
 */
MFWCliClass.prototype.installGitIgnore = function() {
  var self = this;
  fs.stat(self.RootDirectory + '/.gitignore', function(err, stats) {
    if (err) {
      var gitIgnore = path.resolve(__dirname + '/../templates/gitignore');
      fs.copy(gitIgnore, self.RootDirectory + '/.gitignore', { overwrite: true }, function(err) {
        if (err) {
          return self.message('error', err.message);
        }
        return self.message('ok', '.gitignore copied');
      });
      return;
    }
    self.message('warning', '.gitignore already exists');
  });
}

/**
 * Set message.
 */
MFWCliClass.prototype.message = function(type, message) {
  var self = this;
  self.messages[type].push(message);
}

/**
 * Print imidiate messages.
 */
MFWCliClass.prototype.progressMessage = function(message) {
  console.log(colors.gray('\t-\t' + message));
}

/**
 * Print Messages. Executed process.on('exit').
 */
MFWCliClass.prototype.printMessages = function() {
  var self = this;
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
        }
      }
    }
  }
}

/**
 * Process setup command.
 */
module.exports.setupDir = function(rootDIR, options) {
  let MFWCli = new MFWCliClass();
  if (!rootDIR) {
    rootDIR = process.cwd();
  }
  rootDIR = path.resolve(rootDIR);
  var envName = options.env;
  if (!envName) {
    envName = '';
  }

  MFWCli.setup(rootDIR, envName);
}

/**
 * Process install command.
 */
module.exports.installService = function(service, options) {
  let MFWCli = new MFWCliClass();
  let rootDIR = CommonFunc.getRoot(options);
  MFWCli.install(rootDIR, service, options.save, options.default);
}

/**
 * Process update command.
 */
module.exports.updateService = function(service, options) {
  let MFWCli = new MFWCliClass();
  let rootDIR = CommonFunc.getRoot(options);
  if (service != 'all') {
    return MFWCli.update(rootDIR, service, options.default);
  }
  MFWCli.updateAll(rootDIR);
}

/**
 * Process uninstall command.
 */
module.exports.uninstallService = function(service, options) {
  let MFWCli = new MFWCliClass();
  let rootDIR = CommonFunc.getRoot(options);
  MFWCli.uninstall(rootDIR, service, options.save);
}

/**
 * Process start command.
 */
module.exports.startService = function(service, options) {
  let MFWCli = new MFWCliClass();
  let rootDIR = CommonFunc.getRoot(options);
  if (!service) {
    service = 'all';
  }
  MFWCli.start(rootDIR, service, options.devel);
}

/**
 * Process stop command.
 */
module.exports.stopService = function(service, options) {
  let MFWCli = new MFWCliClass();
  let rootDIR = CommonFunc.getRoot(options);
  if (!service) {
    service = 'all';
  }
  MFWCli.stop(rootDIR, service);
}

/**
 * Process env command.
 */
module.exports.envList = function(envName, options) {
  let MFWCli = new MFWCliClass();
  let rootDIR = CommonFunc.getRoot(options);
  if (envName) {
    if (envName == 'default') {
      envName = '';
    }
    return MFWCli.envSet(rootDIR, envName);
  }
  if (options.list) {
    var envs = CommonFunc.findEnvironments(rootDIR, options.extended);
    console.log(envs);
  }
}
