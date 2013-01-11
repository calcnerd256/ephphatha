var util = require("util");

function coerceToFunction(fn, noisy, fallback){
 //if you pass a non-function as fallback, you may get a non-function back out
 if("function" == typeof fn) return fn;
 var fail = function fail(){
  if(!fallback)
   fallback = function nop(){};
  if(noisy)
   throw new Error(
    [
     "not a function",
     fn,
     "and noisy",
     noisy,
     this
    ]
   );
  return fallback;
 }.bind(this);
 if(!fn) return fail();
 if("object" != typeof fn) return fail();
 if("toFunction" in fn) return fn.toFunction();
 return fail();
}

function Functor(fn){
 this["function"] = coerceToFunction(fn, true);
}
Functor.prototype.toFunction = function toFunction(){
 var result = this["function"].bind(this);
 result.bindings = {"this": this};
 return result;
}
Functor.prototype.call = function call(that){
 return this.call.call.apply(this.toFunction(), arguments);
}
Functor.prototype.apply = function apply(that, args){
 return this.apply.apply.apply(this.toFunction(), arguments);
}
Functor.prototype.bind = function bind(that){
 var result = this.bind.bind.apply(this.toFunction(), arguments);
 result.bindings = {"this": that, "arguments": arguments, "bound by": this};
 return result;
}
Functor.coerceToFunction = coerceToFunction;

function Router(matcher, responder){
 Functor.call(this, this.route);
 this.matcher = matcher instanceof Matcher ?
  matcher :
  new Matcher(matcher);
 this.respond = coerceToFunction(
  responder,
  false,
  function respond(request, response){
   response.end("default response")
  }
 );
}
util.inherits(Router, Functor);
Router.prototype.route = function route(request){
 if(coerceToFunction(this.matcher).bind(this)(request))
  return this.respond.bind(this);
}

function ExactRouter(url, responder){
 Router.call(this, new UrlExactMatcher(url), responder);
 this.url = url;
}
util.inherits(ExactRouter, Router);

function RouterListRouter(subordinates){
 Router.call(
  this,
  new Matcher(function(){return false;}),
  function(request, response){
   response.statusCode = 404;
   response.end("empty route");
  }
 );
 if(!subordinates) subordinates = [];
 this.routes = subordinates.map(
  function(route){
   if("route" in route) return route;
   return coerceToFunction(route);
  }
 );
}
util.inherits(RouterListRouter, Router);
RouterListRouter.prototype.route = function route(request){
 var responder;
 for(var i = 0; i < this.routes.length; i++)
  if(
   responder = (
    function(route, req){
     if("route" in route)
      return coerceToFunction(route.route).bind(route)(req);
     if("call" in route)
      return coerceToFunction(route.call).bind(route)(this, req);
     if("toFunction" in route)
      return coerceToFunction(route.toFunction).bind(route)(this, req);
     return coerceToFunction(route).bind(this)(req);
    }.bind(this)
   )(this.routes[i], request)
  )
   return responder;
}
RouterListRouter.prototype.getRoutes = function(){
 return this.routes;
}
RouterListRouter.prototype.pushRoute = function(r){
 return this.routes.push(r);
}
RouterListRouter.prototype.popRoute = function(r){
 return this.routes.pop(r);
}
RouterListRouter.prototype.setRouteAtIndex = function(i, r){
 var result = this.getRouteAtIndex(i);
 this.routes[i] = r;
 return result;
}
RouterListRouter.prototype.getRouteAtIndex = function(i){
 return this.routes[i];
}
RouterListRouter.prototype.deleteRouteAtIndex = function(i){
 var result = this.getRouteAtIndex(i);
 delete this.routes[i];
 return result;
}
RouterListRouter.prototype.shiftRoute = function(){
 return this.routes.shift();
}
RouterListRouter.prototype.unshiftRoute = function(r){
 return this.routes.unshift(r);
}



function Matcher(predicate){
 Functor.call(this, this.match);
 this.matcher = coerceToFunction(
  predicate,
  false,
  function nope(){return false;}
 );
}
util.inherits(Matcher, Functor);
Matcher.prototype.match = function match(){
 return this.matcher.apply(this, arguments);
}

function UrlMatcher(predicate){
 Matcher.call(this, this.match);
 this.urlPredicate = coerceToFunction(
  predicate,
  false,
  function nope(){return false;}
 );
}
util.inherits(UrlMatcher, Matcher);
UrlMatcher.prototype.match = function match(request){
 return coerceToFunction(this.urlPredicate).bind(this)(request.url);
}

function UrlExactMatcher(path){
 UrlMatcher.call(this, this.matchPath);
 this.path = path;
}
util.inherits(UrlExactMatcher, UrlMatcher);
UrlExactMatcher.prototype.matchPath = function matchPath(path){
 return this.path == path;
}

function dictionaryToAssociationList(dictionary){
 var result = [];
 for(var k in dictionary)
  result.push([k, dictionary[k]]);
 return result;
}

this.coerceToFunction = coerceToFunction;
this.Functor = Functor;

this.Router = Router;
this.ExactRouter = ExactRouter;
this.RouterListRouter = RouterListRouter;

this.Matcher = Matcher;
this.UrlMatcher = UrlMatcher;
this.UrlExactMatcher = UrlExactMatcher;

this.dictToAlist = dictionaryToAssociationList