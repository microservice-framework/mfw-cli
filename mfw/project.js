'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('cross-spawn');
const path = require('path');
const prompt = require('prompt');
const tar = require('tar');
const CommonFunc = require('../includes/common.js');

const tokenGenerate = require('../includes/token-generate.js');

const MFWCommandPrototypeClass = require('../includes/MFWCommandPrototypeClass.js');


prompt.message = '';
class ProjectClass extends MFWCommandPrototypeClass {
  /**
   * Prepare project directory and package.json.
   */
  initProject() {
    if (!this.validateRootDirForInit()) {
      return this.message('error', 'Init Failed');
    }
    this.on('isPackageJSON', (err, packageJSONPath) => {
      if (err) {
        return this.message('error', e.message);
      }
      this.message('ok', 'Init completed');
      this.currentEnv = this.getEnvName();
      if (this.currentEnv !== this.envName) {
        this.isDefaultValues = true;
        this.performEnvSwitch();
      }
    });
    this.generatePackageJSON();
  }

  /**
   * Generate Package (Project) JSON. {env.}project.json
   * Emits isPackageJSON.
   */
  generatePackageJSON() {
    var self = this;
    var packageJSONFile = self.getPackageJSONPath();
    fs.stat(packageJSONFile, function(err, stats) {
      if (err) {
        if (self.envName != '') {
          let stat;
          try {
            stat = fs.statSync(self.RootDirectory + '/package.json');
            if (stat.isFile()) {
              try {
                var defaultPackageJson = JSON.parse(
                  fs.readFileSync(self.RootDirectory + '/package.json')
                );
                return fs.writeFile(packageJSONFile,
                  JSON.stringify(defaultPackageJson, null, 2),
                  function(err) {
                    if (err) {
                      return self.emit('isPackageJSON', err, packageJSONFile);
                    }
                    self.message('ok', packageJSONFile + '  copied from package.json.');
                    self.emit('isPackageJSON', null, packageJSONFile);
                  });
              } catch(e) {
                return self.emit('isPackageJSON', e, packageJSONFile);
              }
            }
          }catch(e) {
            // no default package. Continue
          }
        }
        try {
          var packageSchemaFile = path.resolve(__dirname + '/../templates/package.schema.json');
          var schema = JSON.parse(fs.readFileSync(packageSchemaFile));
        } catch(e) {
          return self.emit('isPackageJSON', e, packageJSONFile);
        }
        prompt.start();
        prompt.get(schema, function(err, result) {
          if (err) {
            return self.emit('isPackageJSON', err, packageJSONFile);
          }
          fs.writeFile(packageJSONFile, JSON.stringify(result, null, 2), function(err) {
            if (err) {
              return self.emit('isPackageJSON', err, packageJSONFile);
            }
            self.emit('isPackageJSON', null, packageJSONFile);
          });
        });
      }
    });
  }
  /**
   * perform Enviroment Switch
   */
  performEnvSwitch() {
    let servicesDir = this.RootDirectory + '/services';
    try {
      fs.removeSync(this.RootDirectory + '/.services.' + this.currentEnv);
      fs.renameSync(servicesDir, this.RootDirectory + '/.services.' + this.currentEnv);
    } catch(e) {
      console.log(e);
    }

    let newEnvService = this.RootDirectory + '/.services.' + this.envName;
    try {
      let stats = fs.statSync(newEnvService);
      if (!stats.isDirectory()) {
        return self.message('error', newEnvService + 'is not directory. Something is wrong here.');
      }
      fs.renameSync(newEnvService, servicesDir);
      fs.writeFileSync(this.RootDirectory + '/.env', this.envName);
      if (this.envName == '') {
        return self.message('ok', 'switched to: default');
      }
      this.message('ok', 'switched to: ' + this.envName);
    } catch(e) {
      this.message('warning', e);
      fs.mkdir(servicesDir, (err) => {
        if (err) {
          return this.message('error', err.message);
        }
        this.restoreModules();
        fs.writeFileSync(this.RootDirectory + '/.env', this.envName);
        if (this.envName == '') {
          return this.message('ok', 'switched to: default');
        }
        this.message('ok', 'switched to: ' + this.envName);
      });
      return;
    }
  }
  /**
   * Restore modules (services) based on {env.}package.json.
   */
  restoreModules() {
    let packageJSON = this.getPackageJSON();

    this.isDefaultValues = true;

    if (packageJSON.services) {
      this.on('downloadModule', (module) => {
        module.tmpDir = tmp.dirSync();
        this.downloadPackage(module);
      });
      this.on('moduleDownloaded', (module) => {
        this.isModuleDownloadedForUpdate(module);
      });

      for (var shortName in packageJSON.services) {
        var fullName = '';
        if (typeof packageJSON.services[shortName] === 'string') {
          fullName = packageJSON.services[shortName];
        } else {
          if (packageJSON.services[shortName].source) {
            fullName = packageJSON.services[shortName].source;
          }
        }
        this.prepareModule(fullName, (module) => {
          this.checkModule(module);
        });
      }
      return;
    }
    this.message('ok', 'No services to install');
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
  /**
   * Check module. Emits isModuleExists.
   *
   * @param {object} module - module data.
   */
  checkModule(module) {
    fs.stat(module.installDir, (err, stats) => {
      if (err) {
        return this.emit('downloadModule', module);
      }
      if (!stats.isDirectory()) {
        return this.message('error', module.installDir + ' is not a directory!');
      }
      this.message('warning', module.installDir + ' already exists. Overwriting.');
      this.emit('downloadModule', module);
    });
  }

  /**
   * Download module.
   *
   * @param {object} module - module data.
   */
  downloadPackage(module) {
    this.progressMessage('downloading ' + module.short);
    exec('npm pack ' + module.full, {cwd: module.tmpDir.name},
    (err, stdout, stderr) => {
      if (err) {
        return this.message('error', err.message);
      }
      tar.x({
        file: module.tmpDir.name + '/' + stdout.trim(),
        cwd: module.tmpDir.name
      },(err) => {

        if (err) {
          return this.message('error', err.message);
        }

        if (!this.validateServiceDir(module.tmpDir.name + '/package/')) {
          fs.emptyDirSync(module.tmpDir.name);
          module.tmpDir.removeCallback();
          return this.message('error', module.short + ' is not valid microservice package');
        }

        this.progressMessage('copying ' + module.short + ' to ' + module.installDir);
        fs.copy(module.tmpDir.name + '/package/',  module.installDir, { overwrite: true },
          (err) => {
            fs.emptyDirSync(module.tmpDir.name);
            module.tmpDir.removeCallback();
            return this.emit('moduleDownloaded', module);
          });
      });
    });
  }
  /**
   * Event callback for update on isModuleDownloaded event.
   *
   * @param {object|null} err - if error happen when downloading module.
   * @param {object} module - module data.
   */
  isModuleDownloadedForUpdate (module) {
    this.progressMessage('updating dependencies for ' + module.short);
    return exec('npm update',{cwd: module.installDir}, (error, stdout, stderr) => {
      if (error) {
        return this.message('error', module.full
          + ' updated, but `npm update` failed:' + error.message);
      }
      this.configureModule(module);
      return this.message('ok', module.full + ' updated.');
    });
  }

  /**
   * Event callback for install on isModuleDownloaded event.
   *
   * @param {object|null} err - if error happen when downloading module.
   * @param {object} module - module data.
   */
  isModuleDownloadedForInstall (module) {
    this.progressMessage('installing dependencies for ' + module.short);
    return exec('npm install', {cwd: module.installDir}, (error, stdout, stderr) => {
      if (error) {
        this.message('error', module.full
          + ' installed, but `npm install` failed:' + error.message);
      }
      this.checkModuleConfigured(module);
      return this.message('ok', module.full + ' installed.');
    });
  }

  /**
   * Validate service directory as a microservice
   *
   * @return {boolean} true if valid.
   */
  validateServiceDir(directory) {
    let resultStatus = true;
    let stat;
    try {
      stat = fs.statSync(directory);
      if (!stat.isDirectory()) {
        this.message('error', directory + ' is not a directory');
        resultStatus = false;
      }
    } catch(e) {
      this.message('error', directory + ' does not exists');
      resultStatus = false;
    }

    // Check if package.json exists.
    try {
      stat = fs.statSync(directory + '/package.json');
      if (!stat.isFile()) {
        this.message('error', directory + '/package.json is not a valid file');
        resultStatus = false;
      } else {
        // Check if package.json is valid file.
        try {
          let packageJSON = JSON.parse(fs.readFileSync(directory + '/package.json'));
          if (!packageJSON.scripts) {
            this.message('error', 'package.json.scripts is not defined');
            resultStatus = false;
          } else {
            let listToStart = [];
            for (let name in packageJSON.scripts) {
              if (name.indexOf('start') != -1) {
                listToStart.push(name);
              }
            }
            if (listToStart.length == 0) {
              this.message('error', 'package.json.scripts.start is not defined');
              resultStatus = false;
            }
            let listToStop = [];
            for (let name in packageJSON.scripts) {
              if (name.indexOf('stop') != -1) {
                listToStop.push(name);
              }
            }
            if (listToStop.length == 0) {
              this.message('error', 'package.json.scripts.stop is not defined');
              resultStatus = false;
            }
            let listToStatus = [];
            for (let name in packageJSON.scripts) {
              if (name.indexOf('status') != -1) {
                listToStatus.push(name);
              }
            }
            if (listToStatus.length == 0) {
              this.message('error', 'package.json.scripts.status is not defined');
              resultStatus = false;
            }
          }
        } catch (e) {
          this.message('error', e + ' in file: ' + directory + '/package.json');
          resultStatus = false;
        }
      }
    } catch(e) {
      console.log(e);
      this.message('error', directory + '/package.json does not exists');
      resultStatus = false;
    }
    return resultStatus;
  }

  /**
   * Check if Module configured.
   *
   * @param {object} module - module data.
   */
  checkModuleConfigured(module) {
    fs.stat(module.envFile, (err, stats) => {
      if (err) {
        return this.configureModule(module);
      }
      this.addModuleToPackageJSON(module);
      fs.stat(module.installDir + '/.env', (err, stats) => {
        if (err) {
          return fs.ensureSymlinkSync(module.envFile, module.installDir + '/.env');
        }
      });
    });
  }

  /**
   * Configure module.
   *
   * @param {object} module - module data.
   */
  configureModule (module) {

    var envSchema = module.installDir + '/schema/install.json';
    fs.stat(envSchema, (err, stats) => {
      if (err) {
        this.writeEnvFile(module);
        this.addModuleToPackageJSON(module);
        return this.message('warning', envSchema
          + ' is missing. Update ' + module.envFile + ' before use ' + module.short);
      }
      try {
        var moduleSchemaFile = path.resolve(envSchema);
        var schema = JSON.parse(fs.readFileSync(moduleSchemaFile));
      } catch(e) {
        return this.message('error', e.message);
      }

      schema = this.setModuleDefaults(schema, module);

      if (!this.isDefaultValues) {
        prompt.start();
        prompt.get(schema, (err, result) => {
          if (err) {
            return this.message('error', e.message);
          }
          // Convert JSON to ENV file format
          let envContent = '';
          for (let name in result) {
            let value = result[name];
            if (typeof value === 'number') {
              envContent = envContent + name.toUpperCase() + '=' + value + '\n';
            } else {
              envContent = envContent + name.toUpperCase() + '="' + value + '"' + '\n';
            }
          }
          this.writeEnvFile(module, envContent);
          this.addModuleToPackageJSON(module, result);
        });
        return;
      }
      // Set defaults.
      let envContent = '';
      let result = {};
      for (let name in schema.properties) {
        if (schema.properties[name] && schema.properties[name].default) {
          let value = schema.properties[name].default;
          result[name] = value;
          if (typeof value === 'number') {
            envContent = envContent + name.toUpperCase() + '=' + value + '\n';
          } else {
            envContent = envContent + name.toUpperCase() + '="' + value + '"' + '\n';
          }
        }
      }
      this.writeEnvFile(module, envContent);
      this.addModuleToPackageJSON(module, result);
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
  setModuleDefaults(schema, module) {
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

    let packageDefault = this.getPackageJSON();
    for (let name in schema.properties) {
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

    if (packageDefault.services
      && packageDefault.services[module.short]
      && packageDefault.services[module.short].settings) {
      for (let name in packageDefault.services[module.short].settings) {
        let value = packageDefault.services[module.short].settings[name];
        if (!schema.properties[name]) {
          schema.properties[name] = {
            default: value
          }
        }
      }
    }

    // Replace {token} with value
    for (let name in schema.properties) {
      let value = schema.properties[name].default;
      if (typeof value === 'string') {
        let matched = value.match(/([^{]*?)\w(?=\})/gmi);
        if (matched) {
          for (let i in matched) {
            let pName = matched[i];
            let replaceWith = false;
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
  writeEnvFile (module, content) {
    if (!content) {
      content = '';
    }
    fs.writeFileSync(module.envFile, content);
    fs.stat(module.installDir + '/.env', (err, stats) => {
      if (err) {
        return fs.ensureSymlinkSync(module.envFile, module.installDir + '/.env');
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
  addModuleToPackageJSON (module, settings) {
    if (!this.isSaveOption) {
      return;
    }
    var packageJSONFile = this.getPackageJSONPath();
    var packageJSON = this.getPackageJSON();

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

    fs.writeFile(packageJSONFile, JSON.stringify(packageJSON, null, 2), (err) => {
      if (err) {
        return this.message('error', err.message);
      }
    });
  }

  /**
   * Install service to ROOTDIR/services/SERVICE_NAME directory.
   *
   * @param {string} module - service name. Example: @microservice-framework/microservice-router
   * @param {boolean} isSaveOption - save service to (envname.)package.json file.
   * @param {boolean} isDefaultValues - silent mode. Apply default values.
   */
  installService (moduleName, isSaveOption, isDefaultValues) {
    if (!this.validateRootDir()) {
      return this.message('error', 'Installation Failed');
    }
    this.isSaveOption = isSaveOption;
    this.isDefaultValues = isDefaultValues;

    this.on('downloadModule', (module) => {
      module.tmpDir = tmp.dirSync();
      this.downloadPackage(module);
    });
    this.on('moduleDownloaded', (module) => {
      this.isModuleDownloadedForInstall(module);
    });

    this.prepareModule(moduleName, (module) => {
      this.checkModule(module);
    });
  }

  /**
   * Update all services.
   */
  updateAll () {
    var self = this;

    if (!this.validateRootDir()) {
      return self.message('error', 'Installation Failed');
    }
    this.restoreModules();
  }

  /**
   * Update service in ROOTDIR/services/SERVICE_NAME directory.
   *
   * @param {string} module - service name.
   *   Example: @microservice-framework/microservice-router
   *   Example: microservice-router
   */
  updateService(module, isDefaultValues) {
    if (!this.validateRootDir()) {
      return this.message('error', 'Installation Failed');
    }

    this.isDefaultValues = isDefaultValues;

    this.on('moduleDownloaded', (module) => {
      this.isModuleDownloadedForUpdate(module);
    });

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }
        module.tmpDir = tmp.dirSync();
        this.downloadPackage(module);
      });
    });
  }
}

/**
 * Incapsulate logic for mfw-cli commands.
 * @constructor.
 * @param {object} settings
 *   - RootDirectory - resolved path to project directory.
 *   - envName - environment name.
 */
function MFWCliClass(settings) {
  EventEmitter.call(this);
  var self = this;
  self.messages = {
    ok: [],
    error: [],
    warning: [],
    unknown: [],
  };
  self.isExiting = false;
  self.RootDirectory = settings.RootDirectory;

  if (settings.envName) {
    self.envName = settings.envName;
  } else {
    self.envName = self.getEnvName();
  }

  if (self.envName != '') {
    self.progressMessage('Env:' + self.envName);
  }

  process.on('beforeExit', function() {
    // prevent multiple printMessages on multiple beforeExit calls.
    if (!self.isExiting) {
      self.isExiting = true;
      self.printMessages();
    }
  });
}

util.inherits(MFWCliClass, EventEmitter);




/**
 * Update service in ROOTDIR/services/SERVICE_NAME directory.
 *
 * @param {string} module - service name.
 *   Example: @microservice-framework/microservice-router
 *   Example: microservice-router
 */
MFWCliClass.prototype.update = function(module, isDefaultValues) {
  var self = this;

  if (!self.validateRootDir()) {
    return self.message('error', 'Installation Failed');
  }

  self.isDefaultValues = isDefaultValues;

  self.on('isModuleExists', self.isModuleExistsForUpdate);
  self.on('isModuleDownloaded', self.isModuleDownloadedForUpdate);

  self.prepareModule(module, function(module) {
    self.checkModule(module);
  });
}

/**
 * Update all services.
 */
MFWCliClass.prototype.updateAll = function() {
  var self = this;

  if (!self.validateRootDir()) {
    return self.message('error', 'Installation Failed');
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
MFWCliClass.prototype.uninstall = function(module, isSaveOption) {
  var self = this;
  self.isSaveOption = isSaveOption;

  self.on('isModuleExists', self.isModuleExistsForUninstall);

  self.prepareModule(module, function(module) {
    self.checkModule(module);
  });
}

/**
 * Switch environment and init if new one.
 *
 * @param {string} envName - environment name.
 */
MFWCliClass.prototype.envSet = function(envName) {
  var self = this;
  self.currentEnv = self.getEnvName();
  self.envName = envName;
  self.isDefaultValues = true;

  if (self.currentEnv == self.envName) {
    if (self.envName == '') {
      return self.message('error', 'Already in: default');
    }
    return self.message('error', 'Already in: ' + self.envName);
  }
  self.on('isPackageJSON', function(err, packageJSONPath) {
    if (err) {
      return self.message('error', e.message);
    }
    self.currentEnv = self.getEnvName();
    if (self.currentEnv !== self.envName) {
      self.isDefaultValues = true;
      self.performEnvSwitch();
    }
  });
  self.checkPackageJSON();

}

/**
 * Start all services.
 *
 * @param {boolean} isDevelMode - do not detach services from terminal and output log to stdout.
 */
MFWCliClass.prototype.startAll = function(isDevelMode) {
  var self = this;
  self.devel = isDevelMode;

  var servicesDir = self.RootDirectory + '/services/';
  var files = fs.readdirSync(servicesDir);

  for (var i in files) {
    var filename = files[i];
    var stat = fs.statSync(servicesDir + filename);
    if (stat.isDirectory()) {
      var status = statusCheck(self.RootDirectory, filename);
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
}

/**
 * Start service.
 *
 * @param {string} serviceName - service name.
 * @param {boolean} isDevelMode - do not detach services from terminal and output log to stdout.
 */
MFWCliClass.prototype.start = function(serviceName, isDevelMode) {
  var self = this;
  self.devel = isDevelMode;

  var status = statusCheck(self.RootDirectory, serviceName);
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
 * Stop all services.
 */
MFWCliClass.prototype.stopAll = function() {
  var self = this;
  var servicesDir = self.RootDirectory + '/services/';

  var files = fs.readdirSync(servicesDir);
  for (var i in files) {
    var filename = files[i];
    var stat = fs.statSync(servicesDir + filename);
    if (stat.isDirectory()) {
      var status = statusCheck(self.RootDirectory, filename);
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
}

/**
 * Stop service.
 *
 * @param {string} serviceName - service name.
 */
MFWCliClass.prototype.stop = function(serviceName) {
  var self = this;
  var status = statusCheck(self.RootDirectory, serviceName);
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

/**
 * Stop service by name.
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
 * Fix project directory.
 */
MFWCliClass.prototype.fix = function() {
  var self = this;
  fs.stat(self.RootDirectory, function(err, stats) {
    if (err) {
      return self.message('error', err.message);
    }
    if (!stats.isDirectory()) {
      return self.message('error', self.RootDirectory + ' is not a directory!');
    }

    self.installGitIgnore();
    self.generatePackageJSON();
    var packageJSONFile = self.getPackageJSONPath();
    try {
      let stat = fs.statSync(packageJSONFile);
      if (stat.isFile()) {
        if (self.checkSkel()) {
          self.message('ok', 'Directory structure checked.');
          self.restoreModules();
          return;
        }
        self.message('error', 'Directory structure failed.');
        return;
      }
      return self.message('error', packageJSONFile + ' is not a file!');
    } catch(e) {
      return self.message('error', e.message);
    }
  });
}

/**
 * Validate Root directory as a project directory..
 *
 * @return {boolean} true if valid.

MFWCliClass.prototype.validateRootDir = function() {
  var self = this;
  var stat;
  // Check ROOT DIR.
  let resultStatus = true;
  try {
    stat = fs.statSync(self.RootDirectory);
    if (!stat.isDirectory()) {
      self.message('error', 'Root dir: ' + self.RootDirectory + ' is not a directory');
      resultStatus = false;
    }
  } catch(e) {
    self.message('error', 'Root dir: ' + self.RootDirectory + ' doesnot exists');
    resultStatus = false;

  }

  // Check services directory
  try {
    stat = fs.statSync(self.RootDirectory + '/services/');
    if (!stat.isDirectory()) {
      self.message('error', 'Root dir: ' + self.RootDirectory + '/services/ is not a directory');
      resultStatus = false;
    }
  } catch(e) {
    self.message('error', 'Root dir: ' + self.RootDirectory + '/services/ doesnot exists');
    resultStatus = false;

  }

  // Check configs directory
  try {
    stat = fs.statSync(self.RootDirectory + '/configs/');
    if (!stat.isDirectory()) {
      self.message('error', 'Root dir: ' + self.RootDirectory + '/configs/ is not a directory');
      resultStatus = false;
    }
  } catch(e) {
    self.message('error', 'Root dir: ' + self.RootDirectory + '/configs/ doesnot exists');
    resultStatus = false;

  }

  // Check logs directory
  try {
    stat = fs.statSync(self.RootDirectory + '/logs/');
    if (!stat.isDirectory()) {
      self.message('error', 'Root dir: ' + self.RootDirectory + '/logs/ is not a directory');
      resultStatus = false;
    }
  } catch(e) {
    self.message('error', 'Root dir: ' + self.RootDirectory + '/logs/ doesnot exists');
    resultStatus = false;

  }

  // Check logs directory
  try {
    stat = fs.statSync(self.RootDirectory + '/pids/');
    if (!stat.isDirectory()) {
      self.message('error', 'Root dir: ' + self.RootDirectory + '/pids/ is not a directory');
      resultStatus = false;
    }
  } catch(e) {
    self.message('error', 'Root dir: ' + self.RootDirectory + '/pids/ doesnot exists');
    resultStatus = false;

  }

  // Check if package.json exists.
  try {
    stat = fs.statSync(self.getPackageJSONPath());
    if (!stat.isFile()) {
      self.message('error', self.getPackageJSONPath() + ' is not a valid file');
      resultStatus = false;
    } else {
      // Check if package.json is valid file.
      try {
        JSON.parse(fs.readFileSync(self.getPackageJSONPath()));
      } catch (e) {
        self.message('error', e + ' in file: ' + self.getPackageJSONPath());
        resultStatus = false;
      }
    }

  } catch(e) {
    self.message('error', self.getPackageJSONPath() + ' does not exists');
    resultStatus = false;
  }

  return resultStatus;
}
 */
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
 * Check Project directory skeleton (congis,services, pids, logs directories).
 */
MFWCliClass.prototype.checkSkel = function() {
  var self = this;
  let status = true;
  if (!self.checkDirectory('services')) {
    status = false;
  }
  if (!self.checkDirectory('logs')) {
    status = false;
  }
  if (!self.checkDirectory('pids')) {
    status = false;
  }
  if (!self.checkDirectory('configs')) {
    status = false;
  }
  return status;
}

/**
 * Check directory. Emits isDirExists.
 */
MFWCliClass.prototype.checkDirectory = function(subDir) {
  var self = this;
  var Directory = self.RootDirectory + '/' + subDir;
  try {
    let stats = fs.statSync(Directory);
    if (stats.isDirectory()) {
      return true;
    }
    self.message('error', Directory + ' is not a directory!');
    return false;

  } catch (e) {
    try {
      fs.ensureDirSync(Directory);
      self.message('ok', 'Creating ' + Directory);
    } catch(e) {
      console.log(e);
      self.message('error', e.message);
      return false;
    }
  }
  return true;
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
 * Install .gitignore from template.
 */
MFWCliClass.prototype.installGitIgnore = function() {
  var self = this;
  let gitIgnore = path.resolve(__dirname + '/../templates/gitignore');
  fs.stat(self.RootDirectory + '/.gitignore', function(err, stats) {
    if (err) {
      fs.copy(gitIgnore, self.RootDirectory + '/.gitignore',
        { overwrite: true },
        function(err) {
        if (err) {
          return self.message('error', err.message);
        }
        return self.message('ok', '.gitignore copied');
      });
    }
  });
}


/**
 * Process init command.
 */
module.exports.ProjectClass = ProjectClass;
module.exports.commander = function(commander) {
  commander.command('init [dir]')
    .description('Init directory as a project.')
    .option('-e, --env <name>', 'Environment. Helps to separate production, stage, devel.')
    .action(function(rootDIR, options) {
      let settings = {};
      if (!rootDIR) {
        rootDIR = process.cwd();
      }
      settings.RootDirectory = path.resolve(rootDIR);
      settings.envName = options.env;
      if (!settings.envName) {
        settings.envName = '';
      }
      if (settings.envName == 'default') {
        settings.envName = '';
      }

      let MFWCli = new ProjectClass(settings);
      MFWCli.initProject();
    });

  commander.command('install [service]')
    .description('Install microservice.'
      + 'Use nothing or "all" to install all services saved in package.json.')
    .option('-r, --root <dir>', 'Optionaly root directory')
    .option('-s, --save', 'Save microservice information')
    .option('-d, --default', 'Set default values')
    .action(function(service, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      let MFWCli = new ProjectClass(settings);

      if (!service) {
        service = 'all';
      }
      if (service == 'all') {
        return MFWCli.updateAll();
      }
      let possibleLocalPath = path.resolve(service);
      try {
        let stat = fs.statSync(possibleLocalPath);
        if (possibleLocalPath == settings.RootDirectory) {
          MFWCli.error('You could not install service into itself :)');
          return;
        }
      } catch(e) {}
      MFWCli.installService(service, options.save, options.default);
    });

  commander.command('update [service]')
    .description('Update microservice.'
      + 'Use nothing or "all" to update or install all services saved in package.json.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-d, --default', 'Set default values')
    .action(function(service, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      let MFWCli = new ProjectClass(settings);

      if (!service) {
        service = 'all';
      }

      if (service == 'all') {
        return MFWCli.updateAll();
      }
      return MFWCli.updateService(service, options.default);
    });

}

/**
 * Process update command.

module.exports.updateService = function(service, options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };
  let MFWCli = new MFWCliClass(settings);

  if (!service) {
    service = 'all';
  }

  if (service == 'all') {
    return MFWCli.updateAll();
  }
  return MFWCli.update(service, options.default);
}
 */
/**
 * Process uninstall command.

module.exports.uninstallService = function(service, options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };

  let MFWCli = new MFWCliClass(settings);
  MFWCli.uninstall(service, options.save);
}
 */

/**
 * Process start command.

module.exports.startService = function(service, options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };
  let MFWCli = new MFWCliClass(settings);

  if (!service) {
    service = 'all';
  }

  if (service == 'all') {
    return MFWCli.startAll(options.devel);
  }
  MFWCli.start(service, options.devel);
}
 */

/**
 * Process stop command.

module.exports.stopService = function(service, options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };
  let MFWCli = new MFWCliClass(settings);

  if (!service) {
    service = 'all';
  }

  if (service == 'all') {
    return MFWCli.stopAll();
  }
  MFWCli.stop(service);
}
 */

/**
 * Process env command.

module.exports.envList = function(envName, options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };
  let MFWCli = new MFWCliClass(settings);

  if (envName) {
    if (envName == 'default') {
      envName = '';
    }
    return MFWCli.envSet(envName);
  }
  if (options.list) {
    var envs = CommonFunc.findEnvironments(settings.RootDirectory, options.extended);
    console.log(JSON.stringify(envs, null, 2));
  }
}
 */
/**
 * Process fix command.

module.exports.fix = function(options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };
  let MFWCli = new MFWCliClass(settings);
  MFWCli.fix();
}
 */