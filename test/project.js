const expect  = require("chai").expect;
const tmp = require('tmp');
const fs = require('fs-extra');
const execMFW = require('./tools.js').execMFW;

var debug = false;
if (process.env.DEBUG) {
  debug = true;
}

var tmpRootOption = ''
var tmpCWD = ''

describe('Project commands',function(){
  it('setup [dir]', function(done){
    var tmpRootSetup = tmp.dirSync();
    if (debug){
      console.log('\tTMP: ' + tmpRootSetup.name);
    }
    var rootDir = process.cwd();

    execMFW('git', [
      "clone",
      "https://github.com/microservice-framework/api-todo-example.git"],
      tmpRootSetup.name, (code, output) => {
      expect(code).to.equal(0, "git clone  exited with code " + code + "\n" + output);
      execMFW(rootDir + '/bin/mfw', [
        "setup",
        tmpRootSetup.name + '/api-todo-example/',
        "--json"],
        (code, output) => {
        expect(code).to.equal(0, "setup exited with code " + code + "\n" + output);
        if (!debug){ 
          fs.emptyDirSync(tmpRootSetup.name);
          tmpRootSetup.removeCallback();
        } else {
          console.log('Dont forget to remove tmp dir: ' + tmpRootSetup.name + "\n");
          console.log('Dont forget to remove tmp dir: ' + tmpRootSetup.name + "\n");
        }
        done();
      });
    });
  });

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
      expect(code).to.equal(0, "install exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "install exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "install exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "install exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "update exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "update exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "update exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "update exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "uninstall exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "uninstall exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('env test', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "env",
      "test",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "env exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "env exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('env default', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "env",
      "default",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "env exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "env exited with code " + code + "\n" + output);
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
