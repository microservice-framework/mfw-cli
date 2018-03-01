const expect  = require("chai").expect;
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('cross-spawn');
const os = require("os"); 

describe('Project commands',function(){

  it('init - no options', function(done){
    var tmpDir = tmp.dirSync();
    console.log(tmpDir);
    var rootDir = process.cwd();
    let isEnd = false;
    let childInit = spawn(rootDir + '/bin/mfw', ["init", "--json"], { cwd: tmpDir.name });

    childInit.stdout.on('data', function (data) {
      let incoming = data.toString();
      console.log('incoming' + incoming);
      if(!isEnd) {
        if(incoming.indexOf('name:') !== -1) {
          childInit.stdin.write("test\r\n");
        } else {
          childInit.stdin.write("\r\n");
        }
      }
    });

    setTimeout(()=> {
      isEnd = true;
      childInit.stdin.end();
    }, 1000);

    childInit.on('close', function(code){
      expect(code).to.equal(0, "init exited with code " + code);
      done();
    });

    //exec( rootDir + '/bin/mfw init --json', {cwd: tmpDir.name}, (error, stdout, stderr) => {
    //  console.log(error, stdout, stderr );
    //  done();
    //});
  });

});