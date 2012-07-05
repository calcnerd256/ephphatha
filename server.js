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
 this.lock = function lock(){locked = true;};
 this.lockedp = function lockedp(){return locked;};
}

function createVeil(api, initialScope, grantAccess){
 var API = api;
 var scope = initialScope;
 function access(verb){
  var args = [].slice.call(arguments, 1);
  return API[verb].apply(scope, args);
 }
 grantAccess(API, scope, access);
 return access;
}

function createLockCell(value){
 var API = {
  read: function(){return this.value;},
  write: function(value){
   if(this.access("lockedp"))
    throw new Error("attempted to modify a locked cell");
   var result = this.access("read");
   this.value = value;
   return result;
  },
  lock: function(){this.locked = true;},
  lockedp: function(){return this.locked;}
 }
 var scope = {
  value: value,
  locked: false
 };
 return createVeil(API, scope, function(api, s, g){s.access = g;});
}

function bindFrom(ob, key){
 var result = function boundCall(){
  return ob[key].apply(ob, arguments);
 };
 result.ob = ob;
 result.key = key;
 return result;
}
function bindFromVeil(channel, veil){
 function result(){
  var args = [].slice.call(arguments, 0);
  args.unshift(channel);
  veil.apply(this, args);
 }
 result.veil = veil;
 result.channel = channel;
 return result;
}
function objectifyVeilProjection(chans, veil){
 var result = {};
 for(var i = 0; i < chans.length; i++)
  result[chans[i]] = bindFromVeil(chans[i], veil);
 return result;
}

this.Server = function Server(){
 this.routes = [];
 var portCellFunction = createLockCell(15213);
 var portCell = objectifyVeilProjection(
  ["read", "write", "lock", "lockedp"],
  portCellFunction
 );
 this.getPort = function(){return portCellFunction("read");};
 this.setPort = function(port){return portCellFunction("write", port);};
 this.lockPort = function(){portCellFunction("lock");};
 this.getPortCell = function(){
  return portCell;
 };
 this.init = function(serverMaker, callback){
  if("function" != typeof serverMaker)
   serverMaker = require("http").createServer;
  if("function" != typeof callback)
   callback = function(){};
  var p = portCellFunction("read");
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
    portCellFunction("lock");
    callback();
   }
  );
  return this;
 }
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
