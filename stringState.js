var fs = require("fs");

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
 return getUniqueValue(
  fs.readdirSync(dir),
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

function mapBack(arr, action, callback){
 //action must take two parameters and pass its result to the second parameter exactly once
 //the return value of this function is the result of mapping action across the input array
 //the second parameter passed to action returns
 // the return value of callback the last time it's called
 // its argument the first time it's called for a given index
 // its old argument subsequent times
 var outstanding = arr.length;
 var result = [];
 if(!outstanding)//empty should succeed immediately
  return callback(result);
 return arr.map(
  function(x, i){
   var called = 0;
   return action(
    x,
    function(image){
     var old = result[i];
     result[i] = image;
     if(called) return old;
     called++;
     outstanding--;
     if(!outstanding)
      return callback(result);
     return image;
    }
   );
  }
 );
};
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



this.StringManager = StringManager;
this.FilesystemLiaison = FilesystemLiaison;
this.mapBack = mapBack;
this.getUniqueValue = getUniqueValue;
this.getUniqueFilenameSync = getUniqueFilenameSync;
this.nukeDir = nukeDir;
