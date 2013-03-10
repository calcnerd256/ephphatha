var util = require("util");
var formStream = require("form_stream");
 var FormStream = formStream.FormStream;

function FormField(name){
 this.name = name;
}
FormField.prototype.toHtml = function(){
 return "<input name=\"" +
  this.name + //TODO: escape
  "\"></input>";
};
FormField.prototype.populate = function(stream, that, callback){
 var key = this.name;
 formStream.bufferChunks(
  stream,
  function(str){
   that[key] = str;
   return callback(key);
  }
 );
}
FormField.prototype.validate = function(that){return true;}


function TextAreaField(){
 FormField.apply(this, arguments);
}
util.inherits(TextAreaField, FormField);
TextAreaField.prototype.toHtml = function toHtml(){
 return "<textarea name=\"" +
  this.name + //TODO escape name
  "\"></textarea>"; // TODO support initial value
}


function SimpleFormController(){
 //TODO: populate fields and override process
 this.fields = [];
}
SimpleFormController.prototype["public"] = false;
SimpleFormController.prototype.getFields = function getFields(){
 return this.fields;
}
SimpleFormController.prototype.toHtml = function(){
 //interface: "HTML-able"
 //an HTML-able has a .toHtml() that returns a string
 //a form is HTML-able
 return "<form method=POST>\n " +
  this.getFields().map(
   function(field){
    return field.toHtml();
   }
  ).join("\n ") +
  "\n <input type=submit></input>\n</form>";
};
SimpleFormController.prototype.populate = function(req, cb){
 //this.fields is a list of implementations of the field interface
 //a field has a name
 //a form has a method .populate(request) that passes an object to the callback
 var stream = new FormStream(req);
 var fields = this.getFields();
 var count = fields.length;
 var result = {};
 //do not put fields with names like "toString" on a non-admin form
 fields.map(
  function(field){
   stream.on(
    "s_" + field.name,
    function(s){
     //TODO: let the field do this
     //return field.populate(s.resume(), result, function(){/*TODO: validate*/ /*call me once*/if(!--count)return cb(result)});
     formStream.bufferChunks(
      s,
      function(str){
       result[field.name] = str;
      }
     ).resume();
    }
   );
  }
 );
 return stream.on("end", function(){return cb(result);});//simpler for now
 //note: I'm supposed to return a promise, but instead I'm returning whatever resume() does
};
SimpleFormController.prototype.validate = function validate(ob){
 //a form has a method .validate(object) that checks to see if the populated object meets the requirements of the form
 // form.validate() returns an okay
 return {
  //interface: "okay"
  //it's like a poor-man's error code, I guess
  //an okay has a boolean field .ok
  ok: true,
  //an okay has an HTTP status code if its .ok is false
  status: 200,
  toString: function(){return "ok";}
 };
};
SimpleFormController.prototype.process = function process(ob){
 //a form has a method .process(object) that saves valid objects or otherwise acts upon them and returns an HTML-able
 console.log(ob);
 return {
  toHtml: function(){return "got it";}
 };
};



this.FormField = FormField;
this.TextAreaField = TextAreaField;
this.SimpleFormController = SimpleFormController;