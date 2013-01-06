function Router(matcher, responder){
 if("function" != typeof matcher)
  matcher = function match(){return false;};
 if("function" != typeof responder)
  responder = function respond(request, response){response.end("default response")};
 this.match = matcher;
 this.respond = responder;
}
Router.prototype.route = function route(request){
 if(this.match(request))
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

this.Router = Router;