//import libraries
//take optional commandline arguments for the ports
//start the server
// then start the repl
//expose the server
//prolong crashes

var repl = require("repl");
var fs = require("fs");
var adminServer = require("./adminServer");
var applicatives = require("./applicatives")
 var Promise = applicatives.Promise;
 var curryTwo = applicatives.curryTwo;
 var List = applicatives.List;

// language helpers

function pluck_from(ob){
 function plucker(key){
  return ob[key];
 }
 plucker.ob = ob;
 return plucker;
}
function call_with_params_from(dict, key_list, fn){
 var args = key_list.map(
  pluck_from(dict)
 );
 return fn.apply(this, args);
}
function pack_optional_args(key_list, defaults, args){
 var result = {__proto__: defaults};
 [].map.call(args, function(v, i){result[key_list[i]] = v;});
 return result;
}

function wrap_full_with_defaults(keys, defaults, fn){
 function wrapped(){
  var dict = pack_optional_args(keys, defaults, arguments);
  return call_with_params_from.call(this, dict, keys, fn);
 }
 wrapped.keys = keys;
 wrapped.defaults = defaults;
 wrapped.fn = fn;
 return wrapped;
}
function call_with_number_from(ob, key, callback){
 if(!(key in ob)) return;
 var arg = ob[key];
 if(+arg != arg) return;
 return callback(arg);
}


// ports
//  get_command_line_arguments
//  get_ports_from_command_line
//  actually set the port variables

var get_command_line_arguments = wrap_full_with_defaults(
 ["argv"],
 process,
 function(argv){
  possible_arguments = ["port", "sslPort"];
  var args = {};
  function get_long_arg_from_subsequent(arg, i){
   if("--" + arg == argv[i])
    return args[arg] = argv[i + 1];
  }
  possible_arguments.map(
   function(arg, i){
    get_long_arg_from_subsequent(
     arg,
     2*(i+1)
    );
   }
  );
  return args;
 }
);

var get_ports_from_command_line = wrap_full_with_defaults(
 ["command_line_arguments", "default_port", "default_ssl_port"],
 {
  command_line_arguments: get_command_line_arguments(process.argv),
  default_port: 15213,
  default_ssl_port: 15214,
 },
 function(command_line_arguments, default_port, default_ssl_port){

  var port = default_port;
  var sslPort = default_ssl_port;

  (
   function(keys, cbdict){
    return keys.map(
     function(k){
      return [k, cbdict[k]];
     }
    ).map(
     function(kv){
      return call_with_number_from(command_line_arguments, kv[0], kv[1]);
     }
    );
   }
  )(
   ["port", "sslPort"],
   {
    port: function(nstr){
     port = + nstr;
     sslPort = 1 + port;
    },
    sslPort: function(nstr){
     sslPort = +nstr;
    }
   }
  );

  return {http: port, https: sslPort};
 }
);


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
 return new List(
  [key_file, cert_file]
 ).fmap(readFilePromise).seq().fmap(
  callback.call.bind(List.prototype.toArray)
 ).fmap(callback.apply.bind(callback, this));
}

// kick it all off
read_cert.call(this, "./certs/ephphatha.key", "./certs/ephphatha.cert", after_cert_io); // returns a promise for the return value of after_cert_io
