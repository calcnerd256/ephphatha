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
var processNanny = require("./processNanny");

function init(){

 processNanny.init.call(this);

 "apiState prefixState once publicStaticHtml".split(" ").map(
  function(k){
   if(!(k in this))
    this[k] = {};
  }.bind(this)
 );

 this.createForm(
  "/admin/dumbWrite/",
  "path expr".split(" ").map(function(name){return new TextAreaField(name);}),
  function handleWrite(ob){
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
  },
  {that: this}
 );

 this.createForm(
  "/admin/eval/",
  [
   new TextAreaField("expr")
  ],
  function process(ob){
   var i = this.that.storeExecString(ob.expr)[0];
   return {
    ID: +i,
    toHtml: function(){return "stored in " + i + " and exec'd";}
   };
  },
  {
   that: this,
   public: false
  }
 );

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
    function firstMatch(d, p){
     for(var k in d)
      if(p.substring(0, k.length) == k)
       return k;
    }
    var u = require("url").parse(req.url).pathname;
    var prefix = firstMatch(this.prefixState, u);
    return this.prefixState[prefix].call(
     this,
     req,
     res,
     u.substring(prefix.length)
    );
   }.bind(this)
  )
 );

 var sanitizeHtml = processNanny.sanitizeHtml;

 this.createForm(
  "/admin/fs/overwrite/",
  [
   new FormField("path"),
   new TextAreaField("contents")
  ],
  function process(ob){
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
  }
 );

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


 // new idea: objects with a .toForm() and a .getChildren() iterator?
 // the goal being to make state objects that represent the resource path structure
 // bonus if those methods are homoiconic so that I can persist them better
 // bonus if they're composed of the history of their modifications
 // bonus if modifications are idempotent and commutative

 // maybe before we do that, we should start with a way to browse the server object as an admin

 (
  //TODO: eviscerate this function
  function(){
 // start at the root, click on a hyperlink, and dig into the server object one key at a time
 // at any time, eval a string into a given key at the local dictionary

function listToHashSet(ks){
  var r = {};
  ks.map(function(k){r[k] = k;});
  return r;
}
var chardec = {
 encode: function encode(str, from, to, noTest){
  var result = str.split(from).join(this.escape + to);
  if(!noTest)
   if(this.decode(result, from, to, !noTest) != str)
    throw new Error(
     ["codec failure", this, "encode", str, "expected inversion to hold", [from, to]]
    );
  return result;
 },
 decode: function decode(str, from, to, noTest){
  var result = str.split(this.escape + to).join(from);
  if(!noTest)
   if(this.encode(result, from, to, !noTest) != str)
    throw new Error(
     ["codec failure", this, "decode", str, "expected inversion to hold", [from, to]]
    );
  return result;
 },
 escape: "_escape_e"
};

var codec = {
 encode: function encode(str, noTest){
  var result = chardec.encode(
   chardec.encode(
    chardec.encode(str, "_escape_", "sc"),
    "/", "s"
   ),
   "..", "d"
  );
  if("" == str) result = chardec.escape + "l";
  if(!noTest)
   if(this.decode(result, !noTest)[0] != str)
    throw ["codec failure", this, "encode", str, "expected inversion to hold"];
  return result;
 },
 decode: function decode(str, noTest){
  var result = str.split("/").map(
   function(s){
    if(chardec.escape + "l" == s) return "";
    return chardec.decode(
     chardec.decode(
      chardec.decode(s, "..", "d"),
      "/", "s"
     ),
     "_escape_", "sc"
    );
   }
  );
  if("" == str) result = [];
  if(!noTest)
   if(result.map(this.encode.bind(this)).join("/") != str)
    throw ["codec failure", this, "decode", str, "expected inversion to hold", [], result];
  return result;
 }
}

var processNanny = require("./processNanny");
// var cleanMultiline = processNanny.removeUpToOneTrailingCarriageReturn;
 var sanitizeHtml = processNanny.sanitizeHtml;

function descend_into(it, path){
 for(var i = 0; i < path.length; i++){
  var part = path[i];
  if(!it) return it;
  if(
   !(
    typeof it
    in
    listToHashSet("object function".split(" "))
   )
  )
   return it;
  it = it[part];
 }
 return it;
}

function respond(req, res, u){
 var p = u.split("/");
 var maybe_path = "";
 if(p.length)
  maybe_path = p[p.length - 1];
 if("" == maybe_path)
  p.pop();
 else
  maybe_path += "/";
 var path = codec.decode(p.join("/"));
 var it = descend_into(this, path);
 res.setHeader("Content-Type", "text/html");
 if(!(typeof it in listToHashSet("object function".split(" "))))
  return res.end("<a href=\"..\">up</a>\n<br />\n" + sanitizeHtml("" + it));
 return res.end(
  [
   "<ul>",
   " <li>(<a href=\"../\">up</a>)</li>",
   " " + Object.keys(it).map(
    function(str){
     return [
     "<li>",
     " <a href=\"" + maybe_path + codec.encode(str) + "/\">",
     "  " + sanitizeHtml(str),
     " </a>",
     "</li>"
     ].join("\n ");
    }
   ).join("\n "),
   "</ul>",
   ("toHtml" in it ? it.toHtml() : sanitizeHtml(""+it))
  ].join("\n")
 );
}

this.prefixState["/admin/introspect/"] = respond;

  }
 ).call(this);

}

this.init = init;
