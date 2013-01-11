var router = require("./HttpRequestRouter");
var coerceToFunction = router.coerceToFunction;
var RouterListRouter = router.RouterListRouter;

//this belongs in another file

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

function functionOrElse(candidate, fallback, noisy){
 return coerceToFunction(candidate, noisy, fallback);
}


this.Server = function Server(){
 //dependencies
 // createLockCell
 // objectifyVeilProjection

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
  //TODO: errback
  var p = portCellFunction("read");
  var that = this;
  //TODO: let them get "that"
  this.server = functionOrElse(
   serverMaker, 
   require("http").createServer
  )(
   function(req, res){
    return that.serve(req, res);
   }
  );
  this.server.listen(
   p,
   function(){
    console.log("Server listening on port " + p);
    portCellFunction("lock");
    functionOrElse(callback)();
   }
  );
  return this;
 }
}
this.Server.prototype.getRoutes = function(){
 return this.routes;
}
this.Server.prototype.pushRoute = function(r){
 return this.routes.push(r);
}
this.Server.prototype.popRoute = function(r){
 return this.routes.pop(r);
}
this.Server.prototype.setRouteAtIndex = function(i, r){
 var result = this.getRouteAtIndex(i);
 this.routes[i] = r;
 return result;
}
this.Server.prototype.getRouteAtIndex = function(i){
 return this.routes[i];
}
this.Server.prototype.deleteRouteAtIndex = function(i){
 var result = this.getRouteAtIndex(i);
 delete this.routes[i];
 return result;
}
this.Server.prototype.shiftRoute = function(){
 return this.routes.shift();
}
this.Server.prototype.unshiftRoute = function(r){
 return this.routes.unshift(r);
}

this.Server.prototype.serve = function serve(req, res){
 return this.route(
  req,
  function(responder){
   return functionOrElse(
    responder,
    function(q, s){
     s.statusCode = 404;
     return s.end("Router failed to return a function.");
    }
   )(req, res);
  }
 );
}
this.Server.prototype.route = function route(req, callback, errback, noisy){
 return functionOrElse(
  callback,
  functionOrElse(
   errback,
   noisy && function(responder){
    throw new Error("dangling HTTP response");
   }
  )
 )(
  (
   function getFirstRoute(rs, fallback){
    function defaultRoute(req, res){
     res.statusCode = 404;
     return res.end("default default route");
    }
    return functionOrElse(
     (new (router.RouterListRouter)(rs)).route(req),
     functionOrElse(fallback, defaultRoute)
    );
   }
  )(
   this.routes,
   this.defaultRoute
  )
 );
}
this.Server.prototype.defaultRoute = function defaultRoute(req, res){
 res.statusCode = 404;
 return res.end("default route");
}
