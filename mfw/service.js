'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('cross-spawn');
const path = require('path');
const pusage = require('pidusage');
const colors = require('colors/safe');
const Table = require('cli-table');

const CommonFunc = require('../includes/common.js');
const MFWCommandPrototypeClass = require('../includes/MFWCommandPrototypeClass.js');
const Message = require('../includes/message.js');


class StatusClass extends MFWCommandPrototypeClass {
  constructor(settings) {
    super(settings);
    this.messages = {
      ok: [],
      error: [],
      warning: [],
    status: [],
      unknown: [],
    }
  }
  /**
   * Print Messages. Executed process.on('exit').
   */
  printMessages() {
    var rows = [];
    for (let type in this.messages) {
      if (this.messages[type].length > 0) {
        for (let message of this.messages[type]) {
          if (type == 'status') {
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
    if(rows.length == 0) {
      return;
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
   * Service STATUS.
   *
   * @param {string} module - service name. Example: microservice-router
   */
  statusService(module) {
    if (!this.validateRootDir()) {
      return this.message('error', 'Status Failed');
    }

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }
        try {
          var modulePackageJSON = JSON.parse(fs.readFileSync(module.installDir + '/package.json'));
        } catch (e) {
          this.message('error', 'Failed to read: ' + module.installDir + '/package.json');
          this.message('error', e.message);
          return;
        }
        if (!modulePackageJSON.scripts || modulePackageJSON.scripts.length == 0) {
          return this.message('error', 'Failed to get status for ' + module.module
            + ' - scripts not defined');
        }
        module.package = modulePackageJSON;

        let listToCheck = [];
        for (let name in modulePackageJSON.scripts) {
          if (name.indexOf('status') != -1) {
            listToCheck.push({
              name: name,
              script: modulePackageJSON.scripts[name]
            });
          }
        }
        if (listToCheck.length == 0) {
          this.progressMessage(module.module + ' don\'t have status');
          return;
        }
        for (let item of listToCheck) {
          this.processStatusCommand(module, item);
        }
      });
    });
  }

  /**
   * All Services STATUS.
   */
  statusAllServices() {
    if (!this.validateRootDir()) {
      return this.message('error', 'Status Failed');
    }
    let packageJSON = this.getPackageJSON();
    if (packageJSON.services) {
      for (let shortName in packageJSON.services) {
        this.statusService(shortName);
      }
    }
  }
  /**
   * Check module status.
   *
   * @param {object} module - module data.
   */
  processStatusCommand(module, script) {

    this.progressMessage('checking ' + module.short + ':' + script.name);
    let env = process.env;
    env.npm_package_name = module.short;
    exec(script.script, {cwd: module.installDir, env: env}, (err, stdout, stderr) => {
      if (err) {
        return this.message('error',  err.message);
      }
      try {
        var result = JSON.parse(stdout);
        for (var name in result) {
          this.processPidUsage(result[name], name, module);
        }
      }catch(e) {
        return this.message('error',  e.message);
      }
    });
  }

  /**
   * Check module status.
   *
   * @param {object} module - module data.
   */
  processPidUsage(data, name, module) {
    var status = {
      name: name,
      pid: false,
      start: 'start',
      stop: 'stop',
      cpu: '',
      mem: '',
      package: module.package,
      service: module,
    }
    if (typeof data === 'boolean'){
      status.error = 'No pid file available.';
      if(this.isReport) {
        return this.emit('status', status);
      }
      this.message('status', status);
      return;
    }
    if (typeof data === 'string' || typeof data === 'string') {
      status.pid = data;
    } else {
      status.pid = data.pid;
      status.start = data.start;
      status.stop = data.stop;
    }
    if (status.pid === false) {
      status.error = 'No pid file available.';
      if(this.isReport) {
        return this.emit('status', status);
      }
      this.message('status', status);
      return;
    }
    pusage.stat(status.pid, (err, stat) => {
      if (err) {
        status.error = 'Failed to get status by PID : ' + status.pid;
        if(this.isReport) {
          return this.emit('status', status);
        }
        this.message('status', status);
        return;
      }
      status.cpu = stat.cpu.toFixed(2);
      status.mem = Math.round(stat.memory / 1024 / 1024);
      if(this.isReport) {
        return this.emit('status', status);
      }
      this.message('status', status);
      return;
    });
  }

  /**
   * Start service.
   *
   * @param {string} serviceName - service name.
   * @param {boolean} isDevelMode - do not detach services from terminal and output log to stdout.
   */
  startService(serviceName, isDevelMode) {
    if (!this.validateRootDir()) {
      return this.message('error', serviceName + ' start Failed');
    }

    this.devel = isDevelMode;
    this.isReport = true;

    this.on('status', (status) => {
      console.log('status', status);
      if(!status.error) {
        return this.message('error', status.name + ' already running.');
      }
      this.execStartService(serviceName, status.start);
    });

    this.statusService(serviceName);
  }

  /**
   * Start all Services.
   */
  startAllServices(isDevelMode) {
    if (!this.validateRootDir()) {
      return this.message('error', 'Start All Failed');
    }

    this.devel = isDevelMode;
    this.isReport = true;

    this.on('status', (status) => {
      console.log('status', status);
      if(!status.error) {
        return this.message('error', status.name + ' already running.');
      }
      this.execStartService(status.service.short, status.start);
    });

    let packageJSON = this.getPackageJSON();
    if (packageJSON.services) {
      for (let serviceName in packageJSON.services) {
        this.statusService(serviceName);
      }
    }
  }

  /**
   * Stop service.
   *
   * @param {string} serviceName - service name.
   */
  stopService(serviceName) {
    if (!this.validateRootDir()) {
      return this.message('error', serviceName + ' start Failed');
    }

    this.isReport = true;

    this.on('status', (status) => {
      console.log('status', status);
      if(status.error) {
        return this.message('error', status.name + ' ' + status.error);
      }
      this.execStopService(serviceName, status.stop);
    });

    this.statusService(serviceName);
  }

  /**
   * Stop all Services.
   */
  stopAllServices() {
    if (!this.validateRootDir()) {
      return this.message('error', 'Stop All Failed');
    }

    this.isReport = true;

    this.on('status', (status) => {
      console.log('status', status);
      if(status.error) {
        return this.message('error', status.name + ' ' + status.error);
      }
      this.execStopService(status.service.short, status.stop);
    });

    let packageJSON = this.getPackageJSON();
    if (packageJSON.services) {
      for (let serviceName in packageJSON.services) {
        this.statusService(serviceName);
      }
    }
  }

  /**
   * Start service by name.
   *
   * @param {string} serviceName - service name.
   */
  execStartService(serviceName, name) {
    let serviceDir = this.RootDirectory + '/services/' + serviceName;
    let packageJSON = this.getPackageJSON();
    let env = process.env;
    env.mfw_package_name = packageJSON.name;
    env.mfw_package_version = packageJSON.version;
    env.mfw_package_description = packageJSON.description;

    if (this.devel) {
      this.progressMessage('starting ' + serviceName + ':' + name + ' in devel mode');
      env.DEBUG = '*';
      env.DEVEL = true;

      let child = spawn('npm', ['run', name, '-s' ], {
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
      this.progressMessage('starting '  + serviceName + ':' + name);
      let child = spawn('npm', ['run', name ], {
        cwd: serviceDir,
        env: env,
        detached: true,
        stdio: 'ignore'
      });
      if (child.exitCode) {
        this.message('error', 'Died with code' + child.exitCode);
      }else {
        this.message('ok', serviceName + ':' + name + ' started');
      }
      child.unref();
    }
  }
  /**
   * Stop service by name.
   *
   * @param {string} serviceName - service name.
   */
  execStopService(serviceName, name) {
    let serviceDir = this.RootDirectory + '/services/' + serviceName;
    this.progressMessage('stopping ' + serviceName + ':' + name);
    let child = spawn('npm', ['run', name, '-s' ], {cwd: serviceDir, stdio: 'inherit'});
    child.on('error', (err) => {
      console.log(err);
    });
    child.on('exit', (code) => {
      if(code == 0) {
        this.message('ok', 'Stop signal sent to ' + serviceName + ':' + name);
        return;
      }
      console.log('Child exited with code ' + code);
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
 * Validate service directory as a microservice
 *
 * @return {boolean} true if valid.
 */
MFWCliClass.prototype.validateServiceDir = function(directory) {
  var self = this;
  let resultStatus = true;
  let stat;
  try {
    stat = fs.statSync(directory);
    if (!stat.isDirectory()) {
      self.message('error', directory + ' is not a directory');
      resultStatus = false;
    }
  } catch(e) {
    self.message('error', directory + ' does not exists');
    resultStatus = false;
  }

  // Check if package.json exists.
  try {
    stat = fs.statSync(directory + '/package.json');
    if (!stat.isFile()) {
      self.message('error', directory + '/package.json is not a valid file');
      resultStatus = false;
    } else {
      // Check if package.json is valid file.
      try {
        let packageJSON = JSON.parse(fs.readFileSync(directory + '/package.json'));
        if (!packageJSON.scripts) {
          self.message('error', 'package.json.scripts is not defined');
          resultStatus = false;
        } else {
          let listToStart = [];
          for (var name in packageJSON.scripts) {
            if (name.indexOf('start') != -1) {
              listToStart.push(name);
            }
          }
          if (listToStart.length == 0) {
            self.message('error', 'package.json.scripts.start is not defined');
            resultStatus = false;
          }
          let listToStop = [];
          for (var name in packageJSON.scripts) {
            if (name.indexOf('stop') != -1) {
              listToStop.push(name);
            }
          }
          if (listToStop.length == 0) {
            self.message('error', 'package.json.scripts.stop is not defined');
            resultStatus = false;
          }
          let listToStatus = [];
          for (var name in packageJSON.scripts) {
            if (name.indexOf('status') != -1) {
              listToStatus.push(name);
            }
          }
          if (listToStatus.length == 0) {
            self.message('error', 'package.json.scripts.status is not defined');
            resultStatus = false;
          }
        }
      } catch (e) {
        self.message('error', e + ' in file: ' + directory + '/package.json');
        resultStatus = false;
      }
    }
  } catch(e) {
    console.log(e);
    self.message('error', directory + '/package.json does not exists');
    resultStatus = false;
  }
  return resultStatus;
}

/**
 * Validate Root directory as a project directory..
 *
 * @return {boolean} true if valid.
 */
MFWCliClass.prototype.validateRootDirForInit = function() {
  var self = this;
  let stat;
  try {
    stat = fs.statSync(self.RootDirectory);
    if (!stat.isDirectory()) {
      self.message('error', 'Root dir: ' + self.RootDirectory + ' is not a directory');
      return false;
    }
    try {
      stat = fs.statSync(self.RootDirectory + '/.env');
      if (!stat.isFile()) {
        self.message('error', self.RootDirectory + '/.env is not a file');
        return false;
      }
    } catch(e) {
      // no .env file. All is good.
    }
  } catch(e) {
    self.message('ok', 'Creating ' + self.RootDirectory);
    fs.ensureDirSync(self.RootDirectory);
  }

  // Check services directory
  try {
    stat = fs.statSync(self.RootDirectory + '/services/');
    if (!stat.isDirectory()) {
      self.message('error', self.RootDirectory + '/services/ is not a directory');
      return false;
    }
  } catch(e) {
    self.message('ok', 'Creating ' + self.RootDirectory + '/services/');
    fs.ensureDirSync(self.RootDirectory + '/services/');
  }

  // Check configs directory
  try {
    stat = fs.statSync(self.RootDirectory + '/configs/');
    if (!stat.isDirectory()) {
      self.message('error', self.RootDirectory + '/configs/ is not a directory');
      return false;
    }
  } catch(e) {
    self.message('ok', 'Creating ' + self.RootDirectory + '/configs/');
    fs.ensureDirSync(self.RootDirectory + '/configs/');
  }

  // Check logs directory
  try {
    stat = fs.statSync(self.RootDirectory + '/logs/');
    if (!stat.isDirectory()) {
      self.message('error', self.RootDirectory + '/logs/ is not a directory');
      return false;
    }
  } catch(e) {
    self.message('ok', 'Creating ' + self.RootDirectory + '/logs/');
    fs.ensureDirSync(self.RootDirectory + '/logs/');
  }

  // Check pids directory
  try {
    stat = fs.statSync(self.RootDirectory + '/pids/');
    if (!stat.isDirectory()) {
      self.message('error', self.RootDirectory + '/pids/ is not a directory');
      return false;
    }
  } catch(e) {
    self.message('ok', 'Creating ' + self.RootDirectory + '/pids/');
    fs.ensureDirSync(self.RootDirectory + '/pids/');
  }

  // Check if package.json exists.
  try {
    stat = fs.statSync(self.getPackageJSONPath());
    if (!stat.isFile()) {
      self.message('error', self.getPackageJSONPath() + ' is not a valid file');
      return false;
    }

    self.message('error', self.getPackageJSONPath() + ' exists already.');
    return false;

  } catch(e) {
    // no [env.]package.json file. All is good.
  }
  return true;
}

/**
 * Validate Root directory as a project directory..
 *
 * @return {boolean} true if valid.
 */
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

/**
 * Prepare module object.
 *
 * @param {string} module - service name.
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
 * perform Enviroment Switch
 */
MFWCliClass.prototype.performEnvSwitch = function() {
  var self = this;

  let servicesDir = self.RootDirectory + '/services';
  try {
    fs.removeSync(self.RootDirectory + '/.services.' + self.currentEnv);
  }catch(e) {
    console.log(e);
  }
  fs.renameSync(servicesDir, self.RootDirectory + '/.services.' + self.currentEnv);

  let newEnvService = self.RootDirectory + '/.services.' + self.envName;
  try {
    let stats = fs.statSync(newEnvService);
    if (!stats.isDirectory()) {
      return self.message('error', newEnvService + 'is not directory. Something is wrong here.');
    }
    fs.renameSync(newEnvService, servicesDir);
    fs.writeFileSync(self.RootDirectory + '/.env', self.envName);
    if (self.envName == '') {
      return self.message('ok', 'switched to: default');
    }
    self.message('ok', 'switched to: ' + self.envName);
  } catch(e) {
    self.message('warning', e);
    fs.mkdir(servicesDir, function(err) {
      if (err) {
        return self.message('error', err.message);
      }
      self.restoreModules();
      fs.writeFileSync(self.RootDirectory + '/.env', self.envName);
      if (self.envName == '') {
        return self.message('ok', 'switched to: default');
      }
      self.message('ok', 'switched to: ' + self.envName);
    });
    return;
  }
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
    },function(err) {
      if (err) {
        return self.emit('isModuleDownloaded', err, module);
      }
      if (!self.validateServiceDir(module.tmpDir.name + '/package/')) {
        fs.emptyDirSync(module.tmpDir.name);
        module.tmpDir.removeCallback();
        let err = new Error(module.short + ' is not valid microservice package');
        return self.emit('isModuleDownloaded', err , module);
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
    currentEnv = fs.readFileSync(self.RootDirectory + '/.env') + '';
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
    return;
  }
  self.message('ok', 'No services to install');
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
 * Set message.
 */
MFWCliClass.prototype.message = function(type, message) {
  var self = this;
  if (!self.messages[type]) {
    type = 'unknown';
  }
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
  for (let type in self.messages) {
    if (self.messages[type].length > 0) {
      for (let message of self.messages[type]) {
        Message[type](message);
      }
    }
  }
}

/**
 * Process init command.
 */
module.exports.commands = function(commander) {
  commander.command('init2 [dir]')
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
      let MFWCli = new MFWCliClass(settings);
      MFWCli.initProject();
    });
}

/**
 * Process init command.
 */
module.exports.initProject = function(rootDIR, options) {
  let settings = {};
  if (!rootDIR) {
    rootDIR = process.cwd();
  }
  settings.RootDirectory = path.resolve(rootDIR);
  settings.envName = options.env;
  if (!settings.envName) {
    settings.envName = '';
  }
  let MFWCli = new MFWCliClass(settings);
  MFWCli.initProject();
}

/**
 * Process install command.
 */
module.exports.installService = function(service, options) {

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

  let possibleLocalPath = path.resolve(service);
  try {
    let stat = fs.statSync(possibleLocalPath);
    if (possibleLocalPath == settings.RootDirectory) {
      Message.error('You could not install service into itself :)');
      return;
    }
  } catch(e) {}
  MFWCli.install(service, options.save, options.default);
}

/**
 * Process update command.
 */
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

/**
 * Process uninstall command.
 */
module.exports.uninstallService = function(service, options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };

  let MFWCli = new MFWCliClass(settings);
  MFWCli.uninstall(service, options.save);
}

/**
 * Process start command.
 */
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

/**
 * Process stop command.
 */
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

/**
 * Process env command.
 */
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

/**
 * Process fix command.
 */
module.exports.fix = function(options) {
  let settings = {
    RootDirectory: CommonFunc.getRoot(options)
  };
  let MFWCli = new MFWCliClass(settings);
  MFWCli.fix();
}

module.exports.StatusClass = StatusClass;
/**
 * Process commands.
 */
module.exports.commander = function(commander) {
  commander.command('status [service]')
    .description('Microservice(s) status')
    .option('-r, --root <dir>', 'Optionally root directory')
    .action(function(service, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      let status = new StatusClass(settings);
      if(!service) {
        service = 'all'
      }
      if(service == 'all') {
        return status.statusAllServices();
      }
      console.log('service', service);
      status.statusService(service);
    });

  commander.command('start [service]')
    .description('Start microservice(s). Use "all" to install all services saved in package.json.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-d, --devel', 'Optionally devel mode')
    .action(function(service, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      let status = new StatusClass(settings);
      if (!service) {
        service = 'all';
      }
      if (service == 'all') {
        return status.startAllServices(options.devel);
      }
      status.startService(service, options.devel);
    });

  commander.command('stop [service]')
    .description('Stop microservice(s). Use "all" to install all services saved in package.json.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .action(function(service, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      let status = new StatusClass(settings);

      if (!service) {
        service = 'all';
      }

      if (service == 'all') {
        return status.stopAllServices();
      }
      status.stopService(service);
    }
);

}
