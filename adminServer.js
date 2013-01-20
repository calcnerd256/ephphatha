var Server = require("./server");
var http = require("http");
var https = require("https");
var child_process = require("child_process");
var crypto = require("crypto");
var url = require("url");
var formStream = require("form_stream")
 var FormStream = formStream.FormStream;
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

function AdminStringServer(){
 this.generatePassword(
  (
   function setAndWarn(password){
    this.setPassword(password);
    console.warn(
     "Admin password is \"" +
      this.password +
      "\". Please change it immediately."
    );
   }
  ).bind(this)
 );
 this.strings = [];
 this.adminTokens = {};
}

AdminStringServer.prototype.generatePassword = function(callback){
 return this.generateRandomHex(8, callback);
}
AdminStringServer.prototype.setPassword = function setPassword(newPass){
 this.password = newPass;
}


AdminStringServer.prototype.appendString = function appendString(str){
    var result = this.strings.length;
    this.strings.push(str);
    if(this.strings[result] != str) return -1; //that should never happen
    return result;
}
AdminStringServer.prototype.deleteString = function deleteString(index){
 var strs = this.strings;
 if(strs.length - 1 == index)
  return strs.pop();
 var result = strs[index];
 if(index)
  if(!((index - 1) in strs))
   if((index + 1) in strs)
    strs[index - 1] = strs[index + 1]
 if(!(index in strs)) return false;
 delete strs[index];
 return result;
}

AdminStringServer.prototype.generateRandomHex = function generateRandomHex(length, callback, errorBack, noisy){
    if(!callback)
	callback = noisy ?
	    function(){throw arguments;} :
            console.log.bind(console);
    if("function" != typeof errorBack)
	errorBack = noisy ?
	    function(e){throw e;} :
            function(){return callback();};
    function toHex(b){return b.toString(16);}
    function pad(str){
	while(str.length < 2)
	    str = "0" + str;
	return str;
    }
    return crypto.randomBytes(
	length / 2,
	function(e, buf){
	    if(e) return errorBack(e);
	    var randomHex = [].map.call(buf, toHex).map(pad).join("");
	    return callback(randomHex);
	}
    );
}
AdminStringServer.prototype.createAdminToken = function createAdminToken(callback, errorBack, noisy){
    var that = this;
    var tokenLength = 64;
    return this.generateRandomHex(
	tokenLength,
	function(token){
	    if(token in that.adminTokens && "active" == that.adminTokens[token])
		return errorBack("collision");
	    that.adminTokens[token] = "active";
	    return callback(token);
	},
	errorBack,
	noisy
    );
}

AdminStringServer.prototype.expireAdminTokens = function expireAdminTokens(){
    this.adminTokens = {};
}

function callOnce(fn, noisy){
    return function vapor(){
	var result = fn.apply(this, arguments);
	fn = function(){
	    if(noisy)
		throw new Error("attempted to call a once-only function multiple times");
	};
	return result;
    };
}
function fluentCall(ob){
    var args = [].slice.call(arguments, 1);
    this.apply(ob, args);
    return ob;
}
function fluentKeyCall(ob, key){
    var args = [].slice.call(arguments, 1);
    args[0] = ob;
    return fluentCall.apply(ob[key], args);
}
this.callOnce = callOnce;
this.fluentCall = fluentCall;
this.fluentKeyCall = fluentKeyCall;


AdminStringServer.prototype.init = function init(port, securePort, httpsOptions, callback){
    var outstanding = 2;
    function eachBack(){
	if(!--outstanding)
	    return callback.apply(this, arguments);
    }
    var httpServer = fluentKeyCall(
	this.getServerPerProtocol("HTTP"),
	"setPort",
	port
    ).init(http.createServer, callOnce(eachBack));
    var httpsBack = callOnce(eachBack);
    var httpsServer;
    function createHttpsServerClosure(responder){
		return https.createServer(
		    httpsOptions,
		    responder
		);
    }
    if(!httpsOptions) httpsServer = httpsBack();
    else
	httpsServer = fluentKeyCall(
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


AdminStringServer.prototype.alistToDict = function alistToDict(alist, stacks){
    var result = {};
    alist.map(
	stacks ?
	    function(kv){
		var k = kv[0];
		var v = kv[1];
		if(!(k in result)) result[k] = [];
		result[k].push(v);
	    } :
	    function(kv){
		var k = kv[0];
		var v = kv[1];
		if(k in result) return;
		result[k] = v;
	    }
    );
    return result;
}


AdminStringServer.prototype.dictToExactRouterListRouter = function dictToExactRouterList(dictionary){
 return new ExactDictRouter(dictionary);
}

AdminStringServer.prototype.constantResponder = function constantResponder(str, mimetype){
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

AdminStringServer.prototype.dictionaryMap = function dictionaryMap(ob, fn){
    return this.alistToDict(dictToAlist(ob).map(fn));
}

AdminStringServer.prototype.constantStaticRouterDict = function constantStaticRouterDict(d){
    var that = this;
    return this.dictionaryMap(
	d,
	function(kv){
	    return [
		kv[0],
		that.constantResponder(kv[1])
	    ];
	}
    );
}

AdminStringServer.prototype.dictIndirect = function dictIndirect(keys, vals){
    return this.dictionaryMap(
	vals,
	function(kv){
	    var k = kv[0];
	    return [keys[k], vals[k]];
	}
    );
}

AdminStringServer.prototype.urlDecodeFormDataToAlist = function urlDecodeFormDataToAlist(str){
    return str.split(";").map(
	function(s){
	    return s.split("=");
	}
    ).map(
	function(xs){
	    k = xs.shift();
	    return [
		k,
		xs.join("=")
	    ].map(
		function(s){
		    return s.split("+").join(" ");
		}
	    ).map(decodeURIComponent);
	}
    );
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
	return that.dictionaryMap(
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
    var paths = this.dictionaryMap(
	pathDictionary,
	function(kv){
	    var key = kv[0];
	    var value = kv[1];
	    return [key, value[1]];
	}
    );

 var constantStaticRouters = new ExactDictRouter(
	this.constantStaticRouterDict(
	    this.dictIndirect(
		paths,
		{
		    root: index,
		    index: index,
		    indexhtml: index
		}
	    )
	)
 );
    var handleAppendGet = this.constantResponder(
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
	    index = that.appendString(string);
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
			return stringBack(buf.join(""));
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
	this.dictIndirect(
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

AdminStringServer.prototype.requestIsAdmin = function requestIsAdmin(req){
    var headers = req.headers;
    var cookie = headers.cookie;
    if(!cookie) return false;
    var crumbs = cookie.split(";");
    var alist = crumbs.map(
	function(s){
	    var result = s.split("=");
	    var key = result.shift().trim();
	    return [key, result.join("=")];
	}
    );
    var dict = this.alistToDict(alist);
    var token = dict.token;
    return token in this.adminTokens && "active" == this.adminTokens[token];
}

AdminStringServer.prototype.adminOnly = function adminOnly(responder){
    var result = function respond(req, res){
	if(this.requestIsAdmin(req))
	    return responder.apply(this, arguments);
	res.statusCode = 403;
	return res.end("not an admin");
    }.bind(this);
    result.responder = responder;
    return result;
}
AdminStringServer.prototype.adminRoute = function adminRoute(router){
 var result = function route(req){
  var responder = coerceToFunction(router)(req);
  if(this.requestIsAdmin(req))
   return responder;
  return responder &&
   function respond(req, res){
    res.statusCode = 403;
    return res.end("not an admin");
   };
 }.bind(this);
 result.router = router;
 return result;
}

AdminStringServer.prototype.getHttpsRouterList = function getHttpsRouterList(){
 var that = this;
 var adminLoginUrl = "/admin/login"; //TODO use the routing table like in getHttpRouterList
 var adminIndexSource = [
  "<HTML>",
  " <HEAD>",
  " </HEAD>",
  " <BODY>",
  "  admin",
  "  <BR />",
  "  <A HREF=\"" + adminLoginUrl + "\">log in</A>",
  "  <BR />",
  "  " + dictToAlist(
   {
    gconf: "gconf",
    mouse: "mouse",
    list: "list"
   }
  ).map(
   function(kv){
    return "<A HREF=\"" + kv[0] + "/\">" + kv[1] + "</A>\n  <BR />";
   }
  ).join("\n  "),
  " </BODY>",
  "</HTML>",
  ""
 ].join("\n");
 var passwordFieldName = "password";
 var inputs = [
  {"name": passwordFieldName, "type": "password"}
 ];
 var adminLoginSource = [
  "<HTML>",
  " <HEAD>",
  " </HEAD>",
  " <BODY>",
  "  log in",
  "  <FORM METHOD=\"POST\">",
  "   " + inputs.map(
   function(inp){
    return "<INPUT " +
     dictToAlist(inp).map(
      function(pair){
       return pair[0] +
	"=\"" +
	escape(pair[1]) +
	"\"";
      }
     ).join(" ") +
     "></INPUT>";
   }.bind(this)
  ).join("   \n"),
  "   <INPUT TYPE=\"submit\"></INPUT>",
  "  </FORM>",
  " </BODY>",
  "</HTML>",
  ""
 ].join("\n");
 var handleAdminIndexRequest = this.constantResponder(adminIndexSource);
 var handleAdminLoginGetRequest = this.constantResponder(adminLoginSource);
 function handleAdminLoginPostRequest(req, res){
  var form = new FormStream(req);
  var done = false;
  form.on(
   "s_" + passwordFieldName,
   function(s){
    done = true;
    formStream.bufferChunks(
     s,
     function(password){
      if(password == this.password)
       return this.createAdminToken(
	function(token){
	 var cookie = [
	  "token=" + token,
	  "Path=/",
	  "Secure",
	  "HttpOnly"
	 ].join("; ");
	 res.setHeader("Set-Cookie", cookie);
	 res.end("login success " + token);
	}.bind(this),
	function(e){
	 res.statusCode = 500;
	 res.end("oops");
	}
       );
      res.statusCode = 403;
      res.end("login failure");
     }.bind(this)
    ).resume();
   }.bind(this)
  ).on(
   "end",
   function(){
    if(!done)
     return res.end("bad login");
   }
  );
 }
 function listStrings(req, res){
  var strs = this.strings;
  res.writeHead(200, {"Content-Type": "text/html"});
  for(var i = 0; i < strs.length; i++)
   res.write(
    [
     "<LI><A HREF=\"../" + i + "\">" + i + "</A></LI>",
     ""
    ].join("\n"));
  res.end("listing");
 }
 var stringDav = new Router(
  new UrlMatcher(
   function match(u){
    var p = u.split("?")[0].split("/");
    if(3 != p.length) return false;
    if("admin" != p[1]) return false;
    return +p[2] == p[2];
   }
  ),
  function davString(req, res){
   var p = url.parse(req.url).pathname.split("/");
   var n = +(p[2]);
   var strs = this.strings;
   if(!(n in strs))
    return (
     function(r){
      r.statusCode = 404;
      r.end("index out of bounds");
     }
    )(res);
   var str = strs[n];
   return res.end(str);
  }.bind(this)
 );
 var routingDictionary = {
  "/admin/": handleAdminIndexRequest,
  "/admin/index": handleAdminIndexRequest,
  "/admin/index.html": handleAdminIndexRequest,
  "/admin/test": function(req, res){
   return res.end(this.requestIsAdmin(req) ? "ok" : "nope");
  }.bind(this),
  "/admin/list/": this.adminOnly(listStrings.bind(this))
 };
 routingDictionary[adminLoginUrl] = new MethodRoutingResponder(
  {
   "GET": handleAdminLoginGetRequest,
   "POST": handleAdminLoginPostRequest.bind(this)
  }
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
 return [
  new ExactDictRouter(routingDictionary),
  stringDav,
  this.adminRoute(
   new ExactRouter(
    "/admin/mouse/",
    require("webmouse").responder
   )
  ),
  this.adminRoute(gconf),
  new RouterListRouter(this.getHttpRouterList())
 ];
}

this.AdminStringServer = AdminStringServer;
