var util = require("util");
var formStream = require("form_stream");
 var FormStream = formStream.FormStream;
var routers = require("./routers");
 var router = routers.router;
 var MethodRoutingResponder = router.MethodRoutingResponder;


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


//interface: "HTML-able"
//an HTML-able has a .toHtml() that returns a string
//interface: "okay"
//it's like a poor-man's error code, I guess
//an okay has a boolean field .ok
//an okay has an HTTP status code if its .ok is false
//interface: "form"
//a form is HTML-able
//a form has a method .populate(request, popback) that passes an object to the callback
//a form has a method .validate(object) that checks to see if the populated object meets the requirements of the form
// form.validate() returns an okay
//a form has a boolean "public" for letting non-admins use it
//a form has a method .process(object) that saves valid objects or otherwise acts upon them and returns an HTML-able
// TODO redesign all the above
function formToResponder(form){
 var result = function handleForm(req, res){
  var responder = new MethodRoutingResponder(
   {
    "GET": function(q, s){
     s.setHeader("Content-Type", "text/html");
     s.end(form.toHtml());
    },
    "POST": function(q, s){
     var promise = form.populate(
      q,
      function(ob){
       var ok = form.validate(ob);//TODO: CPS
       if(ok.ok){
        s.setHeader("Content-Type", "text/html");
        var result = form.process(ob);
        return s.end(result.toHtml());
       }
       s.statusCode = ok.status;
       return s.end(""+ok);
      }
     );
     return promise;
    }
   }
  );
  if(!form["public"]){
   responder = (
    "adminOnly" in this &&
    (
     "function" == typeof this.adminOnly ||
      "object" == typeof this.adminOnly
    ) &&
    "bind" in this.adminOnly &&
    "function" == typeof this.adminOnly.bind
   ) ?
    this.adminOnly.bind(this)(responder) :
    function(q,s){
     s.statusCode = 500;
     s.end("nonpublic form but failed to restrict it correctly; erring on the side of caution");
    };
  }
  responder.form = form; // love
  return responder.call(this, req, res);
 }.bind(this);
 result.form = form;
 return result;
}


function tagToXml(t, kids, atrs, expand, noindent){
 var oneLiner = false;
 var kidMemo = kids.map(function(x){return "" + x;});
 if(!kids)
  oneLiner = true;
 else
  if(!kids.length)
   oneLiner = true;
  else
   if(kids.length < 2)
    if(kidMemo[0].split("\n").length <= 2)
     oneLiner = ("<" != kidMemo[0][0]);

 var closeTag = "</" + t + ">";
 var indentation = noindent ? "" : " ";
 var atrstr = (
  atrs && Object.keys(atrs).length ?
  " " + (
   function(d){
    return Object.keys(d).map(
     function(k){return [k, d[k]];}
    );
   }
  )(atrs).map(
   function(atr){
    return atr[0] +
     "=\"" +
     atr[1].split("\"").join("&quot;") +
     "\"";
   }
  ).join(" ") :
  ""
 );
 return "<" + t +
  atrstr +
  (
   (kids && kids.length) || expand ?
   ">" +
   (oneLiner ? "" : ("\n" + indentation)) +
    kidMemo.join("\n").split("\n").join(
     "\n" + indentation
    ) +
    (oneLiner ? "" : "\n") +
    closeTag :
   " />"
  );
}
var tagToString = function(){
 if("tag" == this.type)
  return tagToXml(
   this.tag,
   this.children,
   this.attributes,
   this.expand
  );
 if("raw" == this.type)
  return "" + this.raw;
}
function tagShorthand(f, x){
 var children = [];
 var tag = x[0];//what if x is empty? error
 if(!x.length) return {type: "raw", raw: "", toString: tagToString};
 if("string" != typeof x[0])
  return x[0];//assume only one element
 var attributes = {};
 if("string" == typeof x){
  tag = x.substring(1);
  if("r" == x.charAt(0))
   return {type: "raw", raw: tag, toString: tagToString};
 }
 else
  if(x.length > 1){
   attributes = x[1];
   if(x.length > 2)
    for(var i = 2; i < x.length; i++)
     children.push(f(f, x[i]));
  }
 var components = tag.split(",");//.map(function(s){return s.})
 var result = {
  type: "tag",
  tag: components[0],
  children: children,
  attributes: attributes,
  expand: components[1] == "x",
  toString: tagToString
 };
 return result;
};




this.FormField = FormField;
this.TextAreaField = TextAreaField;
this.SimpleFormController = SimpleFormController;
this.formToResponder = formToResponder;

this.tagShorthand = tagShorthand;
