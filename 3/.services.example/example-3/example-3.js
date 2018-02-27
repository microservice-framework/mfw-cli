/**
 * Profile Stats MicroService.
 */
'use strict';

const framework = '@microservice-framework';
const Cluster = require(framework + '/microservice-cluster');
const Microservice = require(framework + '/microservice');
const MicroserviceRouterRegister = require(framework + '/microservice-router-register').register;



require('dotenv').config();

var mservice = new Microservice({
  mongoUrl: process.env.MONGO_URL + process.env.MONGO_PREFIX + process.env.MONGO_OPTIONS,
  mongoTable: process.env.MONGO_TABLE,
  secureKey: process.env.SECURE_KEY,
  schema: process.env.SCHEMA
});

var mControlCluster = new Cluster({
  pid: process.env.PIDFILE,
  port: process.env.PORT,
  hostname: process.env.HOSTNAME,
  count: process.env.WORKERS,
  callbacks: {
    init: exampleINIT,
    validate: mservice.validate,
    POST: recordPOST,
    GET: mservice.get,
    PUT: mservice.put,
    DELETE: mservice.delete,
    SEARCH: recordSEARCH,
    OPTIONS: mservice.options
  }
});


/**
 * Init Handler.
 */
function exampleINIT(cluster, worker, address) {
  if (worker.id == 1) {
    var mserviceRegister = new MicroserviceRouterRegister({
      server: {
        url: process.env.ROUTER_URL,
        secureKey: process.env.ROUTER_SECRET,
        period: process.env.ROUTER_PERIOD,
      },
      route: {
        path: [process.env.SELF_PATH],
        url: process.env.SELF_URL,
        secureKey: process.env.SECURE_KEY
      },
      cluster: cluster
    });
  }
}

/**
 * POST middleware.
 */
function recordPOST(jsonData, requestDetails, callback) {
  try {
    mservice.validateJson(jsonData);
  } catch (e) {
    return callback(e, null);
  }

  // Check if record exists first.
  let searchRequest = {
    record_id: jsonData.record_id,
  };
  mservice.search(searchRequest, requestDetails, function(err, handlerResponse) {
    if (err) {
      return callback(err);
    }
    if (handlerResponse.code == 404) {
      return mservice.post(jsonData, requestDetails, callback);
    }

    handlerResponse.answer = handlerResponse.answer[0];
    callback(null, handlerResponse);
  });
}

/**
 * SEARCH middleware.
 */
function recordSEARCH(jsonData, requestDetails, callback) {
  mservice.search(jsonData, requestDetails, function(err, handlerResponse) {
    if (err) {
      return callback(err, handlerResponse);
    }
    for (var i in handlerResponse.answer) {
      if (handlerResponse.answer[i].user) {
        var username = handlerResponse.answer[i].user;
        handlerResponse.answer[i].user = {
          user: username,
          created: Date.now()
        }
      }
    }
    return callback(err, handlerResponse);
  });
}
