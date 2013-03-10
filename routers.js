var router = require("webserver_functors");
 var coerceToFunction = router.coerceToFunction;
 var Router = router.Router;
 var ExactRouter = router.ExactRouter;
 var RouterListRouter = router.RouterListRouter;
 var ExactDictRouter = router.ExactDictRouter;
 var UrlMatcher = router.UrlMatcher;
 var UrlExactMatcher = router.UrlExactMatcher;
 var dictToAlist = router.dictToAlist;
 var MethodRoutingResponder = router.MethodRoutingResponder;
 var DictionaryRouter = router.DictionaryRouter;

function DictRouterList(dict){
 this.dict = dict;
}

DictRouterList.prototype.getRouterKeys = function getRouterKeys(){
 // TODO get these in some order
 return Object.keys(this.dict);
}
DictRouterList.prototype.getStateRouter = function getStateRouter(req){
 return new RouterListRouter(
  this.getRouterKeys().map(
   function(k){
    return this.dict[k];
   }.bind(this)
  )
 );
}
DictRouterList.prototype.route = function route(req){
 return this.getStateRouter().route(req);
}
DictRouterList.prototype.toFunction = function toFunction(){
 return this.route.bind(this);
}



this.router = router;
this.DictRouterList = DictRouterList;