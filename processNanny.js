var formController = require("./formController");
 var FormField = formController.FormField;
 var SimpleFormController = formController.SimpleFormController;
 var TextAreaField = formController.TextAreaField;
var child_process = require("child_process");

var processNanny = this;

function createForm(path, fields, process, patch, cls){
 if(!("apiState" in this))
  this.apiState = {};

 if(!cls) cls = SimpleFormController;
 if(!patch) patch = {};
 var form = new cls();
 fields.map(function(field){form.fields.push(field);});
 form.process = process;
 for(var k in patch)
  form[k] = patch[k];
 this.apiState[path] = form;
 return form;
}

function removeUpToOneTrailingCarriageReturn(s){
 if(!s.length) return s;
 if("\r" != s[s.length - 1]) return s;
 return s.substring(0, s.length - 1);
}

function sanitizeHtml(str){
 return str.split(
  "&"
 ).join("&amp;").split(
  "<"
 ).join("&lt;").split(
  "\n"
 ).join("<br />");
}

function ProcessCradle(command, args, options){
 this.kid = child_process.spawn(command, args, options);
 this.opticon = [];
 this.kid.stdout.on("data", this.opticon.push.bind(this.opticon));
 this.kid.stderr.on("data", this.opticon.push.bind(this.opticon));
 this.cmd = command;
 this["arguments"] = args;
 this.killed = false;
 this.kid.on("exit", function(){this.killed = true;}.bind(this));
}
ProcessCradle.prototype.sanitizeOutput = sanitizeHtml;
ProcessCradle.prototype.kill = function kill(){
 this.kid.kill();
};

function helicopterMom(command, args, options){
 var cradle = new ProcessCradle(command, args, options);
 this.childProcesses.push(cradle);
 return this.childProcesses.length - 1;
}

function renderKidList(){
 return [
  "<ul>",
  "<li>",
  this.that.childProcesses.map(
   function(cradle, i){
    if(!cradle) return;
    return i + " " + sanitizeHtml(
     [
      cradle.kid,
      cradle.opticon,
      [cradle.cmd, cradle["arguments"]],
      cradle
     ].join("\n")
    )
   }
  ).filter(
   function I(x){return x;}
  ).join("</li>\n<li>\n"),
  "</li>",
  "</ul>"
 ].join("\n")
}

function handleKill(ob){
 var i = ob.index;
 var kids = this.that.childProcesses;
 if(!(i in kids))
  return {
   toHtml: function(){
    return "index " + i + " out of bounds (TODO: make this an error)";
   }
  };
 var cradle = kids[i];
 if(!cradle.killed)
  cradle.kid.kill();
 delete kids[i]
 // print proc's stdio
 return {
  toHtml: function(){
   return this.sanitize(this.opticon);
  },
  sanitize: sanitizeHtml,
  opticon: cradle.opticon.join("")
 }
}

function handleSpawn(ob){
 var cmd = ob.cmd;
 var args = ob.args;
 var i = processNanny.helicopterMom.call(
  this.that,
  cmd,
  (
   args ? args.split("\n") : []
  ).map(processNanny.removeUpToOneTrailingCarriageReturn)
 );
 return {
  toHtml: function(){
   return "child process at index " + i;
  }
 };
}

function init(){

 this.createForm = createForm;

 if(!this.childProcesses)
  this.childProcesses = [];
 this.helicopterMom = helicopterMom;

 var kidList = {
  toHtml: renderKidList,
  that: this
 };

 var spawnUrl = "/admin/spawn/";
 var listUrl = "/admin/child/";
 var killUrl = "/admin/child/kill/";
 function getLink(href, content){
  if(!content) content = href;//lol inject
  return {
   toHtml: function(){return "<a href=\"" + this.href + "\">" + this.content + "</a>";},
   href: href,
   content: content
  }
 }

 this.createForm(
  listUrl,
  [
   getLink(spawnUrl, "spawn"),
   getLink(killUrl, "kill"),
   kidList
  ],
  function(){return {toHtml: function(){return "nothing to see here";}};},
  {}
 )

 this.createForm(
  killUrl,
  [
   new FormField("index")//TODO: dropdown of PID, cmdline (truncated?)
  ],
  handleKill,
  {that:this}
 );

 this.createForm(
  spawnUrl,
  [
   new FormField("cmd"),
   new TextAreaField("args")
  ],
  handleSpawn,
  {that: this}
 );

}

this.createForm = createForm;
this.removeUpToOneTrailingCarriageReturn = removeUpToOneTrailingCarriageReturn;
this.sanitizeHtml = sanitizeHtml;
this.ProcessCradle = ProcessCradle;
this.helicopterMom = helicopterMom;
this.renderKidList = renderKidList;
this.handleKill = handleKill;
this.handleSpawn = handleSpawn;
this.init = init;