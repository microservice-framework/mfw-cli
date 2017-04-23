'use strict';
const fs = require('fs');
require('dotenv').config();

var pid = false;
if (process.env.PIDFILE) {
  pid = fs.readFileSync(process.env.PIDFILE).toString('utf8');
}

console.log(JSON.stringify({
  "microservice-auth" : pid
}));
