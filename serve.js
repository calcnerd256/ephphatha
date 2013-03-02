var repl = require("repl");
var fs = require("fs");
var adminServer = require("./adminServer");

var port = 15213;
var sslPort = 15214;

if("--port" == process.argv[2])
 if(+process.argv[3] == process.argv[3])
  sslPort = 1 + (port = +process.argv[3]);

if("--sslPort" == process.argv[4])
 if(+process.argv[5] == process.argv[5])
  sslPort = +process.argv[5];

this.server = new adminServer.AdminStringServer();
this.server.init(
    port,
    sslPort,
    {
	key: fs.readFileSync("./certs/ephphatha.key"),
	cert: fs.readFileSync("./certs/ephphatha.cert")
    },
    function(){
	console.log(arguments);
	repl.start(undefined, undefined, undefined, true);
    }
);

global.server = this.server;

process.on(
 "uncaughtException",
 function(e){
  console.warn(
   [
    "unhandled exception",
    e,
    "please restart the server"
   ]
  );
 }.bind(this)
);