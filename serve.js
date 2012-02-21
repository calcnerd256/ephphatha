this.server = new require("./server").Server();
this.server.setPort(15213);
this.server.init(
 require("http").createServer,
 function(){}
);
