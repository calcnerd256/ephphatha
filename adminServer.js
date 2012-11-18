var Server = require("./server");
var http = require("http");
var https = require("https");

function AdminStringServer(){
}
(function(s, d){for(var k in d)s[k] = d[k];})(
    AdminStringServer.prototype,
    {
	"init": function(port, securePort, httpsOptions, callback){
	    var outstanding = 2;
	    function eachBack(){
		if(!--outstanding)
		    return callback.apply(this, arguments);
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
	    return this.servers = {
		http: fluentKeyCall(
		    this.getServerPerProtocol("HTTP"),
		    "setPort",
		    port
		).init(
		    http.createServer,
		    callOnce(eachBack)
		),
		https: httpsOptions ?
		    fluentKeyCall(
			this.getServerPerProtocol("HTTPS"),
			"setPort",
			securePort
		    ).init(
			function(responder){
			    return https.createServer(
				httpsOptions,
				responder
			    );
			},
			callOnce(eachBack)
		    ) :
		callOnce(eachBack)()
	    };
	},
	"getServerPerProtocol": function(prot){
	    var server = new Server.Server();
	    server.routes = this["getHttp" + (("HTTPS" == prot) ? "s" : "") + "RouterList"]();
	    return server;
	},
	"makeRouter": function(matcher, responder){
	    var result = function router(request){
		if(matcher(request)) return responder;
	    }
	    result.matcher = matcher;
	    result.responder = responder;
	    return result;
	},
	"makeUrlMatcher": function(predicate){
	    var result = function urlMatcher(request){
		return predicate(request.url);
	    }
	    result.predicate = predicate;
	    return result;
	},
	"makeExactMatcher": function(path){
	    var result = this.makeUrlMatcher(
		function(url){return url == path;}
	    );
	    result.path = path;
	    return result;
	},
	"dictToAlist": function(dictionary){
	    var result = [];
	    for(var k in dictionary)
		result.push([k, dictionary[k]]);
	    return result;
	},
	"alistToDict": function(alist, stacks){
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
	},
	"dictToExactRouterList": function(dictionary){
	    var that = this;
	    return this.dictToAlist(dictionary).map(
		function(args){
		    return that.makeRouter(
			that.makeExactMatcher(args[0]),
			args[1]
		    );
		}
	    );
	},
	"constantResponder": function(str, mimetype){
	    if(!mimetype) mimetype = "text/html";
	    var result = function(req, res){
		if("text/plain" != mimetype)
		    res.writeHead(200, {"Content-type": mimetype});
		res.end(str);
	    };
	    result.str = str;
	    result.mimetype = mimetype;
	    return result;
	},
	"dictionaryMap": function(ob, fn){
	    return this.alistToDict(this.dictToAlist(ob).map(fn));
	},
	"constantStaticRouterDict": function(d){
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
	},
	"getHttpRouterList": function(){
	    var index = "index";
	    return [].concat(// early binding is bad :(
		this.dictToExactRouterList(
		    this.constantStaticRouterDict(
			{
			    "/": index,
			    "/index": index,
			    "/index.html": index
			}
		    )
		),
		this.dictToExactRouterList(
		    {
			"/favicon.ico": function(req, res){
			    res.writeHead(404, "no favicon yet");
			    res.end("go away");
			},
			"/append": function(req, res){
			    //TODO: do different things on GET and POST
			    res.end("form");
			}
		    }
		),
		[
		],
		[]
	    );
	},
	"getHttpsRouterList": function(){
	    return [].concat(
		this.dictToExactRouterList(
		    {
			"/admin": function(req, res){
			    res.end("admin");
			},
			"/admin/login": function(req, res){
			    res.end("login");
			}
		    }
		),
		this.getHttpRouterList()
	    );
	}
    }
);
this.AdminStringServer = AdminStringServer;