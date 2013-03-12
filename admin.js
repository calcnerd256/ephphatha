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

this.Admin = Admin;
