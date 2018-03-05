const spawn = require('cross-spawn');

module.exports.execMFW = function(debug){
  return function(cmd, args, cwd, callback) {
    let isEnd = false;
    let timeout = false;
    if (!callback) {
      callback = cwd;
      cwd = process.cwd();
    }
    if (debug){
      console.log('exec' , cmd, args, cwd);
    }
    let childInit = spawn(cmd, args, { cwd: cwd });
    var output = '';
    childInit.stdout.on('data', function (data) {
      let incoming = data.toString();
      output = output + incoming;
      if (debug){
        console.log('>>> ' + incoming);
      }
      if (!isEnd) {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(()=> {
          isEnd = true;
          childInit.stdin.end();
        }, 1000);

        if (incoming.indexOf('name:') !== -1) {
          childInit.stdin.write("test\r\n");
          return;
        }
        if (incoming.indexOf('ROUTER SECRET') !== -1) {
          childInit.stdin.write("test\r\n");
          return;
        }
        
        childInit.stdin.write("\r\n");
      }
    });

    childInit.stdout.on('end', function() {
      isEnd = true;
      childInit.stdin.end();
    });

    childInit.on('close', function(code){
      callback(code, output);
    });
  }
}
