//import libraries
//take optional commandline arguments for the ports
//start the server
// then start the repl
//expose the server
//prolong crashes

var repl = require("repl");
var fs = require("fs");
var adminServer = require("./adminServer");


// ports
//  get_command_line_arguments
//  get_ports_from_command_line
//  actually set the port variables

function get_command_line_arguments(argv){
 if(arguments.length == 0) argv = process.argv;

 var args = {};
 if("--port" == argv[2])
  args.port = argv[3];

 if("--sslPort" == argv[4])
  args.sslPort = argv[5];

 return args;
}

function get_ports_from_command_line(command_line_arguments, default_port, default_ssl_port){

 switch(arguments.length){
  case 0:
   command_line_arguments = get_command_line_arguments(process.argv);
  case 1:
   default_port = 15213;
  case 2:
   default_ssl_port = 15214
  default:
   break;
 }

 var port = default_port;
 var sslPort = default_ssl_port;

 var command_line_port = null;
 if("port" in command_line_arguments)
  command_line_port = command_line_arguments.port;
 if("port" in command_line_arguments)
  if(+command_line_port == command_line_port)
   sslPort = 1 + (port = +command_line_port);

 var command_line_sslPort = null;
 if("sslPort" in command_line_arguments)
  command_line_sslPort = command_line_arguments.sslPort;
 if("sslPort" in command_line_arguments)
  if(+command_line_sslPort == command_line_sslPort)
   sslPort = +command_line_sslPort;

 return {http: port, https: sslPort};
}

var ports = get_ports_from_command_line(
 get_command_line_arguments(
  process.argv
 )
);
var port = ports.http;
var sslPort = ports.https



// some behaviors in callbacks
//  after_setup_servers
//  handle_exception
//  setup_servers
//  after_cert_io

function after_setup_servers(){
 console.log(arguments);
 repl.start(undefined, undefined, undefined, true);
}

function handle_exception(error){
 // swallow all errors and emit a helpful message
 var description = "unhandled exception";
 var suggestion = "please restart the server";
 var warning = [
  description,
  error,
  suggestion,
  error.stack
 ]
 console.warn(warning);
}


function setup_servers(key, cert, after, handle_exception){

 // start servers

 this.server = new adminServer.AdminStringServer();
 this.server.init(port, sslPort, {key: key, cert: cert}, after);
 global.server = this.server;


 //silently ignore errors

 process.on("uncaughtException", handle_exception.bind(this));

}

function after_cert_io(key, cert){
 return setup_servers.call(this, key, cert, after_setup_servers, handle_exception);
}


// async read the HTTPS files from the filesystem
//  readFilePromise
//  read_cert

function readFilePromise(filename, options){

 function Pure(x){
  this.value = x;
 }
 Pure.prototype.fmap = function(f){return new Pure(f(this.value));};
 Pure.prototype.pure = function(x){return new Pure(x);};
 Pure.prototype.flatten = function(){return this.value;};
 Pure.prototype.applicate = function(p){return this.fmap(p.fmap.bind(p)).flatten();};// this turns out to be a law or something

 function Future(){
  this.listeners = [];
  this.done = false;
 }
 Future.prototype.listen = function(callback){
  if(this.done) return callback(this.value);
  this.listeners.push(callback);
 };
 Future.prototype.occur = function(v){
  //assume !this.done
  this.listeners.map(function(f){return f(v);});
  this.value = v;
  this.done = true;
  this.listeners = [];
 };
 Future.prototype.fmap = function(f){
  var result = new Future();
  this.listen(function(v){result.occur(f(v));});
  return result;
 };
 Future.prototype.pure = function(x){
  var result = new Future();
  result.occur(x);
  return result;
 };
 Future.prototype.flatten = function(){
  var result = new Future();
  this.listen(
   function(p){
    if(p instanceof Pure) return result.occur(p.value);
    p.listen(result.occur.bind(result));
   }
  );
  return result;
 };
 Future.prototype.applicate = Pure.prototype.applicate;

 //maybe a "Promise a" is an "Either (Future Error) (Future a)" ?
 //or maybe just a "Future (Either Error a)"
 //though I think we can make an applicative version that doesn't care, like how sequenceA doesn't care [Maybe a] vs Maybe [a]

 function Promise(){
  this.success = new Future();
  this.failure = new Future();
 }
 Promise.prototype.onSuccess = function(callback){
  this.success.listen(callback);
 };
 Promise.prototype.onFailure = function(errback){
  this.failure.listen(errback);
 };
 Promise.prototype.listen = function(callback, errback){
  this.onSuccess(callback);
  if(errback)
   this.onFailure(errback);
 };
 Promise.prototype.keep = function(x){
  return this.success.occur(x);
 };
 Promise.prototype["break"] = function(e){
  return this.failure.occur(e);
 };
 Promise.prototype.fmap = function(f){
  result = new Promise();
  result.success = this.success.fmap(f);
  result.failure = this.failure;
 };
 Promise.prototype.pure = function(x){
  result = new Promise();
  result.success = this.success.pure(x);
 };
 Promise.prototype.flatten = function(){
  //a promise of a promise that yields a promise
  var result = new Promise();
  this.listen(
   function(p){
    if(p instanceof Pure) return result.keep(p.value);
    p.listen(
     result.keep.bind(result),
     result["break"].bind(result)
    )
   },
   result["break"].bind(result)
  );
  return result;
 };
 Promise.prototype.applicate = Pure.prototype.applicate;

 var result = new Promise();

 // didn't bother looking up actual Promise API
 var promise = {
  fail: function(){
   return this.emit("failure", arguments);
  },
  succeed: function(){
   return this.emit("success", arguments);
  },
  on: function(channel, listener){
   if("success" == channel) result.onSuccess(listener);
   else result.onFailure(listener);
   if(!(channel in this.channels)) this.channels[channel] = [];
   this.channels[channel].push(listener);
   return this;
  },
  paused: true,
  pause: function(unpause){
   this.paused = !unpause;
   if(!this.paused)
    this.cache.map(function(ca){this.emit(ca[0], ca[1])}.bind(this));
   return this;
  },
  unpause: function(pause){
   return this.pause(!pause);
  },
  emit: function(channel, args){
   if("success" == channel) return result.keep.apply(result, args);
   else return result["break"].apply(result, args);
   var defer = this.paused;
   if(!(channel in this.channels)) defer = true;
   if(defer){
    this.cache.push([channel, args]);
    return this;
   }
   var fns = this.channels[channel];
   fns.map(function(f){f.apply(this, args)}.bind(this));
   return this;
  },
  channels: {
   success: [],
   failure: []
  },
  cache: []
 };

 function callback(err, data){
  if(err) result["break"](err);
  else result.keep(data);
  promise.err = err;
  promise.data = data;
  if(promise.err) return promise.fail(err);
  return promise.succeed(data);
 }
 if(!options)
  fs.readFile(filename, callback)
 else fs.readFile(filename, options, callback);
 return promise;
}

function read_cert(key_file, cert_file, callback){
 var keyPromise = readFilePromise(key_file).pause();
 var certPromise = readFilePromise(cert_file).pause();
 keyPromise.on(
  "success",
  function(key){
   certPromise.on(
    "success",
    function(cert){
     return callback.call(this, key, cert);
    }.bind(this)
   ).unpause();
  }.bind(this)
 ).unpause();
}

// kick it all off
read_cert.call(this, "./certs/ephphatha.key", "./certs/ephphatha.cert", after_cert_io);
