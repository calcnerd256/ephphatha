var crypto = require("crypto");

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

Admin.prototype.alistToDict = function alistToDict(alist, stacks){
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



this.Admin = Admin;
