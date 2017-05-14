'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Get Root directory based on command options.
 */
module.exports.getRoot = function(options) {
  var rootDIR = options.root;
  if (!rootDIR) {
    rootDIR = process.cwd();
  }
  return path.resolve(rootDIR);
}

/**
 * Find env packages.
 */
module.exports.findEnvironments = function(startPath, isExtended) {
  var results = {};
  var filter = 'package.json';

  if (!fs.existsSync(startPath)) {
    return;
  }

  var files = fs.readdirSync(startPath);
  for (var i = 0; i < files.length; i++) {
    var filename = files[i];
    var index = filename.indexOf(filter);
    var packageJSON = '';
    if (index >= 0) {
      if (isExtended) {
        try {
          packageJSON = JSON.parse(fs.readFileSync(path.join(startPath,filename)));
        } catch (e) {
          return console.log(e);
        }
      } else {
        packageJSON = filename;
      }
    }
    if (index == 0) {
      results['default'] = packageJSON;
    }
    if (index > 0) {
      var env = filename.substring(0,index - 1);
      results[env] = packageJSON;
    }
  }
  return results;
}
