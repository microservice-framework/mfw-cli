const expect  = require("chai").expect;
const tmp = require('tmp');
const exec = require('child_process').exec;
const spawn = require('cross-spawn');
const fs = require('fs-extra');

var debug = false;
if (process.env.DEBUG) {
  debug = true;
}

const execMFW = function(cmd, args, cwd, callback) {
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

var tmpCWD = ''

describe('Status commands',function(){

  it('init - no options', function(done){
    tmpCWD = tmp.dirSync();
    if (debug){
      console.log('\tTMP: ' + tmpCWD.name);
    }
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', ["init", "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  });


  it('install github:microservice-framework/example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "install",
      "github:microservice-framework/example-todo",
      "-s",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });


  it('start example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "start",
      "example-todo",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('status example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "status",
      "example-todo",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('stop example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "example-todo",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('start example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "start",
      "example-todo",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('status example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "status",
      "example-todo",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('stop example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "example-todo",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('start', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "start",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('status', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "status",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('stop', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('start all -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "start",
      "all",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('status all -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "status",
      "all",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('stop all -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "all",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('restart', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "restart",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('restart example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "restart",
      "example-todo",
      "-r",
      tmpCWD.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('stop', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('Clean TMP dirs', function(done){
    if (!debug){ 
      fs.emptyDirSync(tmpCWD.name);
      tmpCWD.removeCallback();
    } else {
      console.log('Dont forget to remove tmp dir: ' + tmpCWD.name + "\n");
    }
    done();
  })

});
