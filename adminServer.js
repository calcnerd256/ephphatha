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
		httpsOptions ? fluentKeyCall(this.getServerPerProtocol("HTTPS"), "setPort", securePort).init(function(responder){return https.createServer(httpsOptions, responder);}, callOnce(eachBack)) : null
	    ];
	},
	"getServerPerProtocol": function(prot){
	    var server = new Server();
	    server.routes = this["getHttp" + (("HTTPS" == prot) ? "s" : "") + "RouterList"]();
	    return server;
	},
	"getHttpRouterList": function(){
	    return [function(req){return function(req, res){res.end("not yet");};}]
	},
	"getHttpsRouterList": function(){
	    return [function(req){return function(req, res){res.end("not yet");};}];
	}
    }
);
this.AdminStringServer = AdminStringServer;