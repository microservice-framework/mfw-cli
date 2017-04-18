'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs-extra');
const Message = require('../includes/message.js');
const tmp = require('tmp');
const exec = require('child_process').exec;

/**
 * Constructor.
 */
function MFWCliClass(RootDirectory) {
  EventEmitter.call(this);
  var self = this;

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
    return Message.error(err.message);
  }

  if (!type) {
    return Message.error(module.full + ' is not installed yet')
    //return;
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
    return Message.error(err.message);
  }

  if (type) {
    Message.warning(module.installDir + ' already exists. Overwriting.');
    //return;
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
    return Message.error(err.message);
  }

  if (type) {
    Message.warning(self.RootDirectory + ' already exists.');
    return self.checkSkel();
  }

  fs.mkdir(self.RootDirectory, function(err) {
    if (err) {
      return Message.error(err.message);
    }
    return self.checkSkel();
  });
}

/**
 * Get executed when Sub directory get checked for existance.
 */
MFWCliClass.prototype.isDirExists = function(err, type, dir) {
  var self = this;
  if (err) {
    return Message.error(err.message);
  }
  if (type) {
    return Message.warning(dir + ' already exists.');
  }

  fs.mkdir(dir, function(err) {
    if (err) {
      return Message.error(err.message);
    }
    return Message.ok(dir + ' created.');
  });
}


/**
 * Get executed when Module installed.
 */
MFWCliClass.prototype.isModuleDownloaded = function(err, module) {
  var self = this;
  if (err) {
    return Message.error(err.message);
  }
  process.chdir(module.installDir);
  return exec('npm install', function(error, stdout, stderr) {
    if(error) {
      return Message.error(module.full + ' installed, but `npm install` failed:' + error.message);
    }
    return Message.ok(module.full + ' installed.');
  });

}

/**
 * Get executed when Module installed.
 */
MFWCliClass.prototype.isModuleDownloadedForUpdate = function(err, module) {
  var self = this;
  if (err) {
    return Message.error(err.message);
  }
  process.chdir(module.installDir);
  return exec('npm update', function(error, stdout, stderr) {
    if(error) {
      return Message.error(module.full + ' updated, but `npm update` failed:' + error.message);
    }
    return Message.ok(module.full + ' updated.');
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
    fs.copy(module.tmpDir.name + '/package/', module.installDir, { overwrite: true }, function(err) {
      fs.emptyDirSync(module.tmpDir.name);
      module.tmpDir.removeCallback();
      return self.emit('isModuleDownloaded', err, module);
    });
  });
}

exports = module.exports = new MFWCliClass();
