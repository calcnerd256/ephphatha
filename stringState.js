var fs = require("fs");
var url = require("url");
var util = require("./util");

var mapBack = util.mapBack;

function StringManager(){
 this.strings = [];
}
StringManager.prototype.appendNewString = function appendNewString(str){
 var result = this.strings.map(
  function(s, i){
   return this.strEq(i, str);
  }.bind(this)
 ).indexOf(true);
 if(-1 != result) return result;
 result = this.strings.length;
 this.strings.push(str);
 if(!this.strEq(result, str)) //that should never happen
  return -1;
 return result;
};
StringManager.prototype.deleteString = function deleteString(index){
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
};
StringManager.prototype.strEq = function strEq(i, str){
 return this.getStringAt(i) == ""+str;
};
StringManager.prototype.getStringAt = function getStringAt(index){
 return this.strings[index];
};

function FilesystemLiaison(stringManager){
 this.stringManager = stringManager;
}

FilesystemLiaison.prototype.loadStrings = function loadStrings(dir, callback, errback){
 if(!dir)
  dir = "persist";
 if(!callback) callback = function(){};
 if(!errback) errback = function(){};
 return fs.readdir(
  dir,
  function(err, files){
   if(err) return errback(err);
   return mapBack(
    files.map(function(x){return dir + "/" + x}),
    function(x, f){
     return [
      x,
      fs.readFile(
       x,
       function(err, data){
        if(err) return f([x, -1, err]);// TODO: redesign mapBack
        return f([x, this.stringManager.appendNewString(""+data)]);
       }.bind(this)
      )
     ];
    }.bind(this),
    callback
   );
  }.bind(this)
 );
};

FilesystemLiaison.prototype.saveString = function saveString(index, dir){
 if(index in this.stringManager.strings)
  return saveBufferSync(this.stringManager.getStringAt(index), dir);
}

FilesystemLiaison.prototype.dumpAllStrings = function dumpAllStrings(dir){
 return this.stringManager.strings.map(
  function(s,i){
   return this.saveString(i, dir);
  }.bind(this)
 );
}

function getUniqueValue(oldValues, hash, n, increment){
 if(!oldValues)
  oldValues = [];//useless
 if(!hash)
  hash = function I(x){return x};
 if(!n)
  n = oldValues.length ? oldValues.length - 1 : 0;
 if(!increment)
  increment = function(n){return n + 1;};
 var result;
 var count = 0;
 while(-1 != oldValues.indexOf(result = ""+hash(n))){
  n = increment(n) + (increment(n) == n); // I refuse to run an infinite loop!
  if(count++ > (oldValues.length + 1) * (oldValues.length + 1) * 10) // how dare it be quadratic?
   return oldValues.join(".")+"_"; // guaranteed not to be in there by finity of oldValues and its elements
 }
 return result;
}
function getUniqueFilenameSync(dir, hasher){
 // side effect: creates directory if it doesn't exist
 var listing;
 try{
  listing = fs.readdirSync(dir);
 }
 catch(e){
  //TODO how do I check for ENOENT?
  fs.mkdirSync(dir);
  listing = [];
 }
 return getUniqueValue(
  listing,
  hasher
 );
}


function saveBufferSync(buffer, dir){
 if(!dir)
  dir = "persist";
 var filename = getUniqueFilenameSync(dir);
 var fd = fs.openSync(dir + "/" + filename, "w", 0660);//want "wx", but it doesn't exist yet
 fs.writeSync(fd, buffer);
 fs.closeSync(fd);
 return filename;
}

function nukeDir(dir, callback){
 //callback takes a list of lists of [path, error]
 if(!dir)
  dir = "persist";
 if(!callback)
  callback = function(){};
 fs.readdir(
  dir,
  function(err, files){
   if(err) return callback([[dir, err]]);
   return mapBack(
    files.map(function(x){return dir + "/" + x}),
    function(x, f){
     return fs.unlink(
      x,
      function(err){
       return f([x, err]);
      }
     );
    },
    function(xs){return callback(null, xs);}
   );
  }
 );
};

FilesystemLiaison.prototype.replaceDir = function replaceDir(dir, callback){
 if(!dir)
  dir = "persist";
 if(!callback)
  callback = function(){};
 return nukeDir(
  dir,
  function(errors){
   return callback(
    this.dumpAllStrings(dir)
   );
  }.bind(this)
 );
}

function listStrings(req, res){
  var strs = this.stringManager.strings;
  res.writeHead(200, {"Content-Type": "text/html"});
  for(var i = 0; i < strs.length; i++)
   res.write(
    this.tagShorthand(
     this.tagShorthand.bind(this),
     [
      "LI", {},
      [
       "A", {HREF: "../" + i},
       "r" + i
      ],
      [
       "FORM", {METHOD: "POST", ACTION: "../" + i + "/del"},
        ["INPUT,x", {TYPE: "submit", VALUE: "delete"}]
      ],
      [
       "FORM", {METHOD: "POST", ACTION: "../" + i + "/exec"},
       ["INPUT,x", {TYPE: "submit", VALUE: "eval"}]
      ],
      ["IFRAME,x", {SRC: "../" + i}],
     ]
    ).toString() + "\n"
   );
  res.end("listing");
 };

// matches "/admin/" followed by a number
 function matchStringUrlPrefix(u){
  var p = u.split("?")[0].split("/");
  p.shift();
  if("admin" != p.shift()) return false;
  if(+p[0] != p[0]) return false;
  return p;
 }
// these belong in the stringManager class
  function davString(req, res){
   var p = url.parse(req.url).pathname.split("/");
   var n = +(p[2]);
   var strs = this.stringManager.strings;
   if(!(n in strs))
    return (
     function(r){
      r.statusCode = 404;
      r.end("index out of bounds");
     }
    )(res);
   var str = strs[n];
   res.setHeader("Content-Type", "text/plain");
   return res.end(str);
  }

  function delString(req, res){
   if("GET" == req.method)
    //why is this not a methodRouting responder?
    return (
     function(r){
      r.setHeader("Content-Type", "text/html");
      return r;
     }
    )(res).end(
     [
      "<FORM METHOD=\"POST\">",
      " <INPUT TYPE=\"SUBMIT\"></INPUT>",
      "</FORM>"
     ].join("\n")
    );
   var p = matchStringUrlPrefix(req.url);
   str = this.stringManager.deleteString(+p[0]);
   if(!str)
    return (
     function(r){
      r.statusCode = 404;
      return r;
     }
    )(res).end("no such string" + p[0]);
   res.setHeader("Content-Type", "text/plain");
   return res.end(str);
  }
  function execString(req, res){
   if("GET" == req.method)
    return (
     function(r){
      r.setHeader("Content-Type", "text/html");
      return r;
     }
    )(res).end(
     [
      "<FORM METHOD=\"POST\">",
      " <INPUT TYPE=\"SUBMIT\"></INPUT>",
      "</FORM>"
     ].join("\n")
    );
   var p = matchStringUrlPrefix(req.url);
   var i = +p[0];
   if(!(i in this.stringManager.strings))
    res.statusCode = 404;
   str = ""+this.execString(i);
   res.setHeader("Content-Type", "text/plain");
   return res.end(str);
  }






this.StringManager = StringManager;
this.FilesystemLiaison = FilesystemLiaison;
this.mapBack = mapBack;
this.getUniqueValue = getUniqueValue;
this.getUniqueFilenameSync = getUniqueFilenameSync;
this.nukeDir = nukeDir;

this.listStrings = listStrings;
this.matchStringUrlPrefix = matchStringUrlPrefix;
this.davString = davString;
this.delString = delString;
this.execString = execString;
