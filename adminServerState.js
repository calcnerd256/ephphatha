var formController = require("./formController");
 var FormField = formController.FormField;
 var SimpleFormController = formController.SimpleFormController;
 var TextAreaField = formController.TextAreaField;
 var tagShorthand = formController.tagShorthand;
var routers = require("./routers");
 var router = routers.router;
 var Router = router.Router;
 var UrlMatcher = router.UrlMatcher;

function init(){

 if(!("apiState" in this)) this.apiState = {};
 if(!("prefixState" in this)) this.prefixState = {};
 if(!("once" in this)) this.once = {};
 if(!("publicStaticHtml" in this)) this.publicStaticHtml = {};

 function dumbWriteForm(form){
  ["path", "expr"].map(
   function(name){return new TextAreaField(name);}
  ).map(
   function(field){
    return form.fields.push(field);
   }
  );
  form.that = this;
  form.process = function(ob){
   var path = ob.path.split("\n").map(
    function(s){
     //trim only one trailing "\r" character
     if(!s.length) return s;
     if("\r" != s[s.length - 1]) return s;
     return s.substring(0, s.length - 1);
    }
   );
   var str = [
    "this.storeAt(",
    " " +
     JSON.stringify(path) +
     ",",
    " [",
    "  " +
     ob.expr.split("\n").map(
      function(s){return JSON.stringify(s);}
     ).join(",\n  "),
    " ].join(\"\\n\")",
    ")"
   ].join("\n");
   var i = this.that.storeExecString(str)[0];
   return {
    ID: +i,
    toHtml: function toHtml(){
     return "stored in " + i + " and eval'd storage";
    }
   };
  };
  return form;
 }

 this.apiState["/admin/dumbWrite/"] = dumbWriteForm.call(this, new SimpleFormController());

 this.apiState["/admin/eval/"] = (
  function buildEvalForm(form){
   form.fields.push(
    (
     function buildTextareaField(field){
      field.toHtml = function toHtml(){
       return "<textarea name=\"" + this.name + "\"></textarea>";
      }
      return field;
     }.bind(this)
    )(new FormField("expr"))
   );
   var that = this;
   form.that = this;
   form.process = function process(ob){
    var i = this.that.storeExecString(ob.expr)[0];
    return {
     ID: +i,
     toHtml: function(){return "stored in " + i + " and exec'd";}
    };
   };
   form.public = false;
   return form;
  }.bind(this)
 )(new SimpleFormController());

 function handleBrowse(req, res, u){
  var fs = require("fs");
  var p = "/" + u;
  function streamDir(path, res){//not actually streaming
   res.setHeader("Content-Type", "text/html");
   return fs.readdir(
    path,
    function(err, files){
     //ignoring errors
     return res.end(
      "<ul>\n" +
       files.map(
        function(fn){
         var stats = {isDirectory: function(){return false;}};
         try{
          var stats = fs.statSync(path + fn);
         }
         catch(e){
         }
         return "<li>" +
          "<a href=\"" +
          fn +
          (stats.isDirectory() ? "/" : "") +
          "\">" +
          fn +
          "</a>" +
          "</li>";
        }
       ).join("\n") +
       "\n</ul>"
     );
    }
   );
  }
  function streamTextFile(path, res){//misnamed
   return fs.readFile(
    path,
    function(err, data){
     //ignoring errors for now
     res.setHeader("Content-Type", "text/plain");
     res.end(data);
    }
   );
  }
  fs.stat(
   p,
   function(err, stats){
    if(err)
     return (
      function(s){
       s.statusCode = 404;
       return s.end("stat error");
      }
     )(res);
    if(stats.isDirectory()) return streamDir(p, res);
    if(stats.isFile()) return streamTextFile(p, res);
    s.statusCode = 404;
    return s.end("ignoring atypical files for now");
   }
  );
 }

 this.prefixState["/admin/fs/browse/"] = this.adminOnly(handleBrowse);

 this.servers.https.routeListRouter.pushRoute(
  new Router(
   new UrlMatcher(
    function(u){
     return Object.keys(this.prefixState).some(
      function(k){return u.substring(0, k.length) == k;}
     );
    }.bind(this)
   ),
   function(req, res){
    var u = require("url").parse(req.url).pathname;
    var ob = {};
    var prefix = ob;
    for(var k in this.prefixState)
     if(prefix === ob && u.substring(0, k.length) == k)
      prefix = k;
    return this.prefixState[prefix].call(
     this,
     req,
     res,
     u.substring(k.length)
    );
   }.bind(this)
  )
 );

 this.apiState["/admin/fs/overwrite/"] = (
  function(form){
   form.fields.push(new FormField("path"));
   form.fields.push(new TextAreaField("contents"));
   form.process = function(ob){
    //ugh, this is synchronous
    //might as well rube it up
    require("fs").writeFileSync(ob.path, ob.contents);
    return {
     toHtml: function(){
      return "seems to have worked, maybe" +
       " <a href=\"/admin/fs/browse/" +
       ob.path.substring(1).split("/").map(encodeURIComponent).join("/") +
       "\">here</a>";
     }
    }
   };
   return form;
  }
 )(new SimpleFormController());

 this.publicStaticHtml["/admin/dashboard.html"] = (
  function(readFile, writeFile, init){
   var jqueryUrl = [
    "//ajax.googleapis.com",
    "ajax",
    "libs",
    "jquery",
    "1.9.1",
    "jquery.min.js"
   ].join("/");// TODO: serve this locally

   var fns = [
    readFile,
    writeFile,
    init
   ].join("\n").split(
    "\n  "
   ).join("\n");

   return tagShorthand(
    tagShorthand,
    [
     "html", {},
     [
      "head", {},
      ["title", {}, "rTODO"],
      ["script,x", {src: jqueryUrl}],
      ["script", {}, "r" + fns, "r$(init);", "r"]
     ],
     [
      "body", {},
      ["input", {id: "path"}],
      ["textarea,x", {id: "box"}],
      ["input", {id: "load", value: "load", type: "button"}],
      ["input", {id: "save", value: "save", type: "button"}]
     ]
    ]
   ).toString() + "\n";
  }
 )(
  function readFile(p, callback){
   return $.get(
    "/admin/fs/browse/" + p.substring(1),
    function(s){return callback(s);}
   );
  },
  function writeFile(p, contents, callback){
   return $.post(
    "/admin/fs/overwrite/",
    {path: p, contents: contents},
    function(h){return callback(h);}
   );
  },
  function init(){
   $("#load").click(
    function(){
     return readFile(
      $("#path")[0].value,
      function(s){
       $("#box")[0].value = s;
      }
     );
    }
   );
   $("#save").click(
    function(){
     return writeFile(
      $("#path")[0].value,
      $("#box")[0].value,
      function(s){}
     );
    }
   );
  }
 );

function g(h){
 var quine = h+"\ng.bind(this)(g);\n//quine\n";
 this.stringManager.strings = [quine, "this.replaceDir();"];
 this.loadStrings();
}
g.bind(this)(g);
//quine



}

this.init = init;