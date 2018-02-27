# Example-3

CRUDs example instance of mFW with middleware on POST and SEARCH.

**WARNING:: NOT UPDATED README**

- Install mfw-cli
  ```sh
  # npm install @microservice-framework/mfw-cli -g
  ```

- Init application folder
  ```sh
  # mfw setup test
  name:  Example-3
  version:  (1.0.0)
  Mongo URL:  (mongodb://localhost:27017/mfw)
  Mongo Options (example: ?replicaSet=rs1&slaveOk=true):
  	[ok]	/Users/admin/test/services created.
  	[ok]	/Users/admin/test/logs created.
  	[ok]	/Users/admin/test/pids created.
  	[ok]	/Users/admin/test/configs created.
  	[ok]	.gitignore copied
  # cd test
  ```
  Application folder is a bundle for all your services.
  
- Install Example-3
  ```sh
  # mfw install github:microservice-framework/Example-3 --save
  	-	downloading Example-3
  	-	copiyng Example-3 to /Users/admin/test/services/Example-3
  	-	installing dependencies for Example-3
  Mongo URL:  (mongodb://localhost:27017/mfw)
  Mongo Table:  (record)
  Mongo prefix(db):  (example)
  Mongo Options (example: ?replicaSet=rs1&slaveOk=true):
  IP or hostname of the server:  (127.0.0.1)
  Port:  (15002)
  Number of workers:  (2)
  Do not change:  (record.json)
  SECURE_KEY:  (c0748e3ded9bff02a9db7cc4b02877df1b5141d71355934d)
  PID file path:  (../../pids/Example-3.pid)
  Log file path:  (../../logs/Example-3.log)
  	[ok]	github:microservice-framework/Example-3 installed.
  ```

- start service in debug mode
  ```sh
  # mfw start -d Example-3
	-	starting Example-3:start in devel mode
  cluster:main Starting up 2 workers. +0ms
  cluster:main Worker 10404 is online +68ms
  cluster:main Worker 10405 is online +4ms
  http:log Listen on :15002 +0ms
  http:log Listen on :15002 +0ms
  ```

- open new terminal and run tests:
  ```sh
  # cd test/services/Example-3
  # npm run test

  > Example-3@1.0.1 test /Users/admin/test/services/Example-3
  > mocha  --timeout 15000
  
  
  
    RECORD CRUD API
      ✓ POST record 1 should return 200 (124ms)
      ✓ POST record 2 should return 200 (103ms)
      ✓ POST record 2 should return 200 and previosly saved record
      ✓ SEARCH should return 200 (59ms)
      ✓ GET should record 1 return 200
      ✓ GET should record 2 return 200 (60ms)
      ✓ DELETE record1 should return 200
      ✓ DELETE record2 should return 200
      ✓ GET after delete should return nothing
      ✓ GET after delete should return nothing
  
  
    10 passing (439ms)
  ```
  Example service works in debug mode, so you will see debug output in first terminal:
  ```js
  http:log Request: POST: / +1m
  http:debug Data: {"user":"example-user","body":"Example record body","record_id":1} +3ms
  microservice:validate Validate:requestDetails { url: '',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      signature: 'sha256=1c69cbf4b479e67990d714dce2da252baa4cb7c7ef9ceb92d50a02147f3b7a5e',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      'content-type': 'application/json',
  microservice:validate      'content-length': '66',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '{"user":"example-user","body":"Example record body","record_id":1}',
  microservice:validate   method: 'POST' }  +2ms
  microservice:validate Validate:SignatureSystem +4ms
  http:debug Parsed data: { user: 'example-user',
  http:debug   body: 'Example record body',
  http:debug   record_id: 1 } +1ms
  microservice:search MongoClient:toArray object not found. +59ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user',
  http:debug      body: 'Example record body',
  http:debug      record_id: 1,
  http:debug      created: 1494783753927,
  http:debug      changed: 1494783753927,
  http:debug      token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  http:debug      id: 59189709e53e1828a43c7348 } } +19ms
  http:log Request: POST: / +1m
  http:debug Data: {"user":"example-user-2","body":"Example record body 2","record_id":2} +3ms
  microservice:validate Validate:requestDetails { url: '',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      signature: 'sha256=12adf535c62ef422e307289adc561d841d524b5447375ffaf8c5b6880dccea99',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      'content-type': 'application/json',
  microservice:validate      'content-length': '70',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '{"user":"example-user-2","body":"Example record body 2","record_id":2}',
  microservice:validate   method: 'POST' }  +3ms
  microservice:validate Validate:SignatureSystem +5ms
  http:debug Parsed data: { user: 'example-user-2',
  http:debug   body: 'Example record body 2',
  http:debug   record_id: 2 } +1ms
  microservice:search MongoClient:toArray object not found. +58ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user-2',
  http:debug      body: 'Example record body 2',
  http:debug      record_id: 2,
  http:debug      created: 1494783754046,
  http:debug      changed: 1494783754046,
  http:debug      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  http:debug      id: 5918970a21403d28a5148cb1 } } +15ms
  http:log Request: POST: / +124ms
  http:debug Data: {"user":"example-user","body":"Example record body","record_id":2} +1ms
  microservice:validate Validate:requestDetails { url: '',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      signature: 'sha256=70cd1d2c533d9cded10cdd67919a36cee4eec1f4c58618b5dd2464b17a766b5a',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      'content-type': 'application/json',
  microservice:validate      'content-length': '66',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '{"user":"example-user","body":"Example record body","record_id":2}',
  microservice:validate   method: 'POST' }  +0ms
  microservice:validate Validate:SignatureSystem +0ms
  http:debug Parsed data: { user: 'example-user',
  http:debug   body: 'Example record body',
  http:debug   record_id: 2 } +1ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user-2',
  http:debug      body: 'Example record body 2',
  http:debug      record_id: 2,
  http:debug      created: 1494783754046,
  http:debug      changed: 1494783754046,
  http:debug      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  http:debug      id: 5918970a21403d28a5148cb1 },
  http:debug   headers: { 'x-total-count': 1 } } +6ms
  http:log Request: SEARCH: / +21ms
  http:debug Data: {"body":{"$regex":"body","$options":"i"}} +1ms
  microservice:validate Validate:requestDetails { url: '',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      signature: 'sha256=d757f5bc8cf5f334c488f228d488425a4bf6531a5988ec98f1f8bdac1bc76f74',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      'content-type': 'application/json',
  microservice:validate      'content-length': '41',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '{"body":{"$regex":"body","$options":"i"}}',
  microservice:validate   method: 'SEARCH' }  +0ms
  microservice:validate Validate:SignatureSystem +43ms
  http:debug Parsed data: { body: { '$regex': 'body', '$options': 'i' } } +0ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    [ { user: [Object],
  http:debug        body: 'Example record body',
  http:debug        record_id: 1,
  http:debug        created: 1494783753927,
  http:debug        changed: 1494783753927,
  http:debug        token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  http:debug        id: 59189709e53e1828a43c7348 },
  http:debug      { user: [Object],
  http:debug        body: 'Example record body 2',
  http:debug        record_id: 2,
  http:debug        created: 1494783754046,
  http:debug        changed: 1494783754046,
  http:debug        token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  http:debug        id: 5918970a21403d28a5148cb1 } ],
  http:debug   headers: { 'x-total-count': 2 } } +10ms
  http:log Request: GET: /59189709e53e1828a43c7348 +64ms
  microservice:validate Validate:requestDetails { url: '59189709e53e1828a43c7348',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '',
  microservice:validate   method: 'GET' }  +0ms
  microservice:validate Validate:TokenSystem +1ms
  http:debug Parsed data: {} +6ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user',
  http:debug      body: 'Example record body',
  http:debug      record_id: 1,
  http:debug      created: 1494783753927,
  http:debug      changed: 1494783753927,
  http:debug      token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  http:debug      id: 59189709e53e1828a43c7348 } } +4ms
  http:log Request: GET: /5918970a21403d28a5148cb1 +21ms
  microservice:validate Validate:requestDetails { url: '5918970a21403d28a5148cb1',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '',
  microservice:validate   method: 'GET' }  +0ms
  microservice:validate Validate:TokenSystem +46ms
  http:debug Parsed data: {} +5ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user-2',
  http:debug      body: 'Example record body 2',
  http:debug      record_id: 2,
  http:debug      created: 1494783754046,
  http:debug      changed: 1494783754046,
  http:debug      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  http:debug      id: 5918970a21403d28a5148cb1 } } +6ms
  http:log Request: DELETE: /59189709e53e1828a43c7348 +64ms
  microservice:validate Validate:requestDetails { url: '59189709e53e1828a43c7348',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      'content-length': '0',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '',
  microservice:validate   method: 'DELETE' }  +1ms
  microservice:validate Validate:TokenSystem +0ms
  http:debug Parsed data: {} +3ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user',
  http:debug      body: 'Example record body',
  http:debug      record_id: 1,
  http:debug      created: 1494783753927,
  http:debug      changed: 1494783753927,
  http:debug      token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  http:debug      id: 59189709e53e1828a43c7348 } } +7ms
  http:log Request: DELETE: /5918970a21403d28a5148cb1 +17ms
  microservice:validate Validate:requestDetails { url: '5918970a21403d28a5148cb1',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      'content-length': '0',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '',
  microservice:validate   method: 'DELETE' }  +0ms
  microservice:validate Validate:TokenSystem +1ms
  http:debug Parsed data: {} +3ms
  http:debug Handler responce:
  http:debug  { code: 200,
  http:debug   answer:
  http:debug    { user: 'example-user-2',
  http:debug      body: 'Example record body 2',
  http:debug      record_id: 2,
  http:debug      created: 1494783754046,
  http:debug      changed: 1494783754046,
  http:debug      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  http:debug      id: 5918970a21403d28a5148cb1 } } +9ms
  http:log Request: GET: /59189709e53e1828a43c7348 +19ms
  microservice:validate Validate:requestDetails { url: '59189709e53e1828a43c7348',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      token: 'd83ef602138324eb169d5aa4d397beba4811059e049cb2b1',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '',
  microservice:validate   method: 'GET' }  +0ms
  microservice:validate Validate:TokenSystem +0ms
  microservice:validate MongoClient:findOneAndUpdate object not found. +3ms
  http:debug Validation error: Not found +0ms
  http:log Request: GET: /5918970a21403d28a5148cb1 +12ms
  microservice:validate Validate:requestDetails { url: '5918970a21403d28a5148cb1',
  microservice:validate   headers:
  microservice:validate    { accept: 'application/json',
  microservice:validate      'user-agent': 'MicroserviceClient.1.0.1',
  microservice:validate      token: 'b0d46acc8408348b769d9cc6f16a15fe445c6584963ea366',
  microservice:validate      host: '127.0.0.1:15002',
  microservice:validate      connection: 'close' },
  microservice:validate   _buffer: '',
  microservice:validate   method: 'GET' }  +0ms
  microservice:validate Validate:TokenSystem +0ms
  microservice:validate MongoClient:findOneAndUpdate object not found. +8ms
  http:debug Validation error: Not found +1ms
  ```

- now you can interrupt devel mode by ctrl+C and start as a standalone service:
  ```sh
  # mfw start Example-3
	-	starting Example-3:start
	[ok]	Example-3:start started
  ```
- check status
  ```sh
  # mfw status
  	-	checking Example-3:status
  
    SERVICE    VERSION   PID    CPU    MEM    Comment
   --------------------------------------------------------
    Example-3  1.0.1     10431  0.00   41
   --------------------------------------------------------
    1 / 0                       0 %    41 Mb

  ```

- to stop service, just run:
  ```sh  
  # mfw stop Example-3
	-	stopping Example-3:stop

  ```
- Check service logs in file `logs/example-1.log`
  ```log
  Sun, 14 May 2017 17:45:02 GMT cluster:main Starting up 2 workers.
  Sun, 14 May 2017 17:45:02 GMT cluster:main Worker 10449 is online
  Sun, 14 May 2017 17:45:02 GMT cluster:main Worker 10450 is online
  Sun, 14 May 2017 17:45:02 GMT http:log Listen on :15002
  Sun, 14 May 2017 17:45:02 GMT http:log Listen on :15002
  ```

In file `services/example-1/schema/record.json` you can define fields for your record. Each POST request will be validated to match data to this record specification.
