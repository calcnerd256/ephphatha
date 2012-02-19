var http = require("http");
var that = this;
this.port = 15213;
this.serve = function(req, res){
 return this.route(
  req,
  function(responder){
   if(!responder)
    responder = function(req, res){
     return res.end("Okay.");
    };
   return responder(req, res);
  }
 );
}
this.route = function(req, callback){
 return callback(
  function(req, res){
   return res.end("Routed.");
  }
 );
}

this.server = http.createServer(
 function(req, res){
  return that.serve(req, res);
 }
);
this.init = function(){
 var p = this.port;
 this.server.listen(
  p,
  function(){
   console.log("Server listening on port " + p);
  }
 );
 return this;
}
