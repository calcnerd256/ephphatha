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

this.StringManager = StringManager;