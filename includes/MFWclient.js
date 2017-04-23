/**
 * Process JSON validation and execute tasks.
 * Parse request and s
 */
'use strict';

const MicroserviceClient = require('@microservice-framework/microservice-client');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const colors    = require('colors/safe');
const Message = require('../includes/message.js');


/**
 * Incapsulate logic for mfw-cli commands.
 * @constructor.
 */
function MFWClientClass() {
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

util.inherits(MFWClientClass, EventEmitter);

/**
 * Process POST.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {string} jsonData - not parsed json data.
 * @param {object} options - Available options.
 */
MFWClientClass.prototype.post = function(RootDirectory, module, jsonData, options) {
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
    var data = {};
    try {
      data = JSON.parse(jsonData);
    } catch(e) {
      return self.message('error', e.message);
    }

    var client = self.prepareClient(module);
    client.post(data, function(err, handlerResponse) {
      self.answerHandler(err, handlerResponse);
    });

  });
  self.checkRootDirectory();
}

/**
 * Process GET.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {string} id - resource id
 * @param {object} options - Available options.
 */
MFWClientClass.prototype.get = function(RootDirectory, module, id, options) {
  console.log(id);
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

    var client = self.prepareClient(module);

    if (options.token) {
      return client.get(id, options.token, function(err, handlerResponse) {
        self.answerHandler(err, handlerResponse);
      });
    }
    client.get(id, function(err, handlerResponse) {
      self.answerHandler(err, handlerResponse);
    });

  });
  self.checkRootDirectory();
}

/**
 * Process PUT.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {string} id - resource id
 * @param {string} jsonData - not parsed json data.
 * @param {object} options - Available options.
 */
MFWClientClass.prototype.put = function(RootDirectory, module, id, jsonData, options) {
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

    var data = {};
    try {
      data = JSON.parse(jsonData);
    } catch(e) {
      return self.message('error', e.message);
    }

    var client = self.prepareClient(module);

    if (options.token) {
      return client.put(id, options.token, data, function(err, handlerResponse) {
        self.answerHandler(err, handlerResponse);
      });
    }
    client.put(id, data, function(err, handlerResponse) {
      self.answerHandler(err, handlerResponse);
    });

  });
  self.checkRootDirectory();
}

/**
 * Process Delete.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {string} id - resource id
 * @param {object} options - Available options.
 */
MFWClientClass.prototype.delete = function(RootDirectory, module, id, options) {
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

    var client = self.prepareClient(module);

    if (options.token) {
      return client.delete(id, options.token, function(err, handlerResponse) {
        self.answerHandler(err, handlerResponse);
      });
    }
    client.delete(id, function(err, handlerResponse) {
      self.answerHandler(err, handlerResponse);
    });

  });
  self.checkRootDirectory();
}

/**
 * Process SEARCH.
 *
 * @param {string} RootDirectory - resolved path to project directory.
 * @param {string} module - service name. Example: @microservice-framework/microservice-router
 * @param {string} jsonData - not parsed json data.
 * @param {object} options - Available options.
 */
MFWClientClass.prototype.search = function(RootDirectory, module, jsonData, options) {
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
    var data = {};
    try {
      data = JSON.parse(jsonData);
    } catch(e) {
      return self.message('error', e.message);
    }

    var client = self.prepareClient(module);
    client.search(data, function(err, handlerResponse) {
      self.answerHandler(err, handlerResponse);
    });

  });
  self.checkRootDirectory();
}

/**
 * Process answer.
 */
MFWClientClass.prototype.answerHandler = function(err, handlerResponse) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  self.message('ok', '\n' + JSON.stringify(handlerResponse, null, 2));
}

/**
 * Prepare client.
 */
MFWClientClass.prototype.prepareClient = function(module) {
  var self = this;
  require('dotenv').config({
    silent: true,
    path: module.envFile
  });

  var clientSettings = {
    URL: process.env.SELF_URL
  }
  if (process.env.SECURE_KEY) {
    clientSettings.secureKey = process.env.SECURE_KEY;
  }

  if (process.env.ACCESS_TOKEN) {
    clientSettings.accessToken = process.env.ACCESS_TOKEN;
  }
  return new MicroserviceClient(clientSettings);
}

/**
 * Check Project root directory. Emits isRootExists.
 */
MFWClientClass.prototype.checkRootDirectory = function() {
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
 * Check module. Emits isModuleExists.
 *
 * @param {object} module - module data.
 */
MFWClientClass.prototype.checkModule = function(module) {
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
MFWClientClass.prototype.isRootExists = function(err, type) {
  var self = this;
  if (err) {
    return self.message('error', err.message);
  }
  if (!type) {
    return self.message('error', 'There is no root directory.');
  }

  var moduleInfo = {
    module: self.module,
    installDir: self.RootDirectory + '/services/' + self.module,
    envFile: self.RootDirectory + '/configs/' + self.module + '.env',
  }
  self.checkModule(moduleInfo);
}

/**
 * Set message.
 */
MFWClientClass.prototype.message = function(type, message) {
  var self = this;
  self.messages[type].push(message);
}


/**
 * Print Messages. Executed process.on('exit').
 */
MFWClientClass.prototype.printMessages = function() {
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
 * Process create command.
 */
function clientPOST(service, jsonData, options) {
  var rootDIR = getRoot(options);
  var client = new MFWClientClass();
  client.post(rootDIR, service, jsonData, options);
}

/**
 * Process read command.
 */
function clientGET(service, id, options) {
  var rootDIR = getRoot(options);
  var client = new MFWClientClass();
  client.get(rootDIR, service, id, options);
}

/**
 * Process update command.
 */
function clientPUT(service, id, jsonData, options) {
  var rootDIR = getRoot(options);
  var client = new MFWClientClass();
  client.put(rootDIR, service, id, jsonData, options);
}

/**
 * Process delete command.
 */
function clientDEL(service, id, options) {
  var rootDIR = getRoot(options);
  var client = new MFWClientClass();
  client.delete(rootDIR, service, id, options);
}

/**
 * Process search command.
 */
function clientSEARCH(service, jsonData, options) {
  var rootDIR = getRoot(options);
  var client = new MFWClientClass();
  client.search(rootDIR, service, jsonData, options);
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


module.exports.clientPOST = clientPOST;
module.exports.clientGet = clientGET;
module.exports.clientPUT = clientPUT;
module.exports.clientDEL = clientDEL;
module.exports.clientSEARCH = clientSEARCH;
