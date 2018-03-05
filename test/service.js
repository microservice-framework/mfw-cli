const expect  = require("chai").expect;
const tmp = require('tmp');
const fs = require('fs-extra');
const execMFW = require('./tools.js').execMFW;

var debug = false;
if (process.env.DEBUG) {
  debug = true;
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
      expect(code).to.equal(0, "install exited with code " + code + "\n" + output);
      done();
    });

  });


  it('start example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "start",
      "example-todo",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "start exited with code " + code + "\n" + output);
      done();
    });

  });

  it('status example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "status",
      "example-todo",
      "--json"], tmpCWD.name, (code, output) => {
      try {
        var answer = JSON.parse(output);
      } catch (e) {
        expect(e).to.equal(null, "JSON PARSE ERROR \n" + e + "\n" + output);
      }
      expect(answer.error.length).to.equal(0, "status exited with code " + code + "\n" + output);
      expect(code).to.equal(0, "status exited with code " + code + "\n" + output);
      done();
    });

  });

  it('stop example-todo', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "example-todo",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "stop exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "start exited with code " + code + "\n" + output);
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
      try {
        var answer = JSON.parse(output);
      } catch (e) {
        expect(e).to.equal(null, "JSON PARSE ERROR \n" + e + "\n" + output);
      }
      expect(answer.error.length).to.equal(0, "status exited with code " + code + "\n" + output);
      expect(code).to.equal(0, "status exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "stop exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('start', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "start",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "start exited with code " + code + "\n" + output);
      done();
    });

  });

  it('status', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "status",
      "--json"], tmpCWD.name, (code, output) => {
      try {
        var answer = JSON.parse(output);
      } catch (e) {
        expect(e).to.equal(null, "JSON PARSE ERROR \n" + e + "\n" + output);
      }
      expect(answer.error.length).to.equal(0, "status exited with code " + code + "\n" + output);
      expect(code).to.equal(0, "status exited with code " + code + "\n" + output);
      done();
    });

  });

  it('stop', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "stop exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "start exited with code " + code + "\n" + output);
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
      try {
        var answer = JSON.parse(output);
      } catch (e) {
        expect(e).to.equal(null, "JSON PARSE ERROR \n" + e + "\n" + output);
      }
      expect(answer.error.length).to.equal(0, "status exited with code " + code + "\n" + output);
      expect(code).to.equal(0, "status exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "stop exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('restart', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "restart",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "restart exited with code " + code + "\n" + output);
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
      expect(code).to.equal(0, "restart exited with code " + code + "\n" + output);
      done();
    });
  
  });

  it('stop', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "--json"], tmpCWD.name, (code, output) => {
      expect(code).to.equal(0, "stop exited with code " + code + "\n" + output);
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
