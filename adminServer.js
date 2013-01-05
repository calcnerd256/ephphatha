var Server = require("./server");
var http = require("http");
var https = require("https");
var child_process = require("child_process");
var crypto = require("crypto");
var formStream = require("form_stream")
var FormStream = formStream.FormStream;

function AdminStringServer(){
    this.generatePassword(
	(
	    function(password){
		this.setPassword(password);
		console.log("Admin password is \"" + this.password + "\". Please change it immediately.");
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
	}.bind(this)
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
		    this.dictToAlist(inp).map(
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
    var routingDictionary = {
	"/admin": handleAdminIndexRequest,
	"/admin/test": function(req, res){
	    return res.end(this.requestIsAdmin(req) ? "ok" : "nope");
	}.bind(this),
	"/admin/mouse": this.adminOnly(
	    this.methodRoutingResponder(
		{
		    "GET": function(req, res){
			if(!("clientSource" in this))
			    this.clientSource = {};
			if(!(this.clientSource.mover))
			    this.clientSource.mover = function(evt){
				if(!window.dragState)
				    window.dragState = {dx: 0, dy: 0, frame: 0};
				evt.preventDefault();
				var t = evt.touches[0];
				var x = t.clientX;
				var y = t.clientY;
				var dx = x - window.dragState.x;
				if(!("x" in window.dragState)) dx = 0;
				window.dragState.x = x;
				var dy = y - window.dragState.y;
				if(!("y" in window.dragState)) dy = 0;
				window.dragState.y = y;
				window.dragState.dx += dx;
				window.dragState.dy += dy;
				window.dragState.frame++;
				if(!window.dragState.notReady){
				    window.dragState.notReady = 1;
				    var sensitivity = 0.5;
				    var xd = Math.floor(window.dragState.dx * sensitivity);
				    var yd = Math.floor(window.dragState.dy * sensitivity);
				    window.dragState.dx = 0;
				    window.dragState.dy = 0;
				    window.dragState.frame = 0;
				    var xhr = new XMLHttpRequest();
				    xhr.onreadystatechange = function(){
					if(4 == xhr.readyState)
					    window.dragState.notReady = 0;
				    }

				    xhr.open("POST", "/admin/mouse");
				    var postdata = "x=" +
					xd +
					"&y=" + yd;
				    xhr.send(postdata);
				}
			    };
			var mover = this.clientSource.mover;
			var src = [
			    "<form method=\"POST\">",
			    " <input name=\"x\"></input>",
			    " <input name=\"y\"></input>",
			    " <input type=\"submit\">",
			    "</form>",
			    "<script>",
			    " document.addEventListener(",
			    "  \"touchstart\",",
			    "  function(evt){",
			    "   //TODO make this happen when the focus finger changes",
			    "   if(!window.dragState)",
			    "    window.dragState = {dx:0, dy:0, frame:0};",
			    "   delete window.dragState.x;",
			    "   delete window.dragState.y;",
			    "  }",
			    " )",
			    " document.addEventListener(\"touchmove\", " + mover + ");",
			    "</script>",
			    ""
			].join("\n")
			res.setHeader("Content-Type", "text/html");
			res.end(src);
		    }.bind(this),
		    "POST": function(q, s){
			var form = new FormStream(q);
			var x = 0; var y = 0;
			var state = [
			    0,//x
			    0,//y
			    0//complete called once
			];
			function complete(){
			    if(state[2]) return;
			    state[2] = 1;
			    var kid = child_process.spawn(
				"xdotool",
				[
				    "mousemove_relative",
				    "--",//necessary for negative values of x and y
				    "" + (+x),
				    "" + (+y)
				]
			    );
			    kid.on(
				"exit",
				function(code){
				    if(code)
					console.warn(
					    [
						"xdotool mousemove_relative",
						x,
						y,
						"exited with code",
						code
					    ]
					);
				    s.end(""+code);
				}
			    );
			}
			form.on(
			    "s_x",
			    function(s){
				state[0] = 1;
				formStream.bufferChunks(
				    s, 
				    function(_x){
					state[0] = 2;
					x = _x;
					if(2 == state[1])
					    return complete();
				    }
				).resume();
			    }
			);
			form.on(
			    "s_y",
			    function(s){
				state[1] = 1;
				formStream.bufferChunks(
				    s,
				    function(_y){
					state[1] = 2;
					y = _y;
					if(2 == state[0])
					    return complete();
				    }
				).resume();
			    }
			);
			form.on(
			    "end",
			    function(){
				if(state[0] == 1) return;
				if(state[1] == 1) return;
				complete();
			    }
			);
		    }
		}
	    )
	)
    };
    routingDictionary[adminLoginUrl] = this.methodRoutingResponder(
	{
	    "GET": handleAdminLoginGetRequest,
	    "POST": handleAdminLoginPostRequest.bind(this)
	}
    );
    var gconf = this.makeRouter(
	this.makeUrlMatcher(
	    function(u){
		var parts = u.split("/");
		//assume parts[0] == ""
		if("admin" != parts[1]) return false;
		if("gconf" != parts[2]) return false;
		return true;
	    }
	),
	this.adminOnly(
	    this.methodRoutingResponder(
		{
		    "GET": function(q, s){
			var u = q.url.split("/");
			u.shift(); // ""
			u.shift(); // "admin"
			u.shift(); // "gconf"
			var kid = child_process.spawn(
			    "gconftool-2",
			    [
				"--all-dirs",
				"/" + u.join("/")
			    ]
			)
			var lex = new (formStream.SingleCharacterDelimiterLexerEmitter)(kid.stdout, "\n");
			lex.on(
			    "lexer",
			    function(lineStream){
				var sliced = new (formStream.FunctionImageStream)(
				    new (formStream.SlicingStream)(lineStream, 1),
				    escape
				);
				sliced.on("data", function(){console.log(arguments)});
				formStream.bufferChunks(
				    sliced.resume(),
				    function(p){
					s.write(
					    "<a href=\"" +
						(
						    function last(xs){
							return xs[xs.length - 1];
						    }
						)(p.split("/")) +
						"\">" +
						p +
						"</a><br />\n"
					);
				    }
				);
				lineStream.resume();
			    }
			);
			//kid.stdout.pipe(s);
			lex.on(
			    "end",
			    function(){s.end();}
			).resume();
			//s.end("gconf " + u.join("/"));
		    }
		}
	    )
	)
    );
    return [].concat(
	this.dictToExactRouterList(routingDictionary),
	[
	    gconf
	],
	this.getHttpRouterList(),
	[]
    );
}

this.AdminStringServer = AdminStringServer;
