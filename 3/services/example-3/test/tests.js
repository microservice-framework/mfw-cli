const expect  = require("chai").expect;
const MicroserviceClient = require('@microservice-framework/microservice-client');

require('dotenv').config();

describe('RECORD CRUD API',function(){
  var client = new MicroserviceClient({
    URL: "http://" + process.env.HOSTNAME + ":" + process.env.PORT,
    secureKey: process.env.SECURE_KEY,
  });

  var RecordID;
  var RecordID2;
  var RecordToken;
  var RecordToken2;

  it('POST record 1 should return 200',function(done){
    var Record = {
      user: "example-user",
      body: "Example record body",
      record_id: 1
    }

    client.post(Record, function(err, handlerResponse){
      RecordID = handlerResponse.id;
      RecordToken = handlerResponse.token;

      expect(err).to.equal(null);
      done();
    });
  });

  it('POST record 2 should return 200',function(done){
    var Record = {
      user: "example-user-2",
      body: "Example record body 2",
      record_id: 2
    }

    client.post(Record, function(err, handlerResponse){
      RecordID2 = handlerResponse.id;
      RecordToken2 = handlerResponse.token;

      expect(err).to.equal(null);
      done();
    });
  });

  it('POST record 2 should return 200 and previosly saved record',function(done){
    var Record = {
      user: "example-user",
      body: "Example record body",
      record_id: 2
    }

    client.post(Record, function(err, handlerResponse){
      expect(err).to.equal(null);
      expect(handlerResponse.record_id).to.equal(2);
      done();
    });
  });

  it('SEARCH should return 200',function(done){
    client.search({ "body": { $regex: 'body', $options: 'i' } }, function(err, handlerResponse){
      expect(err).to.equal(null);
      expect(handlerResponse).to.not.equal(null);
      done();
    });
  });

  it('GET should record 1 return 200',function(done){
    client.get(RecordID, RecordToken, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });
  it('GET should record 2 return 200',function(done){
    client.get(RecordID2, RecordToken2, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });


  it('DELETE record1 should return 200',function(done){
    client.delete(RecordID, RecordToken, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });

  it('DELETE record2 should return 200',function(done){
    client.delete(RecordID2, RecordToken2, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });

  it('GET after delete should return nothing',function(done){
    client.get(RecordID, RecordToken, function(err, handlerResponse){
      expect(err).to.not.equal(null);
      done();
    });
  });

  it('GET after delete should return nothing',function(done){
    client.get(RecordID2, RecordToken2, function(err, handlerResponse){
      expect(err).to.not.equal(null);
      done();
    });
  });
});
