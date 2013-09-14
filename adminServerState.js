var formController = require("./formController");
 var FormField = formController.FormField;
 var SimpleFormController = formController.SimpleFormController;
 var TextAreaField = formController.TextAreaField;
 var tagShorthand = formController.tagShorthand;
var routers = require("./routers");
 var router = routers.router;
 var Router = router.Router;
 var UrlMatcher = router.UrlMatcher;
var child_process = require("child_process");

function init(){

 "apiState prefixState once publicStaticHtml".split(" ").map(
  function(k){
   if(!(k in this))
    this[k] = {};
  }.bind(this)
 );

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
    function removeUpToOneTrailingCarriageReturn(s){
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
     return "stored in " + this.ID + " and eval'd storage";
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

 this.createForm = function(path, fields, process, patch, cls){
  if(!cls) cls = SimpleFormController;
  var form = new cls();
  fields.map(function(field){form.fields.push(field);});
  form.process = process;
  for(var k in patch)
   form[k] = patch[k];
  this.apiState[path] = form;
  return form;
 }

 this.createForm(
  "/admin/loltest/",
  [
   new FormField("whatevz")
  ],
  function process(ob){
   //how did this work again?
   return {
    toHtml: function(){
     return "testing, lol";
    }
   };
  },
  {public: "sure"}
 );

 function sanitizeHtml(str){
  return str.split(
   "&"
  ).join("&amp;").split(
   "<"
  ).join("&lt;").split(
   "\n"
  ).join("<br />");
 }

 this.childProcesses = [];
 this.helicopterMom = function helicopterMom(command, args, options){
  var kid = require("child_process").spawn(command, args, options);
  var opticon = [];//the buffer
  kid.stdout.on("data", function(chunk){opticon.push(chunk);});
  kid.stderr.on("data", function(chunk){opticon.push(chunk);});
  var choppa = [
   kid,
   opticon,
   [command, args],
   {
    kid: kid,
    opticon: opticon,
    cmd: command,
    "arguments": args,
    "sanitizeOutput": sanitizeHtml
   }
  ];
  this.childProcesses.push(choppa);
  return this.childProcesses.length - 1;
 };

 this.createForm(
  "/admin/child/kill/",
  [
   new FormField("index"),//TODO: dropdown of PID, cmdline (truncated?)
   {
    toHtml: function(){
     return [
      "<ul>",
      "<li>",
      this.that.childProcesses.map(
       function(choppa, i){
        return i + " " + choppa[3].sanitizeOutput(choppa.join("\n"))
       }
      ).join("</li>\n<li>\n"),
      "</li>",
      "</ul>"
     ].join("\n")
    },
    that: this
   }
  ],
  function processIt(ob){
   //something is wrong. Is this getting called multiple times?
   var i = ob.index;
   var kids = this.that.childProcesses;
   if(!(i in kids))
    return {
     toHtml: function(){return "index " + i + " out of bounds (TODO: make this an error)";}
    };
   var choppa = kids[i];
   // kill proc
   // delete proc
   choppa[0].kill();
   delete kids[i]
   // print proc's stdio
   return {
    toHtml: function(){
     return this.sanitize(this.opticon);
    },
    sanitize: choppa[3].sanitizeOutput,
    opticon: choppa[1].join("")
   }
  },
  {that:this}
 )

 this.createForm(
  "/admin/spawn/",
  [
   new FormField("cmd"),
   new TextAreaField("args"),
   {
    toHtml: function(){
     return this.that.childProcesses.map(
      function(trip){
       var kid = trip[0];
       return [
        kid.pid,
        trip[2],
        trip[1].join("").split(
         "&"
        ).join("&amp;").split(
         "<"
        ).join("&lt;").split(
         "\n"
        ).join("<br />")
       ].join(" ");
      }
     ).join("<br />");
    },
    that: this
   }
  ],
  function process_it(ob){
   var cmd = ob.cmd;
   var args = ob.args;
   var i = this.that.helicopterMom(
    cmd,
    args ?
     args.split("\n").map(
      function removeUpToOneTrailingCarriageReturn(s){
       if(!s.length) return s;
       if("\r" != s[s.length - 1]) return s;
       return s.substring(0, s.length - 1);
      }
     ) : []
   );
   return {
    toHtml: function(){
     return "child process at index " + i;
    }
   };
  },
  {that: this}
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
      ["title", {}, "rEdit File"],
      ["script,x", {src: jqueryUrl}],
      ["script", {}, "r" + fns, "r$(init);", "r"]
     ],
     [
      "body", {},
      [
       "input",
       {
        id: "path",
        style: "width: 100%"
       }
      ],
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
     var path = $("#path")[0].value;
     return readFile(
      path,
      function(s){
       $("#box")[0].value = s;
       $("title").text(
        [
         "edit ",
         (
          function last(xs){return xs[xs.length - 1];}
         )(path.split("/")),
         "| editing file:",
         path
        ].join(" ")
       );
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

 this.createForm(
  "/admin/git/push/",
  [
   new TextAreaField("commit"),
   {
    toHtml: function(){
     this.proc = child_process.spawn("git", ["diff"]);
     var buffer = [""];
     this.proc.stdout.on("data", function(chunk){buffer.push(chunk);});
     this.proc.on("exit", function(){this.buffer = buffer;}.bind(this))
     return sanitizeHtml(this.buffer.join(""));
    },
    buffer: [""],
    proc: null
   }
  ],
  function process_it(ob){
   var message = ob.commit;
   var proc = child_process.spawn("git", ["commit", "-am", ob.commit]);
   var buf = [];
   var res = false;
   var done = false;
   function callback(s){
    s.end(sanitizeHtml(buf.join("")));
   }
   proc.stdout.on("data", function(chunk){buf.push(chunk);});
   proc.on(
    "exit",
    function(code, signal){
     if(code)
      done = true;
     if(done)
      return res ? callback(res) : done;
     var push = child_process.spawn("git", ["push"]);
     push.stdout.on("data", function(chunk){buf.push(chunk);})
     push.on("exit", function(){done = true; if(res) return callback(res);});
    }
   );
   return {
    promise: function(s){
     if(done) return callback(s);
     res = s;
    }
   }
  },
  {}
 );

 //indentation takes a backseat to quining below, sorry

function g(h){
 var quine = h+"\ng.bind(this)(g);\n//quine\n";
 this.stringManager.strings = [quine, "this.replaceDir();"];
 this.loadStrings();
}
g.bind(this)(g);
//quine

}

this.init = init;