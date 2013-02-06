var router = require("webserver_functors");
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

 this.routeListRouter = new RouterListRouter([]);
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
};

[
 "getRoutes",
 "pushRoute",
 "popRoute",
 "setRouteAtIndex",
 "getRouteAtIndex",
 "deleteRouteAtIndex",
 "shiftRoute",
 "unshiftRoute"
].map(
 function(key){
  fn = function(){
   return this.routeListRouter[key].apply(
    this.routeListRouter,
    arguments
   );
  }
  fn.toString = function toString(){
   return this.that.routeListRouter[key].toString();
  };
  fn.key = key;
  fn.that = this.Server.prototype; // not quite right :(
  this.Server.prototype[key] = fn;
  return fn;
 }.bind(this)
);

this.Server.prototype.serve = function serve(req, res){
 try{
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
 catch(e){
  console.warn(["request failed", e]);
  res.statusCode = 500;
  res.end("failed to serve request");
 }
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
     rs.route(req),
     functionOrElse(fallback, defaultRoute)
    );
   }
  )(
   this.routeListRouter,
   this.defaultRoute
  )
 );
}
this.Server.prototype.defaultRoute = function defaultRoute(req, res){
 res.statusCode = 404;
 return res.end("default route");
}
