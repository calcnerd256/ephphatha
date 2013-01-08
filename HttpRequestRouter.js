var util = require("util");

function coerceToFunction(fn, noisy){
 if("function" == typeof fn) return fn;
 var fail = function fail(){
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
  return function nop(){}
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
 return this["function"].bind(this);
}
Functor.prototype.call = function call(that){
 return this.call.call.apply(this.toFunction(), arguments);
}
Functor.prototype.apply = function apply(that, args){
 return this.apply.apply.apply(this.toFunction(), arguments);
}
Functor.prototype.bind = function bind(that){
 return this.bind.bind.apply(this.toFunction(), arguments);
}

function Router(matcher, responder){
 Functor.call(this, this.route);
 if("function" != typeof matcher.match)
  matcher = new Matcher(matcher);
 if("function" != typeof responder)
  responder = function respond(request, response){response.end("default response")};
 this.matcher = matcher;
 this.respond = responder;
}
util.inherits(Router, Functor);
Router.prototype.route = function route(request){
 if("match" in this.matcher)
  return this.matcher.match(request) ?
   this.respond.bind(this) :
   false;
 if(this.matcher(request))
  return this.respond.bind(this);
}

function Matcher(predicate){
 if("function" != typeof predicate)
  predicate = function match(){return false;};
 this.match = predicate;
}

function UrlMatcher(predicate){
 Matcher.call(this, this.match.bind(this));
 this.urlPredicate = predicate;
}
UrlMatcher.prototype.match = function match(request){
 return this.urlPredicate(request.url);
}

this.Router = Router;
this.UrlMatcher = UrlMatcher;
