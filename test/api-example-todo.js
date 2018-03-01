const expect  = require("chai").expect;
const assert = require('chai').assert
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


describe('API-TODO-EXAMPLE',function(){
  var tmpDir;
  var rootDir;
  it('git clone', function(done){
    tmpDir = tmp.dirSync();
    rootDir = process.cwd();
    if (debug){
      console.log('TMP DIR for test is: ', tmpDir.name);
    }

    execMFW('git', [
      "clone",
      "https://github.com/microservice-framework/api-todo-example.git"],
      tmpDir.name, (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      done();
    });
  });

  it('mfw install', function(done){

    var rootDir = process.cwd();
    
    execMFW(rootDir + '/bin/mfw', [
      "install",
      "--json"], tmpDir.name + '/api-todo-example', (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      try {
        var json = JSON.parse(output);
      } catch (e) {
        console.log(e);
        console.log('json', output);
      }
      let message = ''
      for (let item of json.error) {
        message = message + item + "\n";
      } 
      expect(message).to.equal('', message);
      done();
    });
  });

  it('mfw start', function(done){

    var rootDir = process.cwd();
    
    execMFW(rootDir + '/bin/mfw', [
      "start",
      "--json"], tmpDir.name + '/api-todo-example', (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      try {
        var json = JSON.parse(output);
      } catch (e) {
        console.log(e);
        console.log('json', output);
      }
      let message = ''
      for (let item of json.error) {
        message = message + item + "\n";
      } 
      expect(message).to.equal('', message);
      // Wait 1 sec after start.
      setTimeout(function(){
        done();
      }, 1000);
      
    });
  });

  it('mfw status', function(done){
    var rootDir = process.cwd();
    
    execMFW(rootDir + '/bin/mfw', [
      "status",
      "--json"], tmpDir.name + '/api-todo-example', (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      try {
        var json = JSON.parse(output);
      } catch (e) {
        console.log(e);
        console.log('json', output);
      }
      let message = ''
      for (let item of json.status) {
        if (item.error) {
          message = message + item.name + ': ' + item.error + "\n";
        }
      }
      expect(message).to.equal('', message);
      done();
    });
  });

  it('mfw stop', function(done){
    var rootDir = process.cwd();
    
    execMFW(rootDir + '/bin/mfw', [
      "stop",
      "--json"], tmpDir.name + '/api-todo-example', (code, output) => {
      expect(code).to.equal(0, "init exited with code " + code + "\n" + output);
      try {
        var json = JSON.parse(output);
      } catch (e) {
        console.log(e);
        console.log('json', output);
      }
      let message = ''
      for (let item of json.error) {
        message = message + item + "\n";
      } 
      expect(message).to.equal('', message);
      done();
    });
  });

  it('Clean TMP dirs', function(done){
    if (!debug){ 
      fs.emptyDirSync(tmpDir.name);
      tmpDir.removeCallback();
    } else {
      console.log('Dont forget to remove tmp dir: ' + tmpDir.name + "\n");
    }
    done();
  })

})
