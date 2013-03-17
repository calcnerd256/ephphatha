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


function mapBack(arr, action, callback){
 //action must take two parameters and pass its result to the second parameter exactly once
 //the return value of this function is the result of mapping action across the input array
 //the second parameter passed to action returns
 // the return value of callback the last time it's called
 // its argument the first time it's called for a given index
 // its old argument subsequent times
 var outstanding = arr.length;
 var result = [];
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


this.StringManager = StringManager;
this.FilesystemLiaison = FilesystemLiaison;
this.mapBack = mapBack;
