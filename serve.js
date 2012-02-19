//TODO: refactor everything out of here except for the parts that tell the server to start
var http = require("http");
var server = {};
server.port = 15213;
server.serve = function(req, res){
 return this.route(
  req,
  function(responder){
   if(!responder)
    responder = function(req, res){
     res.end("Okay.");
    };
   return responder(req, res);
  }
 );
}
server.route = function(req, callback){
 return callback(
  function(req, res){
   return res.end("Routed.");
  }
 );
}
server.server = http.createServer(
 function(req, res){
  return server.serve(req, res);
 }
);
server.init = function(){
 var p = this.port;
 this.server.listen(
  p,
  function(){
   console.log("Server listening on port " + p);
  }
 );
}
this.server = server;
this.server.init();