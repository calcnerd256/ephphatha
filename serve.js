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


//applicative monads
// Pure
// Function_ // it's like a function; maybe I should curry it instead?
// Future
// Promise
// List // not implemented yet

 function Pure(x){
  this.value = x;
 }
 Pure.prototype.fmap = function(f){return new Pure(f(this.value));};
 Pure.prototype.pure = function(x){return new Pure(x);};
 Pure.prototype.flatten = function(){return this.value;};
 Pure.prototype.applicate = function applicate(p){
  // this turns out to be a law or something
  // the "this" object is expected to contain a function that it gives to whoever fmaps over it
  var catamorphism = p.fmap.bind(p); // constructs the other functor from a function
  var nested = this.fmap(catamorphism);
  return nested.flatten();
 };

 function Function_(f){
  this.value = f;
 }
 Function_.prototype.apply = function(args){
  return this.value.apply(this, args);
 }
 Function_.prototype.fmap = function(f){
  return new Function(function(){return f(this.apply(arguments));}.bind(this));
 };
 Function_.prototype.pure = function(x){
  return new Function(function(){return x;});
 }
 // applicate looks like f <*> g = S f g = \ x . f x (g x)
 // X <*> Y = flatten (fmap (\ f . fmap f Y) X)
 // S f g = join (B (\ x . B x g) f)
 //  f x (g x) = join (\ y z . f y (g z)) x
 // join h x = h x x
 // f x (g x) = join (\ y z . f y (g z)) x
 Function_.prototype.flatten = function(){
  return new Function_(
   function(){
    var partial = this.apply(arguments);
    if(partial instanceof Pure) return partial.value;
    return partial.apply(arguments);
   }.bind(this)
  );
 }
 Function_.prototype.applicate = Pure.prototype.applicate;
 Function_.prototype.applicate = function(g){
  if(g instanceof Pure) return function(){return this.apply(arguments)(g.value);}.bind(this);
  return function(){return this.apply(arguments)(g.apply(arguments))}.bind(this);
 }


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
  this.value = v;
  this.done = true; //order matters!
  var listeners = this.listeners; // make sure no listeners mess up the list or rely on you not messing it up
  this.listeners = [];
  listeners.map(function(f){return f(v);});
  return this;
 };
 Future.prototype.fmap = function(transformation_to_compose){
  var result = new Future();
  this.listen(
   function delegate_image_to_transformed_clone(preimage){
    var image = transformation_to_compose(preimage);
    result.occur(image);
   }
  );
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
 Future.never = new Future();
 Future.never.listen = function(){};
 Future.never.occur = function(){throw new Error("pigs flew, with arguments:", arguments);};
 Future.never.fmap = function(){return Future.never;};
 Future.never.flatten = Future.never.fmap;
 Future.never.toString = function(){return "Future.never";};
 Future.name = "Never";

 //maybe a "Promise a" is an "Either (Future Error) (Future a)" ?
 //or maybe just a "Future (Either Error a)"
 //though I think we can make an applicative version that doesn't care, like how sequenceA doesn't care [Maybe a] vs Maybe [a]

 function Promise(){
  this.success = new Future();
  this.failure = new Future();
 }
 Promise.prototype.onSuccess = function(callback){
  this.success.listen(callback);
  return this;
 };
 Promise.prototype.onFailure = function(errback){
  this.failure.listen(errback);
  return this;
 };
 Promise.prototype.listen = function(callback, errback){
  if(errback)
   this.onFailure(errback);
  this.onSuccess(callback);
  return this;
 };
 Promise.prototype.keep = function(x){
  this.success.occur(x);
  this.onFailure(Future.never.occur.bind(Future.never));
  this.failure = Future.never;
  return this;
 };
 Promise.prototype["break"] = function(e){
  this.failure.occur(e);
  this.onSuccess(Future.never.occur.bind(Future.never));
  this.success = Future.never;
  return this;
 };
 Promise.prototype.fmap = function(f){
  var result = new Promise();
  result.success = this.success.fmap(f);
  result.failure = this.failure;
  return result;
 };
 Promise.prototype.pure = function(x){
  var result = new Promise();
  result.success = this.success.pure(x);
  result.failure = Future.never;
  return result;
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

// async read the HTTPS files from the filesystem
//  readFilePromise
//  read_cert

function readFilePromise(filename, options){

 var result = new Promise();

 function callback(err, data){
  if(err) result["break"](err);
  else result.keep(data);
 }
 if(!options)
  fs.readFile(filename, callback)
 else fs.readFile(filename, options, callback);

 return result;
}

function read_cert(key_file, cert_file, callback){
 var keyPromise = readFilePromise(key_file);
 var certPromise = readFilePromise(cert_file);
 function keyback(key){
  function certback(cert){
   return callback.call(this, key, cert);
  }
  return certback.bind(this);
 }

 return keyPromise.pure(keyback.bind(this)).applicate(keyPromise).applicate(certPromise);
}

// kick it all off
read_cert.call(this, "./certs/ephphatha.key", "./certs/ephphatha.cert", after_cert_io); // returns a promise for the return value of after_cert_io
