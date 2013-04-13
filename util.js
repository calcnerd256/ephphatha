//here we go

//delegateCall
function delegateCall(ob, methodName, member, method){
 if(arguments.length < 4)
  method = methodName;
 var result = function(){
  return this[member][method].apply(this[member], arguments);
 }
 result.method = method;
 result.member = member;
 return ob[methodName] = result;
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
 var args = [].slice.call(arguments, 1);
 args[0] = ob;
 return fluentCall.apply(ob[key], args);
}

function alistToDict(alist, stacks){
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


this.delegateCall = delegateCall;
this.mapBack = mapBack;
this.callOnce = callOnce;
this.fluentCall = fluentCall;
this.fluentKeyCall = fluentKeyCall;
this.alistToDict = alistToDict;
