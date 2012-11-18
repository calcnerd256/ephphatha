var FiniteMapping = require("./finiteMapping").FiniteMapping;

function Environment(){
 this.map = new FiniteMapping();
}
Environment.prototype.write = function(source, path, destination){
 //curry the write to a finite mapping
 //push the history (never forget unless asked)
 var scurr;
 if(!(scurr = this.map.read(source)))
  this.map.write(source, scurr = new FiniteMapping());
 var pcurr;
 if(!(pcurr = scurr.read(path)))
  scurr.write(path, pcurr = []);
 var result;
 if(pcurr.length)
  result = pcurr[pcurr.length - 1];
 pcurr.push(destination);
 return result;
}
Environment.prototype.read = function(source, path){
 return (
  function(scurr){
   if(!scurr) return;
   if("read" in scurr)
    return (
     function(hist){
      if(!hist) return;
      if(hist.length)
       return hist[hist.length - 1];
     }
    )(scurr.read(path))
  }
 )(this.map.read(source));
}
Environment.prototype.forgetHistory = function(source, path){
 return (
  function(scurr){
   if(!scurr) return;
   return scurr.write(path, []);
  }
 )(this.map.read(source));
}
Environment.prototype.getKeys = function(){
 return this.map.getKeys();
}
Environment.prototype.getKeyKeys = function(source){
 return this.map.read(source).getKeys();
}

function Continuation(fn, that, args){
 this.fn = fn;
 this.that = that;
 this.args = args;
}
Continuation.prototype.thunk = function(environment){
 var that = this.that;
 var args = (
  function map(f, xs){
   var r = [];
   for(var i = 0; i < xs.length; i++)
    r[i] = f(xs[i]);
   return r;
  }
 )(
  function get(k){
   return environment.read(that, k)
  },
  this.args
 );
 return this.fn.apply(that, args);
}
this.Continuation = Continuation;
this.Environment = Environment;