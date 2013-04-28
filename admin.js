var crypto = require("crypto");
var util = require("./util");

var formStream = require("form_stream");
 var FormStream = formStream.FormStream;
var routers = require("./routers");
 var router = routers.router;
 var MethodRoutingResponder = router.MethodRoutingResponder;
 var coerceToFunction = router.coerceToFunction;

function Admin(){
 this.adminTokens = {};
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
}

Admin.prototype.generateRandomHex = function generateRandomHex(length, callback, errorback, noisy){
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

Admin.prototype.generatePassword = function(callback){
 return this.generateRandomHex(8, callback);
};


Admin.prototype.setPassword = function setPassword(password){
 var result = this.password;
 this.password = password;
 return result;
}


Admin.prototype.createAdminToken = function createAdminToken(callback, errorBack, noisy){
 var tokenLength = 64;
 return this.generateRandomHex(
  tokenLength,
  function(token){
   if(token in this.adminTokens && "active" == this.adminTokens[token])
    return errorBack("collision");
   this.adminTokens[token] = "active";
   return callback(token);
  }.bind(this),
  errorBack,
  noisy
 );
}

Admin.prototype.expireAdminTokens = function expireAdminTokens(){
 this.adminTokens = {};
}

Admin.prototype.alistToDict = util.alistToDict;


Admin.prototype.requestIsAdmin = function requestIsAdmin(req){
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

Admin.prototype.adminRoute = function adminRoute(router){
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
Admin.prototype.adminOnly = function adminOnly(responder){
 var result = function respond(req, res){
  if(this.requestIsAdmin(req))
   return responder.apply(this, arguments);
  res.statusCode = 403;
  return res.end("not an admin");
 }.bind(this);
 result.responder = responder;
 return result;
}

function getAdminIndexSource(links){
 return this.tagShorthand(//make sure whoever calls it has a tagShorthand :(
  this.tagShorthand.bind(this),
  [
   "HTML", {},
   "tHEAD,x",
   [].concat.apply(
    [
     "BODY", {},
     "radmin",
     "tBR",
    ],
    util.dictToAlist(links).map(
     function(kv){
      return [
       ["A", {HREF: kv[0]}, "r" + kv[1]],
       ["BR"]
      ];
     }
    )
   )
  ]
 ).toString();
}


//real live duplicate code
//please refactor
//from adminServer
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


//depends on constantResponder
//depends on FormStream
//depends on MethodRoutingResponder
function getAdminLoginResponder(){
 var passwordFieldName = "password";
 var inputs = [
  {"NAME": passwordFieldName, "TYPE": "password"}
 ];
 var adminLoginSource = this.tagShorthand(
  this.tagShorthand.bind(this),
  [
   "HTML", {},
   "tHEAD,x",
   [
    "BODY", {},
    "rlog in",
    ["FORM", {METHOD:"POST"}].concat(
     inputs.concat([{"TYPE": "submit"}]).map(
      function(inp){return ["INPUT,x", inp];}
     )
    )
   ]
  ]
 ).toString();
 var handleAdminLoginGetRequest = constantResponder(adminLoginSource);
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
      if(password == this.admin.password)
       return this.admin.createAdminToken(
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

 var adminLoginResponder = new MethodRoutingResponder(
  {
   "GET": handleAdminLoginGetRequest,
   "POST": handleAdminLoginPostRequest.bind(this)
  }
 );
 return adminLoginResponder;
}



this.Admin = Admin;
this.getAdminIndexSource = getAdminIndexSource;
this.getAdminLoginResponder = getAdminLoginResponder;
