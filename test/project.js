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
var tmpRootOption = ''
var tmpCWD = ''

describe('Project commands',function(){

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

  it('init [dir]', function(done){
    tmpRootOption = tmp.dirSync();
    if (debug){
      console.log('\tTMP: ' + tmpRootOption.name);
    }
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', ["init", tmpRootOption.name, "--json"], (code, output) => {
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

  it('install github:microservice-framework/example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "install",
      "github:microservice-framework/example-todo",
      "-s",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('install @microservice-framework/microservice-auth', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "install",
      "@microservice-framework/microservice-auth",
      "-s",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('install @microservice-framework/microservice-auth -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "install",
      "@microservice-framework/microservice-auth",
      "-s",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('update example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "update",
      "example-todo",
      "-d",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('update example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "update",
      "example-todo",
      "-d",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('update microservice-auth', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "update",
      "microservice-auth",
      "-d",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('update microservice-auth -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "update",
      "microservice-auth",
      "-d",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('uninstall example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "uninstall",
      "example-todo",
      "-s",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('uninstall example-todo -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "uninstall",
      "example-todo",
      "-s",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('env test', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "env",
      "test",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('env test -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "env",
      "test",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('env default', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "env",
      "default",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });

  });

  it('env default -r [root]', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "env",
      "default",
      "-r",
      tmpRootOption.name, "--json"], (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('Clean TMP dirs', function(done){
    if (!debug){ 
      fs.emptyDirSync(tmpRootOption.name);
      tmpRootOption.removeCallback();
      fs.emptyDirSync(tmpCWD.name);
      tmpCWD.removeCallback();
    } else {
      console.log('Dont forget to remove tmp dir: ' + tmpCWD.name + "\n");
      console.log('Dont forget to remove tmp dir: ' + tmpRootOption.name + "\n");
    }
    done();
  })

});
