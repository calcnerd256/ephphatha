//applicative monads
// Pure
// Function_ // it's like a function; maybe I should curry it instead?
// Future
// Promise
// List // not implemented yet

function Pure(x){
 this.value = x;
}
Pure.prototype.fmap = function(f){return new Pure(f(this.extract()));};
Pure.prototype.pure = function(x){return new Pure(x);};
Pure.prototype.extract = function(){return this.value;};
Pure.prototype.join = function(){return this.extract();};
Pure.prototype.applicate = function applicate(p){
 // this turns out to be a law or something
 // the "this" object is expected to contain a function that it gives to whoever fmaps over it
 var catamorphism = p.fmap.bind(p); // constructs the other functor from a function
 var nested = this.fmap(catamorphism);
 return nested.join();
};

function Function_(f){
 this.value = f;
}
Function_.toFunction = function(){return this.value};
Function_.prototype.apply = function(args){
 return this.toFunction().apply(this, args);
}
Function_.prototype.fmap = function(f){
 return new Function(function(){return f(this.apply(arguments));}.bind(this));
};
Function_.K = function K(x){return function(){return x;};};
Function_.prototype.pure = function(x){
 return new Function_(Function_.K(x));
}
// applicate looks like f <*> g = S f g = \ x . f x (g x)
// X <*> Y = join (fmap (\ f . fmap f Y) X)
// S f g = join (B (\ x . B x g) f)
//  f x (g x) = join (\ y z . f y (g z)) x
// join h x = h x x
// f x (g x) = join (\ y z . f y (g z)) x
Function_.prototype.join = function(){
 return new Function_(
  function(){
   var partial = this.apply(arguments);
   if(partial instanceof Pure) return partial.extract();
   return partial.apply(arguments);
  }.bind(this)
 );
}
Function_.prototype.applicate = Pure.prototype.applicate;


function Future(){
 this.listeners = [];
 this.done = false;
}
Future.prototype.listen = function(callback){
 if(this.done) return callback(this.extract());
 this.listeners.push(callback);
};
Future.prototype.occur = function(v){
 //assume !this.done
 this.value = v;
 this.done = true; //order matters!
 var listeners = this.listeners; // make sure no listeners mess up the list or rely on you not messing it up
 this.listeners = [];
 listeners.map(function(f){return f(v);});
 return this;
};
Future.prototype.extract = function(){
 if(!this.done) throw new Error(["future hasn't occurred yet", this]);
 return this.value;
}
Future.prototype.fmap = function(transformation_to_compose){
 var result = new Future();
 this.listen(
  function delegate_image_to_transformed_clone(preimage){
   var image = transformation_to_compose(preimage);
   result.occur(image);
  }
 );
 return result;
};
Future.prototype.pure = function(x){
 var result = new Future();
 result.occur(x);
 return result;
};
Future.prototype.join = function(){
 var result = new Future();
 this.listen(
  function(p){
   if(p instanceof Pure) return result.occur(p.extract());
   p.listen(result.occur.bind(result));
  }
 );
 return result;
};
Future.prototype.applicate = Pure.prototype.applicate;
Future.never = new Future();
Future.never.listen = function(){};
Future.never.occur = function(){throw new Error("pigs flew, with arguments:", arguments);};
Future.never.fmap = function(){return Future.never;};
Future.never.join = Future.never.fmap;
Future.never.toString = function(){return "Future.never";};
Future.name = "Never";

//maybe a "Promise a" is an "Either (Future Error) (Future a)" ?
//or maybe just a "Future (Either Error a)"
//though I think we can make an applicative version that doesn't care, like how sequenceA doesn't care [Maybe a] vs Maybe [a]

function Promise(){
 this.success = new Future();
 this.failure = new Future();
}
Promise.prototype.onSuccess = function(callback){
 this.success.listen(callback);
 return this;
};
Promise.prototype.onFailure = function(errback){
 this.failure.listen(errback);
 return this;
};
Promise.prototype.listen = function(callback, errback){
 if(errback)
  this.onFailure(errback);
 this.onSuccess(callback);
 return this;
};
Promise.prototype.keep = function(x){
 this.success.occur(x);
 this.onFailure(Future.never.occur.bind(Future.never));
 this.failure = Future.never;
 return this;
};
Promise.prototype["break"] = function(e){
 this.failure.occur(e);
 this.onSuccess(Future.never.occur.bind(Future.never));
 this.success = Future.never;
 return this;
};
Promise.prototype.fmap = function(f){
 var result = new Promise();
 result.success = this.success.fmap(f);
 result.failure = this.failure;
 return result;
};
Promise.prototype.pure = function(x){
 var result = new Promise();
 result.success = this.success.pure(x);
 result.failure = Future.never;
 return result;
};
Promise.prototype.join = function(){
 //a promise of a promise that yields a promise
 var result = new Promise();
 this.listen(
  function(p){
   if(p instanceof Pure) return result.keep(p.extract());
   p.listen(
    result.keep.bind(result),
    result["break"].bind(result)
   )
  },
  result["break"].bind(result)
 );
 return result;
};
Promise.prototype.applicate = Pure.prototype.applicate;


function List(arr, index){
 if(!index) index = 0;
 this.index = index;
 this.underlying = arr;
}
List.prototype.clone = function(){
 return {__proto__: this};
};
List.prototype.empty = function(){
 return this.index >= this.underlying.length;
};
List.prototype.car = function(){
 return this.underlying[this.index];
};
List.prototype.cdr = function(){
 var result = this.clone();
 result.index++;
 return result;
};
List.prototype.toArray = function(){
 var result = [];
 var accum = this;
 while(!accum.empty()){
  result.push(accum.car());
  accum = accum.cdr();
 }
 return result;
};
List.prototype.toString = function(){
 if(this.empty()) return "nil";
 var tail = this.cdr();
 if(!(tail instanceof List)) return "(" + this.car() +  " . " + this.cdr() + ")";
 return "(" + this.toArray().join(" ") + ")";
};
List.K = function K(x){return function(){return x;};};
List.cons = function(head, tail){
 var result = new List();
 result.car = List.K(head);
 result.cdr = List.K(tail);
 result.empty = List.K(false);
 return result;
};
List.prototype.fmap = function(f, memoize){
 var result = this.clone();
 result.car = function(){
  var memo = f(this.car());
  if(memoize)
   result.car = List.K(memo);
  return memo;
 }.bind(this);
 result.cdr = function(){
  return this.cdr().fmap(f, memoize);
 }.bind(this);
 return result;
};
List.nil = new List([]);
List.nil.empty = List.K(true);
List.pure = function(x){
 return List.cons(x, List.nil)
}
List.prototype.pure = List.pure;
List.prototype.applicate = Pure.prototype.applicate;
List.prototype.join = function(){
 if(this.empty()) return List.nil;
 var head = this.car();
 if(head.empty()) return this.cdr().join();
 var result = new List([]);
 result.car = function(){
  if(head.empty()) return this.cdr().join().car();
  return head.car();
 }.bind(this);
 result.cdr = function(){
  var tail = this.cdr();
  if(tail.empty()) return head.cdr();
  return List.cons(head.cdr(), tail).join();
 }.bind(this);
 result.empty = function(){
  if(this.empty()) return true;
  if(!head.empty()) return false;
  return this.cdr.join().empty();
 }.bind(this);
 return result;
};
// TODO: seq

this.Promise = Promise;
this.List = List;
