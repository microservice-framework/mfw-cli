'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const Message = require('../includes/message.js');
const tmp = require('tmp');
const exec = require('child_process').exec;
const path = require('path');
const prompt = require('prompt');

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
  process.on('beforeExit', function(){
    self.printMessages();
  });
}
util.inherits(MFWCliClass, EventEmitter);

/**
 * Setup method.
 *   Prepare root directory.
 */
MFWCliClass.prototype.setup = function(RootDirectory) {
  var self = this;
  self.RootDirectory = RootDirectory;

  self.on('isRootExists', self.isRootExists);
  self.on('isDirExists', self.isDirExists);
  self.checkRootDirectory();
}

/**
 * Install method.
 *   Install service to ROOTDIR/services/SERVICE_NAME directory.
 */
MFWCliClass.prototype.install = function(RootDirectory, module) {
  var self = this;
  self.RootDirectory = RootDirectory;

  var nameArray = module.split('/');
  var shortName = nameArray.pop();
  self.module = {
    full: module,
    short: shortName,
    installDir: self.RootDirectory + '/services/' + shortName
  }

  self.on('isModuleExists', self.isModuleExists);
  self.on('isModuleDownloaded', self.isModuleDownloaded);
  self.checkModule(self.module);
}

/**
 * Install method.
 *   Install service to ROOTDIR/services/SERVICE_NAME directory.
 */
MFWCliClass.prototype.update = function(RootDirectory, module) {
  var self = this;
  self.RootDirectory = RootDirectory;

  var nameArray = module.split('/');
  var shortName = nameArray.pop();
  self.module = {
    full: module,
    short: shortName,
    installDir: self.RootDirectory + '/services/' + shortName
  }

  self.on('isModuleExists', self.isModuleExistsForUpdate);
  self.on('isModuleDownloaded', self.isModuleDownloadedForUpdate);
  self.checkModule(self.module);
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
MFWCliClass.prototype.isRootExists = function(err, type) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }

  if (type) {
    self.message('warning', self.RootDirectory + ' already exists.');
    self.installGitIgnore();
    return self.checkSkel();
  }

  fs.mkdir(self.RootDirectory, function(err) {
    if (err) {
      return self.message('error', err.message);
    }
    self.installGitIgnore();
    self.generatePackageJSON();
    return self.checkSkel();
  });
}

/**
 * Generate Package JSON.
 */
MFWCliClass.prototype.generatePackageJSON = function() {
  var self = this;
  prompt.start();
  try {
    var packageSchemaFile = path.resolve(__dirname + '/../templates/package.schema.json');
    var schema = JSON.parse(fs.readFileSync(packageSchemaFile));
  } catch(e) {
    return self.message('error', e.message);
  }
  prompt.get(schema, function(err, result) {
    if (err) {
      return self.message('error', e.message);
    }
    var packaheJSONFile = self.RootDirectory + '/package.json';
    fs.writeFile(packaheJSONFile, JSON.stringify(result, null, 2), function(err) {
      if (err) {
        return self.message('error', err.message);
      }
    });
  });
}

/**
 * Install .gitignore from template.
 */
MFWCliClass.prototype.installGitIgnore = function() {
  var self = this;
  var gitIgnore = path.resolve(__dirname + '/../templates/gitignore');
  fs.copy(gitIgnore, self.RootDirectory + '/.gitignore', { overwrite: true }, function(err) {
    if (err) {
      return self.message('error', err.message);
    }
    return self.message('ok', '.gitignore copied');
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
  process.chdir(module.installDir);
  return exec('npm install', function(error, stdout, stderr) {
    if (error) {
      return self.message('error', module.full + ' installed, but `npm install` failed:' + error.message);
    }
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
  process.chdir(module.installDir);
  return exec('npm update', function(error, stdout, stderr) {
    if (error) {
      return self.message('error', module.full + ' updated, but `npm update` failed:' + error.message);
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
  process.chdir(module.tmpDir.name);
  exec('npm pack ' + module.full + '|xargs tar -xzpf', function(err, stdout, stderr) {
    if (err) {
      return self.emit('isModuleDownloaded', err, module);
    }
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
 * Set message.
 */
MFWCliClass.prototype.message = function(type, message) {
  var self = this;
  self.messages[type].push(message);
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
