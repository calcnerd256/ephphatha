var util = require("./util");
var Server = require("./server");
var http = require("http");
var https = require("https");
var child_process = require("child_process");
var crypto = require("crypto");
var url = require("url");
var fs = require("fs");
var formStream = require("form_stream");
 var FormStream = formStream.FormStream;
var routers = require("./routers");
 var router = routers.router;
 var coerceToFunction = router.coerceToFunction;
 var Router = router.Router;
 var ExactRouter = router.ExactRouter;
 var RouterListRouter = router.RouterListRouter;
 var ExactDictRouter = router.ExactDictRouter;
 var UrlMatcher = router.UrlMatcher;
 var UrlExactMatcher = router.UrlExactMatcher;
 var MethodRoutingResponder = router.MethodRoutingResponder;
 var DictionaryRouter = router.DictionaryRouter;
 var DictRouterList = routers.DictRouterList;
var formController = require("./formController");
 var FormField = formController.FormField;
 var TextAreaField = formController.TextAreaField;
 var SimpleFormController = formController.SimpleFormController;
var admin = require("./admin");
 var Admin = admin.Admin;
var stringManager = require("./stringState");
 var StringManager = stringManager.StringManager;


//HTTP server helpers
//please move these

function constantResponder(str, mimetype){
 if(!mimetype) mimetype = "text/html";
 var result = function(req, res){
  if("text/plain" != mimetype)
   res.writeHead(200, {"Content-type": mimetype});
  res.end(str);
 };
 result.str = str;
 result.mimetype = mimetype;
 return result;
}

function constantStaticRouterDict(d){
 return util.dictionaryMap(
  d,
  function(kv){
   return [
    kv[0],
    constantResponder(kv[1])
   ];
  }
 );
}


function execStrClosed(str){
 //captures the scope in which this function was defined
 return eval(str);
}


function AdminStringServer(){
 this.admin = new Admin();
 this.stringManager = new StringManager();
 this.stringPersistence = new stringManager.FilesystemLiaison(this.stringManager);
 this.publicStaticHtml = {};
 this.routeState = {};//for testing
 this.apiState = {};
 this.routerState = new DictRouterList({});//replace everything with this
}


[
 "setPassword",
 "adminRoute"
].map(
 function(k){
  util.delegateCall(AdminStringServer.prototype, k, "admin");
 }
);


[
 "appendNewString",
 "strEq"
].map(
 function(k){
  util.delegateCall(AdminStringServer.prototype, k, "stringManager");
 }
);

[
 "loadStrings",
 "saveString",
 "dumpAllStrings",
 "replaceDir"
].map(
 function(k){
  return util.delegateCall(AdminStringServer.prototype, k, "stringPersistence");
 }
);

AdminStringServer.prototype.alistToDict = util.alistToDict;
AdminStringServer.prototype.dictionaryMap = util.dictionaryMap;
AdminStringServer.prototype.dictIndirect = util.dictIndirect;
AdminStringServer.prototype.formToResponder = formController.formToResponder;
AdminStringServer.prototype.tagShorthand = formController.tagShorthand;
AdminStringServer.prototype.appendString = AdminStringServer.prototype.appendNewString;
AdminStringServer.prototype.execStrClosed = execStrClosed;
AdminStringServer.prototype.stringEquals = AdminStringServer.prototype.strEq;
AdminStringServer.prototype.stringAtIndexEquals = AdminStringServer.prototype.strEq;


//execString
//storeExecString
//storeAt

AdminStringServer.prototype.execString = function execString(index){
 //here we go
 return this.execStrClosed(this.stringManager.getStringAt(index));
};


AdminStringServer.prototype.storeExecString = function(str){
 var i = this.stringManager.appendNewString(str);
 return [i, this.execString(i)];
}

AdminStringServer.prototype.storeAt = function(path, expr){
 var target = this;
 var last = path.pop();
 for(var i = 0; i < path.length; i++){
  var k = path[i];
  if(!(k in target)) target[k] = {};
  target = target[k];
 }
 return (
  function(p){
   target[last] = p[1];
   return p[0];
  }
 )(this.storeExecString(expr));
}

//A init
//A getServerPerProtocol
//A getHttpRouterList
//A adminLoginUrl
//a adminOnly
//a getAdminIndexSource
//a getAdminLoginResponder
//a adminLoginResponder
//s listStrings
//A matchStringUrlPrefix
//s davString
//s delString
//s execString
//A getHttpsRouterList


//AAAA aaaaa s A sss A


AdminStringServer.prototype.init = function init(port, securePort, httpsOptions, callback){
 var outstanding = 2;
 var calledTimes = 0;
 var that = this;
 function onceBack(){
  if(calledTimes++) return;
  require("./adminServerState").init.apply(that, arguments);
  return callback.apply(this, arguments);
 }
 function eachBack(){
  if(!--outstanding)
   return onceBack.apply(this, arguments);
 }
 var httpServer = util.fluentKeyCall(
  this.getServerPerProtocol("HTTP"),
  "setPort",
  port
 ).init(http.createServer, util.callOnce(eachBack));
 var httpsBack = util.callOnce(eachBack);
 var httpsServer;
 function createHttpsServerClosure(responder){
  return https.createServer(
   httpsOptions,
   responder
  );
 }
 if(!httpsOptions) httpsServer = httpsBack();
 else
  httpsServer = util.fluentKeyCall(
   this.getServerPerProtocol("HTTPS"),
   "setPort",
   securePort
  ).init(createHttpsServerClosure, httpsBack);

 this.servers = {
  http: httpServer,
  https: httpsServer
 };
 return this.servers;
}



AdminStringServer.prototype.getServerPerProtocol = function getServerPerProtocol(prot){
 var server = new Server.Server();
 var routes = this[
  "getHttp" +
   (("HTTPS" == prot) ? "s" : "") +
   "RouterList"
 ]();
 var route;
 while(route = routes.pop())
  server.unshiftRoute(route);
 return server;
}


AdminStringServer.prototype.getHttpRouterList = function getHttpRouterList(){
 var appendUrl = "/append";
 var adminUrl = "/admin/";//TODO: make this point to HTTPS only
 var index = [
  "<HTML>",
  " <HEAD>",
  " </HEAD>",
  " <BODY>",
  "  index",
  "  <BR />",
  "  <A HREF=\"" + appendUrl + "\">append</A>",
  "  <BR />",
  "  <A HREF=\"" + adminUrl + "\">admin</A>",
  " </BODY>",
  "</HTML>",
  ""
 ].join("\n");
 var that = this;

 var pathDictionary = {
  "empty": [null, ""],
  "root": ["empty", ""],
  "index": ["empty", "index"],
  "indexhtml": ["empty", "index.html"],
  "favicon": ["empty", "favicon.ico"],
  "append": ["empty", "append"]
 };

 function stepper(dictionary){
  return util.dictionaryMap(
   dictionary,
   function(kv){
    var key = kv[0];
    var value = kv[1];
    var parent = value[0];
    if(parent == key)
     return [key, ["error", "cycle"]];
    if(!(parent in dictionary)) return kv;
    par = dictionary[parent];
    return [
     key,
     [
      par[0],
      par[1] + "/" + value[1]
     ]
    ];
   }
  );
 }
 function terminator(dictionary){
  for(var key in dictionary)
   if(dictionary[key][0] in dictionary)
    if(
     "error" != key ||
      "error" != dictionary[key][0]
    )
     return false;
  return true;
 }

 while(!terminator(pathDictionary))
  pathDictionary = stepper(pathDictionary);
 var paths = util.dictionaryMap(
  pathDictionary,
  function(kv){
   var key = kv[0];
   var value = kv[1];
   return [key, value[1]];
  }
 );

 var constantStaticRouters = new ExactDictRouter(
  constantStaticRouterDict(
   util.dictIndirect(
    paths,
    {
     root: index,
     index: index,
     indexhtml: index
    }
   )
  )
 );
 var handleAppendGet = constantResponder(
  [
   "<FORM METHOD=\"POST\">",
   " <TEXTAREA NAME=\"string\"></TEXTAREA>",
   //TODO make the name of that field a variable
   // such that elsewhere the form-processing code uses that same variable
   " <INPUT TYPE=\"SUBMIT\"></INPUT>",
   "</FORM>"
  ].join("\n")
 );
 var handleAppendPost = function handleAppendPost(req, res){
  var form = new FormStream(req);
  var noString = true;
  function stringBack(string){
   index = this.stringManager.appendNewString(string);
   res.writeHead(200, {"Content-type": "text/plain"});
   return res.end(
    "POST successful: " +
     index +
     "\n" +
     string
   );
  }
  form.on(
   "s_string",
   function(stream){
    noString = false;
    var buf = [];
    stream.on(
     "data",
     buf.push.bind(buf)
    ).on(
     "end",
     function(){
      return stringBack.bind(that)(buf.join(""));
     }
    ).resume();
   }
  ).on(
   "end",
   function(){
    if(noString)
     return res.end("bad POST attempt");
   }
  );
 }
 var handleAppendRequest = new MethodRoutingResponder(
  {
   "GET": handleAppendGet,
   POST: handleAppendPost
  }
 );
 var moreRouters = new ExactDictRouter(
  util.dictIndirect(
   paths,
   {
    favicon: function handleFaviconRequest(req, res){
     res.writeHead(404, "no favicon yet");
     res.end("go away");
    },
    append: handleAppendRequest
   }
  )
 );
 return [
  constantStaticRouters,
  moreRouters
 ]
}





AdminStringServer.prototype.adminLoginUrl = "/admin/login"; //TODO use the routing table like in getHttpRouterList

AdminStringServer.prototype.adminOnly = function adminOnly(responder){
 return this.admin.adminOnly(responder.bind(this));
}



AdminStringServer.prototype.getAdminIndexSource = admin.getAdminIndexSource;

AdminStringServer.prototype.getAdminLoginResponder = admin.getAdminLoginResponder;

AdminStringServer.prototype.listStrings = stringManager.listStrings;

var matchStringUrlPrefix = stringManager.matchStringUrlPrefix;

var davString = stringManager.davString;
var delString = stringManager.delString;
var execString = stringManager.execString;


AdminStringServer.prototype.getHttpsRouterList = function getHttpsRouterList(){
 var that = this;
 var adminLoginUrl = this.adminLoginUrl;
 var links = {
  "/admin/gconf/": "gconf",
  "/admin/mouse/": "mouse",
  "/admin/list/": "list",
  "/admin/dashboard.html": "dashboard"
 }
 links[this.adminLoginUrl] = "log in";

 var handleAdminIndexRequest = constantResponder(
  this.getAdminIndexSource(links)
 );



 var routingDictionary = {
  "/admin/": handleAdminIndexRequest,
  "/admin/index": handleAdminIndexRequest,
  "/admin/index.html": handleAdminIndexRequest,
  "/admin/list/": this.admin.adminOnly(this.listStrings.bind(this))
 };
 routingDictionary[this.adminLoginUrl] = this.getAdminLoginResponder();



 var stringDav = new Router(
  new UrlMatcher(
   function match(u){
    var p = matchStringUrlPrefix(u);
    if(!p) return p;
    return 1 == p.length;
   }
  ),
  davString.bind(this)
 );


 var stringDel = new Router(
  new UrlMatcher(
   function match(u){
    var p = matchStringUrlPrefix(u);
    if(!p) return p;
    return "del" == p[1] || "delete" == p[1];
   }
  ),
  delString.bind(this)
 );

 var stringExec = new Router(
  new UrlMatcher(
   function match(u){
    var p = matchStringUrlPrefix(u);
    return "exec" == p[1];
   }
  ),
  execString.bind(this)
 );



 function responderRequestTransform(transformRequest, responder){
  var result = function(req, res){
   return coerceToFunction(responder)(transformRequest(req), res);
  }
  result.responder = responder;
  return result;
 }
 var gconf = new Router(
  new UrlMatcher(
   function(u){
    var parts = u.split("/");
    //assume parts[0] == ""
    if("admin" != parts[1]) return false;
    if("gconf" != parts[2]) return false;
    return true;
   }
  ),
  responderRequestTransform(
   function transformRequest(req){
    var rurl = req.url;
    var u = rurl.split("/");
     u.shift(); // ""
     u.shift(); // "admin"
     u.shift(); // "gconf"
     u.unshift("");
    rurl = u.join("/");
    var request = {
     __proto__: req,
     url: rurl,
     original_url: req.url
    };
    return request;
   },
   require("web_gconf").responder
  )
 );
 var stateRouter = new Router(
  new UrlMatcher(
   function(u){
    return u in this.routeState;
   }.bind(this)
  ),
  function(req, res){
   return this.routeState[req.url](req, res);
  }.bind(this)
 );
 var publicStaticHtmlRouter = new Router(
  new UrlMatcher(
   function(u){
    return u in this.publicStaticHtml
   }.bind(this)
  ),
  function(req, res){
   result = this.publicStaticHtml[req.url];
   res.setHeader("Content-Type", "text/html");
   return res.end(result);
  }.bind(this)
 );
 var apiStateRouter = new Router(
  new UrlMatcher(
   function(u){
    return u in this.apiState
   }.bind(this)
  ),
  function(req, res){
   return this.formToResponder(
    this.apiState[req.url]
   )(req, res);
  }.bind(this)
 );
 var result = {
  rd: new ExactDictRouter(routingDictionary),//takes exact paths to responder functions
  sda: this.admin.adminRoute(stringDav),//make this part of strings?
  sde: this.admin.adminRoute(stringDel),//make this part of strings?
  se: this.admin.adminRoute(stringExec),//make this part of strings?
  mouse: this.admin.adminRoute(//put this in routingDictionary?
   new ExactRouter(
    "/admin/mouse/",
    require("webmouse").responder
   )
  ),
  rs: this.routerState,//where's this come from?
  gconf: this.admin.adminRoute(gconf),
  http: new RouterListRouter(this.getHttpRouterList()),//let every HTTP route handle HTTPS requests, too
  sr: stateRouter,//what's this again?
  html: publicStaticHtmlRouter,//look into this
  api: apiStateRouter//and that one
 };
 return Object.keys(result).map(function (k){return result[k];});
}

this.AdminStringServer = AdminStringServer;

this.callOnce = util.callOnce;
this.fluentCall = util.fluentCall;
this.fluentKeyCall = util.fluentKeyCall;
