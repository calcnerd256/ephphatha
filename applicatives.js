//applicative monads
// Pure
// Function_ // it's like a function; maybe I should curry it instead?
// Future
// Promise
// List // not implemented yet

 function Pure(x){
  this.value = x;
 }
 Pure.prototype.fmap = function(f){return new Pure(f(this.value));};
 Pure.prototype.pure = function(x){return new Pure(x);};
 Pure.prototype.flatten = function(){return this.value;};
 Pure.prototype.applicate = function applicate(p){
  // this turns out to be a law or something
  // the "this" object is expected to contain a function that it gives to whoever fmaps over it
  var catamorphism = p.fmap.bind(p); // constructs the other functor from a function
  var nested = this.fmap(catamorphism);
  return nested.flatten();
 };

 function Function_(f){
  this.value = f;
 }
 Function_.prototype.apply = function(args){
  return this.value.apply(this, args);
 }
 Function_.prototype.fmap = function(f){
  return new Function(function(){return f(this.apply(arguments));}.bind(this));
 };
 Function_.prototype.pure = function(x){
  return new Function(function(){return x;});
 }
 // applicate looks like f <*> g = S f g = \ x . f x (g x)
 // X <*> Y = flatten (fmap (\ f . fmap f Y) X)
 // S f g = join (B (\ x . B x g) f)
 //  f x (g x) = join (\ y z . f y (g z)) x
 // join h x = h x x
 // f x (g x) = join (\ y z . f y (g z)) x
 Function_.prototype.flatten = function(){
  return new Function_(
   function(){
    var partial = this.apply(arguments);
    if(partial instanceof Pure) return partial.value;
    return partial.apply(arguments);
   }.bind(this)
  );
 }
 Function_.prototype.applicate = Pure.prototype.applicate;
 Function_.prototype.applicate = function(g){
  if(g instanceof Pure) return function(){return this.apply(arguments)(g.value);}.bind(this);
  return function(){return this.apply(arguments)(g.apply(arguments))}.bind(this);
 }


 function Future(){
  this.listeners = [];
  this.done = false;
 }
 Future.prototype.listen = function(callback){
  if(this.done) return callback(this.value);
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
 Future.prototype.flatten = function(){
  var result = new Future();
  this.listen(
   function(p){
    if(p instanceof Pure) return result.occur(p.value);
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
 Future.never.flatten = Future.never.fmap;
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
 Promise.prototype.flatten = function(){
  //a promise of a promise that yields a promise
  var result = new Promise();
  this.listen(
   function(p){
    if(p instanceof Pure) return result.keep(p.value);
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

this.Promise = Promise;