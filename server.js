
//this belongs in another file
function LockCell(val){
 var locked = false;
 this.read = function read(){return val;};
 this.write = function write(value){
  if(locked) throw new Error("attempt to open a locked cell");
  var result = val;
  val = value;
  return result;
 };
 this.lock = function(){locked = true;};
 this.lockedp = function(){return locked;};
}

this.Server = function Server(){
 this.routes = [];
 this.port = new LockCell(15213);
}
this.Server.prototype.getPort = function getPort(){
 return this.port.read();
}
this.server.prototype.setPort = function setPort(port){
 return this.port.write(port);
}
this.server.prototype.lockPort = function lockPort(){
 return this.port.lock();
}
this.Server.prototype.serve = function serve(req, res){
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
this.Server.prototype.route = function route(req, callback){
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
this.Server.prototype.defaultRoute = function defaultRoute(req, res){
 return res.end("default route");
}
this.Server.prototype.init = function(serverMaker, callback){
 if("function" != typeof serverMaker)
  serverMaker = require("http").createServer;
 if("function" != typeof callback)
  callback = function(){};
 var p = this.getPort();
 var that = this;
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