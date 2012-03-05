this.server = new require("./server").Server();
var port = 15213;
if(process.argv[2] < 65536)
 port = process.argv[2];
this.server.setPort(port);
this.server.init(
 require("http").createServer,
 function(){}
);
