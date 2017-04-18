'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const fs = require('fs');
const Message = require('../includes/message.js');

function MFWCliClass(RootDirectory) {
  EventEmitter.call(this);
  var self = this;

}
util.inherits(RootDirectory, EventEmitter);

MFWCliClass.prototype.setup = function(RootDirectory) {
  var self = this;
  self.RootDirectory = RootDirectory;

  self.on('isRootExists', self.isRootExists);
  self.on('isDirExists', self.isDirExists);

  self.checkRootDirectory();
}

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

MFWCliClass.prototype.checkSkel = function() {
  var self = this;
  self.checkDirectory('services');
  self.checkDirectory('logs');
  self.checkDirectory('pids');
  self.checkDirectory('configs');
}

MFWCliClass.prototype.checkDirectory = function(subDir) {
  var self = this;
  var Directory = self.RootDirectory + '/' + subDir;
  fs.stat(self.RootDirectory, function(err, stats) {
    if (err) {
      return self.emit('isDirExists', null, false, Directory);
    }
    if (!stats.isDirectory()) {
      return self.emit('isDirExists', new Error(dir + ' is not a directory!'), false, Directory);
    }
    self.emit('isDirExists', null, true, Directory);
  });
}

exports = module.exports = new MFWCliClass();