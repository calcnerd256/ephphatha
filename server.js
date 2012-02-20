var http = require("http");
var that = this;


this.serve = function(req, res){
 return this.route(
  req,
  function(responder){
   if("function" != typeof responder)
    responder = function(q, s){
     return s.end("Router failed to return a function.");
    };
   return responder(req, res);
  }
 );
}

this.route = function(req, callback){
 var serveBack = (
  function getFirstRoute(rs, fallback){
   for(var i = 0; i< rs.length; i++)
    if("function" == typeof rs[i]){
     var r = rs[i](req);
     if("function" == typeof r)
      return r;
    }
   return fallback;
  }
 )(
  this.routes,
  "function" == typeof this.defaultRoute ?
   this.defaultRoute :
   function defaultRoute(req, res){
    return res.end("default route");
   }
 );
 return callback(serveBack);
}
this.defaultRoute = function defaultRoute(req, res){
 return res.end("default route");
}
this.routes = [];

var port = {port: 15213, locked: false};
this.getPort = function getPort(){
 return port.port;
}
this.setPort = function setPort(newPort){
 if(port.locked) throw "attempt to open locked cell for storage";
 var result = port.port;
 port.port = newPort;
 return result;
}
this.lockPort = function lockPort(){
 port.locked = true;
}

this.init = function(serverMaker, callback){
 if("function" != typeof serverMaker)
  serverMaker = require("http").createServer;
 if("function" != typeof callback)
  callback = function(){};
 var p = this.getPort();
 this.server = serverMaker(
  function(req, res){
   return that.serve(req, res);
  }
 );
 this.server.listen(
  p,
  function(){
   console.log("Server listening on port " + p);
   that.lockPort();
   callback();
  }
 );
 return this;
}
