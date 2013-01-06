function Router(matcher, responder){
 if("function" != typeof matcher.match)
  matcher = new Matcher(matcher);
 if("function" != typeof responder)
  responder = function respond(request, response){response.end("default response")};
 this.matcher = matcher;
 this.respond = responder;
}
Router.prototype.route = function route(request){
 if("match" in this.matcher)
  return this.matcher.match(request) ?
   this.respond.bind(this) :
   false;
 if(this.matcher(request))
  return this.respond.bind(this);
}
Router.prototype.toFunction = function(){
 return this.route.bind(this);
}
Router.prototype.call = function call(that){
 return this.call.call.apply(this.toFunction(), arguments);
}
Router.prototype.apply = function apply(that, args){
 return this.apply.apply.apply(this.toFunction(), arguments);
}
Router.prototype.bind = function bind(that){
 return this.bind.bind.apply(this.toFunction(), arguments);
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
