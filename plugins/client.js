'use strict';

const fs = require('fs-extra');
const MicroserviceClient = require('@microservice-framework/microservice-client');
const MFWCommandPrototypeClass = require('../includes/MFWCommandPrototypeClass.js');
const CommonFunc = require('../includes/common.js');

class ClientClass extends MFWCommandPrototypeClass {
  constructor(settings) {
    super(settings);
    if (settings.token) {
      this.token = settings.token;
    }
    if (settings.accesstoken) {
      this.accesstoken = settings.accesstoken;
    }
  }
  /**
   * Process POST.
   *
   * @param {string} module - service name. Example: @microservice-framework/microservice-router
   * @param {string} data - not parsed json data.
   */
  post(module, data) {
    if (!this.validateRootDir()) {
      return this.message('error', 'POST Failed');
    }

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }

        let client = this.prepareClient(module);
        if (client === false) {
          return;
        }

        try {
          let jsonData = JSON.parse(data);
          client.post(jsonData, (err, handlerResponse) => {
            this.answerHandler(err, handlerResponse);
          });
        } catch (e) {
          this.message('error', e.message);
        }
      });
    });
  }

  /**
   * Process GET.
   *
   * @param {string} module - service name. Example: @microservice-framework/microservice-router
   * @param {string} id - resource id
   */
  get(module, id) {
    if (!this.validateRootDir()) {
      return this.message('error', 'GET Failed');
    }

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }

        let client = this.prepareClient(module);
        if (client === false) {
          return;
        }
        if (this.token) {
          client.get(id, this.token, (err, handlerResponse) => {
            this.answerHandler(err, handlerResponse);
          });
        } else {
          client.get(id, (err, handlerResponse) => {
            this.answerHandler(err, handlerResponse);
          });
        }
      });
    });
  }

  /**
   * Process PUT.
   *
   * @param {string} module - service name. Example: @microservice-framework/microservice-router
   * @param {string} id - resource id
   * @param {string} data - not parsed json data.
   */
  put(module, id, data) {
    if (!this.validateRootDir()) {
      return this.message('error', 'PUT Failed');
    }

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }

        let client = this.prepareClient(module);
        if (client === false) {
          return;
        }

        try {
          let jsonData = JSON.parse(data);
          if (this.token) {
            client.put(id, this.token, jsonData, (err, handlerResponse) => {
              this.answerHandler(err, handlerResponse);
            });
          } else {
            client.put(id, jsonData, (err, handlerResponse) => {
              this.answerHandler(err, handlerResponse);
            });
          }
        } catch (e) {
          this.message('error', e.message);
        }
      });
    });
  }

  /**
   * Process DELETE.
   *
   * @param {string} module - service name. Example: @microservice-framework/microservice-router
   * @param {string} id - resource id
   */
  delete(module, id) {
    if (!this.validateRootDir()) {
      return this.message('error', 'DELETE Failed');
    }

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }

        let client = this.prepareClient(module);
        if (client === false) {
          return;
        }
        if (this.token) {
          client.delete(id, this.token, (err, handlerResponse) => {
            this.answerHandler(err, handlerResponse);
          });
        } else {
          client.get(id, (err, handlerResponse) => {
            this.answerHandler(err, handlerResponse);
          });
        }
      });
    });
  }

  /**
   * Process SEARCH.
   *
   * @param {string} module - service name. Example: @microservice-framework/microservice-router
   * @param {string} data - not parsed json data.
   */
  search(module, data) {
    if (!this.validateRootDir()) {
      return this.message('error', 'POST Failed');
    }

    this.prepareModule(module, (module) => {
      fs.stat(module.installDir, (err, stats) => {
        if (err) {
          return this.message('error', module.full + ' is not installed yet');
        }
        if (!stats.isDirectory()) {
          return this.message('error', module.installDir + ' is not a directory!');
        }

        let client = this.prepareClient(module);
        if (client === false) {
          return;
        }

        try {
          let jsonData = JSON.parse(data);
          client.search(jsonData, (err, handlerResponse) => {
            this.answerHandler(err, handlerResponse);
          });
        } catch (e) {
          this.message('error', e.message);
        }
      });
    });
  }
  /**
   * Prepare client.
   */
  prepareClient(module) {
    require('dotenv').config({
      silent: true,
      path: module.envFile
    });

    var clientSettings = {
      URL: process.env.SELF_URL
    }

    if (this.accesstoken) {
      clientSettings.accessToken = this.accesstoken;
    } else {
      if (process.env.SECURE_KEY) {
        clientSettings.secureKey = process.env.SECURE_KEY;
      } else {
        this.message('error', 'You did not specify --accesstoken and there is no secure_key '
          + module.short);
        return false;
      }
    }
    return new MicroserviceClient(clientSettings);
  }
  /**
   * Process answer.
   */
  answerHandler(err, handlerResponse) {
    if (err) {
      let message = 'Unknown message: ' +  JSON.stringify(err);
      if (err.message) {
        message = err.message
      }
      if (err.error) {
        message = err.error
      }
      return this.message('error', message);
    }
    this.message('ok', 'Answer: \n' + JSON.stringify(handlerResponse, null, 2));
  }

}

module.exports.ProjectClass = ClientClass;
/**
 * Process commands.
 */
module.exports.commander = function(commander) {
  commander.command('client-create <service> <JSONDATA>')
    .description('Create resource in service.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-t, --token <token>',
      'Optionally token. If no token provided, SECURE_KEY used.')
    .option('-a, --accesstoken <accesstoken>',
      'Optionally access token. If no token is provided, then SECURE_KEY is used instead.')
    .action(function(service, jsonData, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      if (options.token) {
        settings.token =  options.token;
      }
      if (options.accesstoken) {
        settings.accesstoken =  options.accesstoken;
      }
      var client = new ClientClass(settings);
      client.post(service, jsonData);
    });
  commander.command('client-read <service> <id>')
    .description('Read resource by ID from service.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-t, --token <token>', 'Optionally token.')
    .option('-a, --accesstoken <accesstoken>', 'Optionally access token.')
    .action(function(service, id, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      if (options.token) {
        settings.token =  options.token;
      }
      if (options.accesstoken) {
        settings.accesstoken =  options.accesstoken;
      }
      var client = new ClientClass(settings);
      client.get(service, id);
    });
  commander.command('client-update <service> <id> <JSONDATA>')
    .description('Update resource by ID for service.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-t, --token <token>', 'Optionally token. If no token, SECURE_KEY used.')
    .option('-a, --accesstoken <accesstoken>',
      'Optionally access token. If no token is provided, then SECURE_KEY is used instead.')
    .action(function(service, id, jsonData, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      if (options.token) {
        settings.token =  options.token;
      }
      if (options.accesstoken) {
        settings.accesstoken =  options.accesstoken;
      }
      var client = new ClientClass(settings);
      client.put(service, id, jsonData);
    });
  commander.command('client-delete <service> <id>')
    .description('Delete resource by ID from service.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-t, --token <token>', 'Optionally token.')
    .option('-a, --accesstoken <accesstoken>', 'Optionaly access token.')
    .action(function(service, id, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      if (options.token) {
        settings.token =  options.token;
      }
      if (options.accesstoken) {
        settings.accesstoken =  options.accesstoken;
      }
      var client = new ClientClass(settings);
      client.delete(service, id);
    });
  commander.command('client-search <service> <JSONDATA>')
    .description('Search resource in service.')
    .option('-r, --root <dir>', 'Optionally root directory')
    .option('-t, --token <token>',
      'Optionally token. If no is token provided, then SECURE_KEY is used instead.')
    .option('-a, --accesstoken <accesstoken>',
      'Optionally access token. If no token is provided, then SECURE_KEY is used instead.')
    .action(function(service, jsonData, options) {
      let settings = {
        RootDirectory: CommonFunc.getRoot(options)
      };
      if (options.token) {
        settings.token =  options.token;
      }
      if (options.accesstoken) {
        settings.accesstoken =  options.accesstoken;
      }
      var client = new ClientClass(settings);
      client.search(service, jsonData);
    });
}
