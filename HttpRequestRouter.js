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

this.Router = Router;