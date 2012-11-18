function FiniteMapping(){
 this.stringHash = {};
 this.numberHash = [];
 this.objectHash = [];//this is bad
 this.functionHash = [];//same problem
}
function createHandler(reader, writer){
 var result = function handle(){
 }
 result.read = reader;
 result.write = writer;
 return result;
}
FiniteMapping.prototype.handlers = {
 string: createHandler(
  function readString(key){
   return this.stringHash[key];
  },
  function writeString(key, value){
   var result = this.stringHash[key];
   this.stringHash[key] = value;
   return result;
  }
 ),
 number: createHandler(
  function readNumber(key){
   return this.numberHash[key];
  },
  function writeNumber(key, value){
   var result = this.numberHash[key];
   this.numberHash[key] = value;
   return result;
  }
 ),
 object: createHandler(
  function readObject(key){
   for(var i = 0; i < this.objectHash.length; i++)
    if(this.objectHash[i].key == key)
     return this.objectHash[i].value;
  },
  function writeObject(key, value){
   this.objectHash.unshift({key: key, value: value});
  }
 ),
 "function": createHandler(
  function readFunction(key){
   var h = this.functionHash;
   for(var i = 0; i < h.length; i++)
    if(h[i].key == key)
     return h[i].value;
  },
  function writeFunction(key, value){
   this.functionHash.unshift({key: key, value: value});
  }
 )
};

FiniteMapping.prototype.read = function(key, pedantic){
 if(!pedantic)
  if(key == +key) key = +key;//coerce numeric strings to numbers
 if((typeof key) in this.handlers)
  return this.handlers[typeof key].read.call(this, key);
 throw new Error("unhandled type");
}
FiniteMapping.prototype.write = function(key, value, pedantic){
 if(!pedantic)
  if(key == +key) key = +key;//coerce to number
 if((typeof key) in this.handlers){
  var result = this.read(key, pedantic);
  this.handlers[typeof key].write.call(this, key, value);
  return result;
 }
 throw new Error("unhandled type");
}
FiniteMapping.prototype.getKeys = function getKeys(){
 var result = [];
 for(var k in this.stringHash)
  result.push(k);
 for(var i = 0; i < this.numberHash.length; i++)
  if("undefined" != typeof this.numberHash[i])//yuck
   result.push(i);
 for(var i = 0; i < this.objectHash.length; i++)
  result.push(this.objectHash[i].key);
 for(var i = 0; i < this.functionHash.length; i++)
  result.push(this.functionHash[i].key);
 return result;
}

//TODO: idea: redo mapping with natural numbers for internal representation
//that is, compose anything->natural with natural->anything
//natural->anything is already taken care of with arrays
//anything->natural can be done with patches like before, but with extra indirection
//I would just indirect through strings, but what's the best string representation? (typeof ob) + ":" + someNatural ?

this.FiniteMapping = FiniteMapping;
