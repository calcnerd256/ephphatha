/*
this.server = new (require("./server").Server)();
var port = 15213;
if(+(process.argv[2]) < 65536)
 port = process.argv[2];
this.server.setPort(port);
this.server.init(
 require("http").createServer,
 function(){}
);
*/

var repl = require("repl");
var fs = require("fs");
var adminServer = require("./adminServer");
this.server = new adminServer.AdminStringServer();
this.server.init(
    15213, 15214,
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
