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
			    throw new Exception("attempted to call a once-only function multiple times");
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
	    return [
		fluentKeyCall(this.getServerPerProtocol("HTTP"), "setPort", port).init(http.createServer, callOnce(eachBack)),
		httpsOptions ?
		    fluentKeyCall(
			this.getServerPerProtocol("HTTPS"),
			"setPort",
			securePort
		    ).init(
			function(responder){
			    return https.createServer(httpsOptions, responder);
			},
			callOnce(eachBack)
		    ) :
		callOnce(eachBack)()
	    ];
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
	"makeExactMatcher": function(path){
	    var result = function matcher(request){
		if(request.url == path) return true;
	    };
	    result.path = path;
	    return result;
	},
	"dictToAlist": function(dictionary){
	    var result = [];
	    for(var k in dictionary)
		result.push([k, dictionary[k]]);
	    return result;
	},
	"getHttpRouterList": function(){
	    var that = this;
	    return [].concat(
		this.dictToAlist(
		    {
			"/": function(req, res){
			    res.end("index")
			},
			"/favicon.ico": function(req, res){
			    res.writeHead(404, "no favicon yet");
			    res.end("go away");
			}
		    }
		).map(
		    function(args){
			return that.makeRouter(
			    that.makeExactMatcher(args[0]),
			    args[1]
			);
		    }
		),
		[
		    function(req){
			return function(req, res){res.end("not yet");};
		    }
		],
		[]
	    );
	},
	"getHttpsRouterList": function(){
	    return [
		function(req){
		    return function(req, res){res.end("not yet (secure)");};
		}
	    ];
	}
    }
);
this.AdminStringServer = AdminStringServer;