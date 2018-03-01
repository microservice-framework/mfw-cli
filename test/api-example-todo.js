const expect  = require("chai").expect;
const assert = require('chai').assert
const tmp = require('tmp');
const exec = require('child_process').exec;
const fs = require('fs-extra');

describe('API-TODO-EXAMPLE',function(){
  var tmpDir;
  var rootDir;
  it('git clone', function(done){
    tmpDir = tmp.dirSync();
    rootDir = process.cwd();
    console.log('TMP DIR for test is: ', tmpDir.name);

    exec( 'git clone https://github.com/microservice-framework/api-todo-example.git', {cwd: tmpDir.name}, (err, stdout, stderr) => {
      expect(err).to.equal(null);
      done();
    });
  });

  it('mfw install', function(done){
    exec( rootDir + '/bin/mfw install --json', {cwd: tmpDir.name + '/api-todo-example'}, (err, stdout, stderr) => {
      try{
        var json = JSON.parse(stdout);
      } catch(e) {
        console.log(e);
        console.log('json', stdout);
      }
      let message = ''
      for(let item of json.error) {
        message = message + item + "\n";
      } 
      expect(message).to.equal('', message);
      done();
    });
  });

  it('mfw start', function(done){
    exec( rootDir + '/bin/mfw start --json', {cwd: tmpDir.name + '/api-todo-example'}, (err, stdout, stderr) => {
      try{
        var json = JSON.parse(stdout);
      } catch(e) {
        console.log(e);
        console.log('json', stdout);
      }
      let message = ''
      for(let item of json.error) {
        message = message + item + "\n";
      } 
      expect(message).to.equal('', message);
      //done();
      // it takes time to start processes. 
      setTimeout(function () {
        done();
      }, 1000);
    });
  });

  it('mfw status', function(done){
    exec( rootDir + '/bin/mfw status --json', {cwd: tmpDir.name + '/api-todo-example'}, (err, stdout, stderr) => {
      try{
        var json = JSON.parse(stdout);
      } catch(e) {
        console.log(e);
        console.log('json', stdout);
      }
      let message = ''
      for(let item of json.status) {
        if(item.error) {
          message = message + item.name + ': ' + item.error + "\n";
        }
      }
      expect(message).to.equal('', message);

      done();
    });
  });

  it('mfw stop', function(done){
    exec( rootDir + '/bin/mfw stop --json', {cwd: tmpDir.name + '/api-todo-example'}, (err, stdout, stderr) => {
      try{
        var json = JSON.parse(stdout);
      } catch(e) {
        console.log(e);
        console.log('json', stdout);
      }
      let message = ''
      for(let item of json.error) {
        message = message + item + "\n";
      } 
      expect(message).to.equal('', message);
      fs.emptyDirSync(tmpDir.name);
      tmpDir.removeCallback();
      done();
    });
  });

});