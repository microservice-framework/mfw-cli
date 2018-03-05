const expect  = require("chai").expect;
const tmp = require('tmp');
const fs = require('fs-extra');

var debug = false;
if (process.env.DEBUG) {
  debug = true;
}

const execMFW = require('./tools.js').execMFW(debug);

var tmpCWD = ''

describe('Client commands',function(){

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
      setTimeout(()=> {
        expect(code).to.equal(0, "start exited with code " + code + "\n" + output);
        done();
      }, 1000);
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

  it('client-create example-todo \'{ "title": "test"}\'', function(done){
    var rootDir = process.cwd();

    execMFW(rootDir + '/bin/mfw', [ "client-create", "example-todo",
      JSON.stringify({ title: "test"})],
      tmpCWD.name, (code, output) => {
      console.log(output);
      try {
        var answer = JSON.parse(output);
      } catch (e) {
        expect(e).to.equal(null, "JSON PARSE ERROR \n" + e + "\n" + output);
      }
      expect(code).to.equal(0, "client-create exited with code " + code + "\n" + output);
      expect(answer.title).to.equal("test", "Title is not test \n" + output);
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
});
