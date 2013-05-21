var formController = require("./formController");
 var FormField = formController.FormField;
 var SimpleFormController = formController.SimpleFormController;
 var TextAreaField = formController.TextAreaField;


function init(){

 if(!("apiState" in this)) this.apiState = {};

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

 if(!("prefixState" in this)) this.prefixState = {};

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

this.storeAt(
 ["once","0"],
 [
  "this.servers.https.routeListRouter.pushRoute(\r",
  " new Router(\r",
  "  new UrlMatcher(\r",
  "   function(u){\r",
  "    return Object.keys(this.prefixState).some(\r",
  "     function(k){return u.substring(0, k.length) == k;}\r",
  "    );\r",
  "   }.bind(this)\r",
  "  ),\r",
  "  function(req, res){\r",
  "   var u = require(\"url\").parse(req.url).pathname;\r",
  "   var ob = {};\r",
  "   var prefix = ob;\r",
  "   for(var k in this.prefixState)\r",
  "    if(prefix === ob && u.substring(0, k.length) == k)\r",
  "     prefix = k;\r",
  "   return this.prefixState[prefix].call(\r",
  "    this,\r",
  "    req,\r",
  "    res,\r",
  "    u.substring(k.length)\r",
  "   );\r",
  "  }.bind(this)\r",
  " )\r",
  ");"
 ].join("\n")
);


this.storeAt(
 ["apiState","/admin/fs/overwrite/"],
 [
  "(\r",
  " function(form){\r",
  "  form.fields.push(new FormField(\"path\"));\r",
  "  form.fields.push(new TextAreaField(\"contents\"));\r",
  "  form.process = function(ob){\r",
  "   //ugh, this is synchronous\r",
  "   //might as well rube it up\r",
  "   require(\"fs\").writeFileSync(ob.path, ob.contents);\r",
  "   return {\r",
  "    toHtml: function(){\r",
  "     return \"seems to have worked, maybe\" +\r",
  "      \" <a href=\\\"/admin/fs/browse/\" +\r",
  "      ob.path.substring(1).split(\"/\").map(encodeURIComponent).join(\"/\") +\r",
  "      \"\\\">here</a>\";\r",
  "    }\r",
  "   }\r",
  "  };\r",
  "  return form;\r",
  " }\r",
  ")(new SimpleFormController())"
 ].join("\n")
);


this.storeAt(
 ["publicStaticHtml","/admin/dashboard.html"],
 [
  "(\r",
  " function(h){\r",
  "  var jqueryUrl = [\r",
  "   \"//ajax.googleapis.com\",\r",
  "   \"ajax\",\r",
  "   \"libs\",\r",
  "   \"jquery\",\r",
  "   \"1.9.1\",\r",
  "   \"jquery.min.js\"\r",
  "  ].join(\"/\");// TODO: serve this locally\r",
  "  function readFile(p, callback){\r",
  "   return $.get(\r",
  "    \"/admin/fs/browse/\" + p.substring(1),\r",
  "    function(s){return callback(s);}\r",
  "   );\r",
  "  }\r",
  "  function writeFile(p, contents, callback){\r",
  "   return $.post(\r",
  "    \"/admin/fs/overwrite/\",\r",
  "    {path: p, contents: contents},\r",
  "    function(h){return callback(h);}\r",
  "   );\r",
  "  }\r",
  "  function init(){\r",
  "   $(\"#load\").click(\r",
  "    function(){\r",
  "     return readFile($(\"#path\")[0].value, function(s){$(\"#box\")[0].value = s;});\r",
  "    }\r",
  "   );\r",
  "   $(\"#save\").click(\r",
  "    function(){\r",
  "     return writeFile($(\"#path\")[0].value, $(\"#box\")[0].value, function(s){});\r",
  "    }\r",
  "   );\r",
  "  }\r",
  "  return [\r",
  "   h(\"html\",[\r",
  "    h(\"head\", [\r",
  "     h(\"title\", [\"TODO\"]),\r",
  "     h(\"script\", [], {src: jqueryUrl}, true),\r",
  "     h(\"script\", [\r",
  "      readFile,\r",
  "      writeFile,\r",
  "      init,\r",
  "      \"$(init);\",\r",
  "      \"\"\r",
  "     ])\r",
  "    ]),\r",
  "    h(\"body\", [\r",
  "     h(\"input\", [], {id: \"path\"}),\r",
  "     h(\"textarea\", [], {id: \"box\"}, true),\r",
  "     h(\"input\", [], {id: \"load\", value: \"load\", type: \"button\"}),\r",
  "     h(\"input\", [], {id: \"save\", value: \"save\", type: \"button\"})\r",
  "    ])\r",
  "   ]),\r",
  "   \"\"\r",
  "  ].join(\"\\n\");\r",
  " }\r",
  ")(\r",
  " function(t, kids, atrs, expand, noindent){\r",
  "  var oneLiner = !(\r",
  "   kids && kids.length &&\r",
  "   (\r",
  "    kids.length > 1 ||\r",
  "    kids[0].split(\"\\n\").length > 1 ||\r",
  "    \"<\" == kids[0][0]\r",
  "   )\r",
  "  );\r",
  "  return \"<\" + t +\r",
  "   (\r",
  "    atrs ?\r",
  "    \" \" + (\r",
  "     function(d){\r",
  "      return Object.keys(d).map(\r",
  "       function(k){return [k, d[k]];}\r",
  "      );\r",
  "     }\r",
  "    )(atrs).map(\r",
  "     function(atr){\r",
  "      return atr[0] +\r",
  "       \"=\\\"\" +\r",
  "       atr[1].split(\"\\\"\").join(\"&quot;\") +\r",
  "       \"\\\"\";\r",
  "     }\r",
  "    ).join(\" \") :\r",
  "    \"\"\r",
  "   ) +\r",
  "   (\r",
  "    (kids && kids.length) || expand ?\r",
  "    \">\" +\r",
  "    (oneLiner ? \"\" : (\"\\n\" + (noindent ? \"\" : \" \"))) +\r",
  "     kids.join(\"\\n\").split(\"\\n\").join(\r",
  "      \"\\n\" + (noindent ? \"\" : \" \")\r",
  "     ) +\r",
  "     (oneLiner ? \"\" : \"\\n\") +\r",
  "     \"</\" + t :\r",
  "    \"/\"\r",
  "   ) +\r",
  "   \">\";\r",
  " }\r",
  ")"
 ].join("\n")
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