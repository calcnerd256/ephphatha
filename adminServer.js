var Server = require("./server");
var http = require("http");
var https = require("https");

function AdminStringServer(){
    this.strings = [];
    this.adminTokens = {};
}
(function(s, d){for(var k in d)s[k] = d[k];})(
    AdminStringServer.prototype,
    {
	"appendString": function(str){
	    this.strings.push(str);
	},
	"isAdminSession": function(req){
	    return false;
	},
	"createAdminToken": function(){
	    return "no";
	    var token = "no";
	    //TODO: generate a cryptographically secure random string
	    this.adminTokens[token] = "active";
	    return token;
	},
	"expireAdminTokens": function(){
	    this.adminTokens = {};
	},
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
	"methodRoutingResponder": function(responders){
	    var result = function(req, res){
		if(req.method in responders)
		    return responders[req.method](req, res);
		//TODO: check if method is allowed at all for 501
		res.writeHead(405, "This object doesn't support that method.");
		res.end("no, you can't do that to this");
	    }
	    result.responders = responders;
	    return result;
	},
	"dictIndirect": function(keys, vals){
	    return this.dictionaryMap(
		vals,
		function(kv){
		    var k = kv[0];
		    return [keys[k], vals[k]];
		}
	    );
	},
	"getHttpRouterList": function(){
	    var index = "index";
	    var that = this;
	    var paths = (
		function(stepper, terminator, terminate, d){
		    while(!terminator(d))
			d = stepper(d);
		    return terminate(d);
		}
	    )(
		function(d){
		    return that.dictionaryMap(
			d,
			function(kv){
			    var k = kv[0];
			    var v = kv[1];
			    var parent = v[0];
			    if(parent == k)
				return [k, ["error", "cycle"]];
			    if(!(parent in d)) return kv;
			    par = d[parent];
			    return [
				k,
				[par[0], par[1] + "/" + v[1]]
			    ];
			}
		    );
		},
		function(d){
		    for(var k in d)
			if(d[k][0] in d)
			    if(
				"error" != k ||
				    "error" != d[k][0]
			    )
				return false;
		    return true;
		},
		function(d){
		    return that.dictionaryMap(
			d,
			function(kv){
			    return [kv[0], kv[1][1]];
			}
		    );
		},
		{
		    "empty": [null, ""],
		    "root": ["empty", ""],
		    "index": ["empty", "index"],
		    "indexhtml": ["empty", "index.html"],
		    "favicon": ["empty", "favicon.ico"],
		    "append": ["empty", "append"]
		}
	    );
	    return [].concat(// early binding is bad :(
		this.dictToExactRouterList(
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
		),
		this.dictToExactRouterList(
		    this.dictIndirect(
			paths,
			{
			    favicon: function(req, res){
				res.writeHead(404, "no favicon yet");
				res.end("go away");
			    },
			    append: this.methodRoutingResponder(
				{
				    "GET": this.constantResponder(
					[
					    "<FORM METHOD=\"POST\">",
					    " <TEXTAREA NAME=\"string\"></TEXTAREA>",
					    " <INPUT TYPE=\"SUBMIT\"></INPUT>",
					    "</FORM>"
					].join("\n")
				    ),
				    POST: function(req, res){
					res.end("did not post");
				    }
				}
			    )
			}
		    )
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