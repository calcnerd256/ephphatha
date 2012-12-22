var Server = require("./server");
var http = require("http");
var https = require("https");
var crypto = require("crypto");

function AdminStringServer(){
    this.strings = [];
    this.adminTokens = {};
}

AdminStringServer.prototype.appendString = function appendString(str){
    var result = this.strings.length;
    this.strings.push(str);
    if(this.strings[result] != str) return -1; //that should never happen
    return result;
}

AdminStringServer.prototype.isAdminSession = function isAdminSession(req){
    return false;
}

AdminStringServer.prototype.createAdminToken = function createAdminToken(callback, errorBack, noisy){
    var that = this;
    if(!callback) callback = noisy ? function(){throw arguments;} : console.log.bind(console);
    if("function" != typeof errorBack)
	errorBack = noisy ? function(e){throw e;} : function(){return callback();};
    var tokenLength = 64;
    return crypto.randomBytes(
	tokenLength / 2,
	function(e, buf){
	    if(e) return errorBack(e);
	    function toHex(b){return b.toString(16);}
	    function pad(str){while(str.length < 2) str = "0" + str; return str;}
	    var token = [].map.call(buf, toHex).map(pad).join("");
	    if(token in that.adminTokens && "active" == that.adminTokens[token])
		return errorBack("collision");
	    that.adminTokens[token] = "active";
	    return callback(token);
	}
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
    var args = [].slice.call(arguments, 2);
    args.unshift(ob);
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
    server.routes = this[
	"getHttp" +
	    (("HTTPS" == prot) ? "s" : "") +
	    "RouterList"
    ]();
    return server;
}

AdminStringServer.prototype.makeRouter = function makeRouter(matcher, responder){
    var result = function router(request){
	if(matcher(request)) return responder;
    }
    result.matcher = matcher;
    result.responder = responder;
    return result;
}

AdminStringServer.prototype.makeUrlMatcher = function makeUrlMatcher(predicate){
    var result = function urlMatcher(request){
	return predicate(request.url);
    }
    result.predicate = predicate;
    return result;
}

AdminStringServer.prototype.makeExactMatcher = function makeExactMatcher(path){
    var result = this.makeUrlMatcher(
	function(url){return url == path;}
    );
    result.path = path;
    return result;
}

AdminStringServer.prototype.dictToAlist = function dictToAlist(dictionary){
    var result = [];
    for(var k in dictionary)
	result.push([k, dictionary[k]]);
    return result;
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

AdminStringServer.prototype.dictToExactRouterList = function dictToExactRouterList(dictionary){
    var that = this;
    return this.dictToAlist(dictionary).map(
	function(args){
	    return that.makeRouter(
		that.makeExactMatcher(args[0]),
		args[1]
	    );
	}
    );
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
    return this.alistToDict(this.dictToAlist(ob).map(fn));
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

AdminStringServer.prototype.methodRoutingResponder = function methodRoutingResponder(responders){
    var result = function(req, res){
	if(req.method in responders)
	    return responders[req.method](req, res);
	//TODO: check if method is allowed at all for 501
	res.writeHead(405, "This object doesn't support that method.");
	res.end("no, you can't do that to this");
    }
    result.responders = responders;
    return result;
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
    var adminUrl = "/admin";//TODO: make this point to HTTPS only
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

    var constantStaticRouters = this.dictToExactRouterList(
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
	var data = [];
	req.on("data", function(chunk){data.push(chunk)});
	req.on(
	    "end",
	    function endBack(){
		//TODO: don't buffer the whole thing like that
		var input = data.join("");
		var alist = that.urlDecodeFormDataToAlist(input);
		var dict = that.alistToDict(alist);
		if(!("string" in dict)){
		    res.end("bad POST attempt");
		    return;
		}
		var string = dict.string;
		index = that.appendString(string);
		res.writeHead(200, {"Content-type": "text/plain"});
		res.end(
		    "POST successful: " +
			index +
			"\n" +
			string
		);
	    }
	);
    }
    var handleAppendRequest = this.methodRoutingResponder(
	{
	    "GET": handleAppendGet,
	    POST: handleAppendPost
	}
    );
    var moreRouters = this.dictToExactRouterList(
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
    return [].concat(// early binding is bad :(
	constantStaticRouters,
	moreRouters,
	[
	],
	[]
    );
}

AdminStringServer.prototype.getHttpsRouterList = function getHttpsRouterList(){
    var that = this;
    function handleAdminLoginRequest(req, res){
	//TODO handle GET and POST
	res.end("login");
    }
    var adminIndexSource = [
	"admin"
    ].join("\n");
    var handleAdminIndexRequest = this.constantResponder(adminIndexSource);
    var handleAdminLoginGetRequest = handleAdminLoginRequest;
    var handleAdminLoginPostRequest = handleAdminLoginRequest;
    return [].concat(
	this.dictToExactRouterList(
	    {
		"/admin": handleAdminIndexRequest,
		"/admin/login": this.methodRoutingResponder(
		    {
			"GET": handleAdminLoginGetRequest,
			"POST": handleAdminLoginPostRequest
		    }
		)
	    }
	),
	this.getHttpRouterList()
    );
}

this.AdminStringServer = AdminStringServer;
