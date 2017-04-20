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

const Message = require('../includes/message.js');
const tokenGenerate = require('./token-generate.js');

prompt.message = '';
/**
 * Constructor.
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
 * Setup method.
 *   Prepare root directory.
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
 * Install method.
 *   Install service to ROOTDIR/services/SERVICE_NAME directory.
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
 * Update method.
 *   Update service in ROOTDIR/services/SERVICE_NAME directory.
 */
MFWCliClass.prototype.update = function(RootDirectory, module) {
  var self = this;
  self.RootDirectory = RootDirectory;
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
 * Install method.
 *   Install service to ROOTDIR/services/SERVICE_NAME directory.
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
 * Uninstall method.
 *   Install service to ROOTDIR/services/SERVICE_NAME directory.
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
 * Env set method.
 *   reinit services directory.
 */
MFWCliClass.prototype.envSet = function(RootDirectory, envName) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = envName;
  self.isDefaultValues = true;

  self.currentEnv = false;
  try {
    self.currentEnv = fs.readFileSync(self.RootDirectory + '/.env');
  } catch(e) {
    self.message('warning', 'failed to read .env file');
  }
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
 * Env set method.
 *   reinit services directory.
 */
MFWCliClass.prototype.start = function(RootDirectory, serviceName, devel) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = self.getEnvName();
  self.devel = devel;

  var servicesDir = self.RootDirectory + '/services/';

  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  if(serviceName == 'all') {
    var files = fs.readdirSync(servicesDir);
    for(var i in files) {
      var filename = files[i];
      var stat = fs.statSync(servicesDir + filename);
      if (stat.isDirectory()){
        self.startService(filename);
      }
    }
  } else {
    self.startService(serviceName);
  }
}

/**
 * Env set method.
 *   reinit services directory.
 */
MFWCliClass.prototype.startService = function(serviceName) {
  var self = this;
  var serviceDir = self.RootDirectory + '/services/' + serviceName;

  var modulePackageJSON = '';

  try {
    modulePackageJSON = JSON.parse(fs.readFileSync(serviceDir + '/package.json'));
  } catch (e) {
    self.message('error', 'Failed to start ' + serviceName);
    return self.message('error', e.message);
  }

  if(!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
    return self.message('error', 'Failed to start ' + serviceName + ' - no scripts defined');
  }
  var listToStart = [];
  for(var name in modulePackageJSON.scripts) {
    if(name.indexOf('start') != -1) {
      listToStart.push(name);
    }
  }

  if(listToStart.length == 0) {
    self.progressMessage(serviceName + ' don\'t have start');
    return;
  }
  for(var i in listToStart){
    var name = listToStart[i];
    if(self.devel) {
      self.progressMessage('starting ' + serviceName + ':' + name + ' in devel mode');
      var env = process.env;
      env.DEBUG = '*';
      env.DEVEL = true;
      var child = spawn('npm', ['run', name ], {
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
      var child = spawn('npm', ['run', name ], {cwd: serviceDir, detached: true, stdio: 'ignore'});
      if(child.exitCode) {
        self.message('error', 'Died with code' + child.exitCode);
      }else {
        self.message('ok', name +' started');
      }
      child.unref();
    }
  }
}

/**
 * Env set method.
 *   reinit services directory.
 */
MFWCliClass.prototype.stop = function(RootDirectory, serviceName) {
  var self = this;
  self.RootDirectory = RootDirectory;
  self.envName = self.getEnvName();

  var servicesDir = self.RootDirectory + '/services/';

  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  if(serviceName == 'all') {
    var files = fs.readdirSync(servicesDir);
    for(var i in files) {
      var filename = files[i];
      var stat = fs.statSync(servicesDir + filename);
      if (stat.isDirectory()){
        self.stopService(filename);
      }
    }
  } else {
    self.stopService(serviceName);
  }
}

/**
 * Env set method.
 *   reinit services directory.
 */
MFWCliClass.prototype.stopService = function(serviceName) {
  var self = this;
  var serviceDir = self.RootDirectory + '/services/' + serviceName;

  var modulePackageJSON = '';

  try {
    modulePackageJSON = JSON.parse(fs.readFileSync(serviceDir + '/package.json'));
  } catch (e) {
    self.message('error', 'Failed to start ' + serviceName);
    return self.message('error', e.message);
  }

  if(!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
    return self.message('error', 'Failed to start ' + serviceName + ' - no scripts defined');
  }
  var listToStop = [];
  for(var name in modulePackageJSON.scripts) {
    if(name.indexOf('stop') != -1) {
      listToStop.push(name);
    }
  }

  if(listToStop.length == 0) {
    self.progressMessage(serviceName + ' don\'t have stop');
    return;
  }
  for(var i in listToStop){
    var name = listToStop[i];
    self.progressMessage('stopping ' + serviceName + ':' + name);
    var child = spawn('npm', ['run', name ], {cwd: serviceDir, stdio: 'inherit'});
  }
}
/**
 * Get executed when Root directory get checked for existance.
 */
MFWCliClass.prototype.prepareModule = function(module, callback) {
  var self = this;

  var packageJSON = self.getPackageJSON();
  if(packageJSON.services && packageJSON.services[module]) {
    var shortName = module;
    var moduleInfo = {
      full: packageJSON.services[shortName],
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
 * Get executed when Root directory get checked for existance.
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
 * Get executed when Root directory get checked for existance.
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
 * Get executed when Root directory get checked for existance.
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

MFWCliClass.prototype.isPackageJSON = function(err, packageJSONPath) {
  var self = this;
  if(err) {
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
      return self.message('error', newEnvService + 'is not directory. Something wrong here.');
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
 * Get executed when Root directory get checked for existance.
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
 * Get executed when Sub directory get checked for existance.
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
 * Get executed when Module installed.
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
 * Get executed when Module installed.
 */
MFWCliClass.prototype.isModuleDownloadedForUpdate = function(err, module) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  return exec('npm update',{cwd: module.installDir}, function(error, stdout, stderr) {
    if (error) {
      return self.message('error', module.full
        + ' updated, but `npm update` failed:' + error.message);
    }
    return self.message('ok', module.full + ' updated.');
  });

}

/**
 * Process Root directory check.
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
 * Request subdirs check.
 */
MFWCliClass.prototype.checkSkel = function() {
  var self = this;
  self.checkDirectory('services');
  self.checkDirectory('logs');
  self.checkDirectory('pids');
  self.checkDirectory('configs');
}

/**
 * Process Sub directory check.
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
 * Process Sub directory check.
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
 * Download Package.
 */
MFWCliClass.prototype.downloadPackage = function(module) {
  var self = this;
  self.progressMessage('downloading ' + module.short);
  exec('npm pack ' + module.full + '|xargs tar -xzpf', {cwd: module.tmpDir.name},
  function(err, stdout, stderr) {
    if (err) {
      return self.emit('isModuleDownloaded', err, module);
    }
    self.progressMessage('copiyng ' + module.short + ' to ' + module.installDir);
    fs.copy(module.tmpDir.name + '/package/',
      module.installDir, { overwrite: true },
      function(err) {
        fs.emptyDirSync(module.tmpDir.name);
        module.tmpDir.removeCallback();
        return self.emit('isModuleDownloaded', err, module);
      });
  });
}

/**
 * Download Package.
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

    if(!self.isDefaultValues) {
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
        self.addModuleToPackageJSON(module);
      });
      return;
    }
    // Set defaults.
    var envContent = '';
    for (var name in schema.properties) {
      if (schema.properties[name] && schema.properties[name].default) {
        var value = schema.properties[name].default;
        if (typeof value === 'number') {
          envContent = envContent + name.toUpperCase() + '=' + value + '\n';
        } else {
          envContent = envContent + name.toUpperCase() + '="' + value + '"' + '\n';
        }
      }
    }
    self.writeEnvFile(module, envContent);
    self.addModuleToPackageJSON(module);
  });
}

/**
 * Download Package.
 */
MFWCliClass.prototype.setModuleDefaults = function(schema, module) {
  var self = this;

  var packageDefault = self.getPackageJSON();
  for (var name in schema.properties) {
    if(process.env[name.toUpperCase()]){
      schema.properties[name].default = process.env[name.toUpperCase()];
      continue;
    }
    if (packageDefault[name]) {
      schema.properties[name].default = packageDefault[name];
    }
  }

  // Replace :token: with value
  for (var name in schema.properties) {
    var value = schema.properties[name].default;
    if (typeof value === 'string') {
      var matched = value.match(/([^{]*?)\w(?=\})/gmi);
      if(matched) {
        for(var i in matched) {
          var pName = matched[i];
          var replaceWith = false;
          if(process.env[pName.toUpperCase()]) {
            replaceWith = process.env[pName.toUpperCase()];
          } else if(packageDefault[pName]) {
            replaceWith = packageDefault[pName];
          } else if(schema.properties[pName] && schema.properties[pName].default) {
            replaceWith = schema.properties[pName].default;
          }
          if(replaceWith) {
            schema.properties[name].default = schema.properties[name].default.replace("{" + pName + "}", replaceWith);
          }
        }
      }
    }
  }

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

  return schema;
}

/**
 * Download Package.
 */
MFWCliClass.prototype.writeEnvFile = function(module, content) {
  var self = this;
  if (!content) {
    content = '';
  }
  fs.writeFileSync(module.envFile, content);
  fs.stat(module.installDir + '/.env', function(err, stats) {
    if (err) {
      return fs.linkSync(module.envFile, module.installDir + '/.env');
    }
  });
}

/**
 * Generate Package JSON.
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
 * Update Package JSON.
 */
MFWCliClass.prototype.addModuleToPackageJSON = function(module) {
  var self = this;
  if (!self.isSaveOption) {
    return;
  }
  var packageJSONFile = self.getPackageJSONPath();
  var packageJSON = self.getPackageJSON();

  if (!packageJSON.services) {
    packageJSON.services = {}
  }
  packageJSON.services[module.short] = module.full;

  fs.writeFile(packageJSONFile, JSON.stringify(packageJSON, null, 2), function(err) {
    if (err) {
      return self.message('error', err.message);
    }
  });
}

/**
 * Update Package JSON.
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

MFWCliClass.prototype.getEnvName = function() {
  var self = this;
  var currentEnv;
  try {
    currentEnv = fs.readFileSync(self.RootDirectory + '/.env');
  } catch(e) {
    currentEnv = '';
    self.message('warning', 'failed to read .env file');
  }
  return currentEnv;
}

/**
 * Get package.json path.
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
 * Get package.json parsed Object.
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
 * check if Module configured.
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
 * check if Module configured.
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
        return fs.linkSync(module.envFile, module.installDir + '/.env');
      }
    });
  });
}

/**
 * Generate Package JSON.
 */
MFWCliClass.prototype.restoreModules = function() {
  var self = this;
  var packageJSON = self.getPackageJSON();

  self.isDefaultValues = true;

  if (packageJSON.services) {
    self.on('isModuleExists', self.isModuleExists);
    self.on('isModuleDownloaded', self.isModuleDownloaded);

    for (var shortName in packageJSON.services) {
      var fullName = packageJSON.services[shortName];
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
 * Print Messages.
 */
MFWCliClass.prototype.progressMessage = function(message) {
  console.log(colors.gray('\t-\t' + message));
}
/**
 * Print Messages.
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

exports = module.exports = new MFWCliClass();
