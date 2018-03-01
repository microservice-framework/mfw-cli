'use strict';

const fs = require('fs-extra');
const exec = require('child_process').exec;
const spawn = require('cross-spawn');
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
    if (this.isJsonOutput) {
      super.printMessages();
      return;
    }
    let rows = [];
    let status = this.messages.status;
    delete this.messages.status;
    super.printMessages();

    if (status.length > 0) {
      for (let message of status) {
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
      }
    }

    if (rows.length == 0) {
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
      } catch (e) {
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
    if (typeof data === 'boolean') {
      status.error = 'No pid file available.';
      if (this.isReport) {
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
      if (this.isReport) {
        return this.emit('status', status);
      }
      this.message('status', status);
      return;
    }
    pusage.stat(status.pid, (err, stat) => {
      if (err) {
        status.error = 'Failed to get status by PID : ' + status.pid;
        if (this.isReport) {
          return this.emit('status', status);
        }
        this.message('status', status);
        return;
      }
      status.cpu = stat.cpu.toFixed(2);
      status.mem = Math.round(stat.memory / 1024 / 1024);
      if (this.isReport) {
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
      if (!status.error) {
        return this.message('error', status.name + ' already running.');
      }
      this.execStartService(serviceName, status);
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
      if (!status.error) {
        return this.message('error', status.name + ' already running.');
      }
      this.execStartService(status.service.short, status);
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
      if (status.error) {
        return this.message('error', status.name + ' ' + status.error);
      }
      this.execStopService(serviceName, status);
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
      if (status.error) {
        return this.message('error', status.name + ' ' + status.error);
      }
      this.execStopService(status.service.short, status);
    });

    let packageJSON = this.getPackageJSON();
    if (packageJSON.services) {
      for (let serviceName in packageJSON.services) {
        this.statusService(serviceName);
      }
    }
  }

  /**
   * Restart service.
   *
   * @param {string} serviceName - service name.
   */
  restartService(serviceName) {
    if (!this.validateRootDir()) {
      return this.message('error', serviceName + ' start Failed');
    }

    this.isReport = true;

    this.on('stopped', (serviceName, status) => {
      this.execStartService(serviceName, status);
    });

    this.on('status', (status) => {
      if (status.error) {
        this.message('warning', status.name + ' ' + status.error);
        this.execStartService(status.name, status);
        return;
      }
      this.execStopService(serviceName, status);
    });

    this.statusService(serviceName);
  }

  /**
   * Restart all Services.
   */
  restartAllServices() {
    if (!this.validateRootDir()) {
      return this.message('error', 'Stop All Failed');
    }

    this.isReport = true;

    this.on('stopped', (serviceName, status) => {
      this.execStartService(serviceName, status);
    });

    this.on('status', (status) => {
      if (status.error) {
        this.message('warning', status.name + ' ' + status.error);
        this.execStartService(status.name, status);
        return;
      }
      this.execStopService(status.service.short, status);
    });

    let packageJSON = this.getPackageJSON();
    if (packageJSON.services) {
      for (let serviceName in packageJSON.services) {
        this.statusService(serviceName);
      }
    }
  }

  prepareCmdForSpawn(cmdline) {
    let result = {
      cmd: '',
      args: [],
      env: []
    }
    let cmdLine = cmdline.split(' ');
    if (cmdLine.length == 0) {
      throw new Error('Empty command line');
    }
    let i = 0;
    let envCatched = false;
    while (i < cmdLine.length) {
      if (cmdLine[i] == '') {
        i++;
        continue;
      }
      // Special hack for WIN.Should be depricated in v2.
      if (cmdLine[i].indexOf('=') != -1 && !envCatched) {
        envCatched = true;
        // this is env var
        let envLine = cmdLine[i].split('=', 2);
        result.env.push({
          name: envLine[0],
          value: envLine[1]
        });
        i++
        continue;
      }
      result.args.push(cmdLine[i]);
      i++;
    }
    result.cmd = result.args.shift();
    return result;
  }

  /**
   * Start service by name.
   *
   * @param {string} serviceName - service name.
   */
  execStartService(serviceName, status) {
    let serviceDir = this.RootDirectory + '/services/' + serviceName;
    let packageJSON = this.getPackageJSON();
    let env = process.env;
    env.mfw_package_name = packageJSON.name;
    env.mfw_package_version = packageJSON.version;
    env.mfw_package_description = packageJSON.description;
    env.npm_package_name = status.package.name;
    env.npm_package_version = status.package.version;
    env.npm_package_description = status.package.description;

    let cmdLine = status.package.scripts[status.start].split(' ');
    let name = status.start;

    try {
      var preparedCMD = this.prepareCmdForSpawn(status.package.scripts[status.start]);
      if (preparedCMD.env.length > 0) {
        for (let item of preparedCMD.env) {
          env[item.name] = item.value;
        }
      }
    } catch (e) {
      return this.message('error', e.message);
    }

    if (this.devel) {
      this.progressMessage('starting ' + serviceName + ':' + name + ' in devel mode');
      env.DEBUG = '*';
      env.DEVEL = true;

      let child = spawn(preparedCMD.cmd, preparedCMD.args, {
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
      let child = spawn(preparedCMD.cmd, preparedCMD.args, {
        cwd: serviceDir,
        env: env,
        detached: true,
        stdio: 'ignore'
      });
      if (child.exitCode) {
        this.message('error', 'Died with code' + child.exitCode);
      } else {
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
  execStopService(serviceName, status) {
    let serviceDir = this.RootDirectory + '/services/' + serviceName;
    let packageJSON = this.getPackageJSON();
    let env = process.env;
    env.mfw_package_name = packageJSON.name;
    env.mfw_package_version = packageJSON.version;
    env.mfw_package_description = packageJSON.description;
    env.npm_package_name = status.package.name;
    env.npm_package_version = status.package.version;
    env.npm_package_description = status.package.description;

    let cmdLine = status.package.scripts[status.start].split(' ');
    let name = status.stop;

    try {
      var preparedCMD = this.prepareCmdForSpawn(status.package.scripts[status.stop]);
      if (preparedCMD.env.length > 0) {
        for (let item of preparedCMD.env) {
          env[item.name] = item.value;
        }
      }
    } catch (e) {
      return this.message('error', e.message);
    }
    this.progressMessage('stopping ' + serviceName + ':' + name);
    let child = spawn(preparedCMD.cmd, preparedCMD.args, {
      cwd: serviceDir,
      stdio: 'inherit',
      env: env
    });
    child.on('error', (err) => {
      console.log(err);
    });
    child.on('exit', (code) => {
      if (code == 0) {
        this.message('ok', 'Stop signal sent to ' + serviceName + ':' + name);
        this.emit('stopped', serviceName, status);
        return;
      }
      console.log('Child exited with code ' + code);
    });
  }

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
      if (!service) {
        service = 'all'
      }
      if (service == 'all') {
        return status.statusAllServices();
      }
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
    });
    commander.command('restart [service]')
      .description('Restart microservice(s).'
        + ' Use "all" to install all services saved in package.json.')
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
          return status.restartAllServices();
        }
        status.restartService(service);
      });

}
