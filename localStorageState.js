var __project_path = process.cwd() + "/";
this.__project_path = __project_path;

this.init = function(that){
 that.publicStaticHtml["/admin/dashboard/"] = (

{"toString": (function toString(){
  return this.toHtml(0) + "\n";
 }),
"toHtml": (function toHtml(indentation){
  var showScripts = false;
  if(arguments.length)
   showScripts = true;
  var space = "";
  while(indentation-- > 0)
   space += " "; // or "\t"
  var head = "";
  if("head" in this) head = this.head
  if("toHtml" in head) head = head.toHtml(indentation + 1, showScripts); // TODO: try/catch
  var body = "";
  if("body" in this) body = this.body;
  if("toHtml" in body) body = body.toHtml(indentation + 1); // TODO: try/catch
  return [
   "<html>",
   head,
   body,
   "</html>"
  ].join("\n" + space);
 }),
"head": {"toHtml": (function toHtml(indentation, showScripts){
  var space = "";
  while(indentation-- > 0)
   space += " ";
  var title = (""+this.title).split("<").join("&lt;");
  var scripts = [];
  if("scripts" in this)
   scripts = this.scripts;
  return [
   space + "<head>",
   " <title>" + title + "</title>"
  ].concat(
   showScripts ?
    scripts.map(function(x){return x.toHtml(1)}) : // TODO: scripts go here
    [], //no scripts
   [
    "</head>"
   ]
  ).join("\n" + space);
 }),
"title": "test page, lol",
"scripts": [{"toHtml": (function (){
  var url = this.href.split("\"").join("%22");
  return "<script src=\"" + url + "\"></script>";
 }),
"href": "https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"},
{"scripts": [(function readFile(p, callback){
 return $.get(
  "/admin/fs/browse/" + p.substring(1),
  function(s){return callback(s);}
 );
}),
(function writeFile(p, contents, callback){
 return $.post(
  "/admin/fs/overwrite/",
  {path: p, contents: contents},
  function(h){return callback(h);}
 );
}),
{
 __project_path: __project_path,
"toString": (function (){
   return "function init(){\n " + this.scripts.join("\n ") + "\n " + this["finally"] + "\n}";
  }),
"scripts": [(function _init(){
_load();
_save();
_store();
_state();
_once();
_browse();
}),
(function _load(){
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
 }),
(function _save(){
  $("#save").click(
   function(){
    return writeFile(
     $("#path")[0].value,
     $("#box")[0].value,
     function(s){}
    );
   }
  );
 }),
(function _store(){
  $("#storage")[0].value = localStorage["default"];
  $("#saveEvalStorage").click(
   function(){
    var val = $("#storage")[0].value
    localStorage["default"] = val; //TODO: soft-code the key
    eval(val);
   }
  );
 }),
(function _state(){
if(!("state" in window))
 window.state = {};
var state = window.state;
state.toJSONable = function(){
 return this;
 var result = {};
 var it;
 for(var k in this)
  try{
   it = this[k];
   if(JSON.stringify(it))
    result[k] = it;
  }catch(e){}
 return result;
};
state.toString = function(){
 return JSON.stringify(this.toJSONable());
};
if(!$("#raw").length)
 (
  function(inp){
   inp.id = "raw"
   document.getElementsByTagName("body").item(0).appendChild(inp);
   inp.onkeydown = function(evt){state.handleKey(evt);};
   inp.onkeyup = function(evt){state.handleKey(evt);};
   inp.onkeypress = function(evt){state.handleKey(evt);};
   return inp;
  }
 )(document.createElement("input"));
if(!$("#preview").length)
 (
  function(elem){
   elem.id = "preview";
   document.getElementsByTagName("body").item(0).appendChild(elem);
   return elem;
  }
 )(document.createElement("div"))
$("#preview")[0].style.border = "1px solid black";
if(!("modes" in state))
 state.modes = {};

state.escapeHtml = function(str){
 var elem = document.createElement("div");
 elem.textContent = str;
 return elem.innerHTML;
};
state.modes[""] = function(inp){
 return ["<span style=\"color:red\">unknown mode</span>", inp];
};
state.modes["p "] = function(inp){
 var dvo = state.asIfDvorak(inp);
 var html = state.escapeHtml(dvo);
 return [html, "p " + inp];
}
state.handleKey = function(evt){
 var val = $("#raw")[0].value;
 var prefix = "";
 for(var k in state.modes)
  if(k.length <= val.length)
   if(k.length >= prefix.length)
    if(val.substr(0, k.length) == k)
     prefix = k;
 var suffix = val.substr(prefix.length);
 if(!(prefix in state.modes)) prefix = "p ";
 var hi = state.modes[prefix](suffix);
 state.htmlOut(hi[0]);
 if(hi[1] != val)
  $("#raw")[0].value = hi[1];
}
state.htmlOut = function(h){
 $("#preview")[0].innerHTML = h;
};
state.asIfDvorak = function(str){
 return str.split("").map(
  function(c){
   return "abcdefghijklmnopqrstuvwxyz',.[]-/=;ABCDEFGHIJKLMNOPQRSTUVWXYZ\"<>{}_?+:"[
    "anihdyujgcvpmlsrxo;kf.,bt/qwe-='[]zANIHDYUJGCVPMLSRXO:KF><BT?QWE_+\"{}Z".indexOf(c)
   ] || c;
  }
 ).join("");
};
state.textOut = function textOut(text){
 var that = this;
 return this.htmlOut(
  (""+text).split("\n").map(
   function(str){
    return that.escapeHtml(
     str
    ).split("  ").join(" &nbsp;");
   }
  ).join("<br/>\n").split("\n ").join("\n&nbsp;")
 );
};
state.htmlOut("<span style=\"color:green\">ready.</span>");
//$.post("/append", {string: localStorage["default"]}, state.textOut.bind(state));
if(!$("#storageKey").length)
 (
  function(elem){
   elem.id = "storageKey";
   elem.value = "default";
   document.getElementsByTagName("body").item(0).appendChild(elem);
   return elem;
  }
 )(
  document.createElement("input")
 );
//eval(localStorage.once);
state.htmlOut(
 (
  function(alist){
   return [
    "<dl>",
    alist.map(
     function(pair){
      return [
       "<dt>",
       state.escapeHtml(pair[0]),
       "</dt>",
       "<dd>",
       pair[1].split("\n").map(
        function(l){return state.escapeHtml(l);}
       ).join("<br />\n").split("  ").join(
        " &nbsp;"
       ).split("\n ").join("\n&nbsp;"),
       "</dd>"
      ].join("\n");
     }
    ).join("\n"),
    "</dl>",
    ""
   ].join("\n");
  }
 )(
  Object.keys(localStorage).map(
   function(k){return [k, localStorage[k]];}
  )
 )
)

state.countBack = function countBack(n, callback){
  var result = [];
  function decorated(x){
   result.push(x);
   if(result.length == n) callback(result);
  }
  decorated.n = n;
  decorated.callback = callback;
  if(!n) callback(result);
  return decorated;
}

function fakewriteFile(a, b, c){
 return c(b);
}

state.upload_local = function upload_local(namespace, callback){
 var uploads = (
  function(ob){
   return Object.keys(ob).map(
    function(k){
     return [k, ob[k]];
    }
   );
  }
 )(localStorage).map(
  function(kv){
  var k = kv[0];
  var v = kv[1];
  function encode(str){
   return "hex-" + [].slice.call(str).map(
    function(c){return c.charCodeAt(0).toString(16);}
   ).map(
    function(s){if(s.length < 2) return "0" + s; return s;}
   ).join("-");
  };
  var fn = "_namespace1_" + encode(namespace) + "_" + encode(k);
  return [fn, v];
  }
 );

 var dict = {};
 var cb = state.countBack(
  uploads.length,
  function(xs){
   xs.map(function(kv){dict[kv[0]] = kv[1];});
   callback(dict);
  }
 );

 uploads.map(
  function(kv){
   var k = kv[0];
   var v = kv[1];
  writeFile(
   __project_path + "persist/sync/" + k,
   v,
   function(html){
    state.textOut(k);
    cb([k, html]);
   }
  );
  }
 );
}

state.download_namespace = function download_namespace(namespace, callback){
 var dir = __project_path + "persist/sync/";
 readFile(
  dir,
  function(html){
   state.htmlOut(html);
   var anchors = [].slice.call(
    $(html).find("a")
   );
   var cb = state.countBack(
    anchors.length,
    function(xs){
     var result = {};
     xs.map(
      function(kv){
       var k = kv[0];
       var v = kv[1];
       var tokens = k.split("_");
       if("namespace1" != tokens[1]) return [];
       function decode(s){
        var pieces = s.split("-");
        if("hex" != pieces[0]) return;
        pieces.shift();
        return pieces.map(function(hex){return String.fromCharCode(parseInt(hex, 16))}).join("");
       }
       return [decode(tokens[2]), decode(tokens[3]), v];
      }
     ).filter(function(x){return x && namespace == x[0]}).map(function(x){result[x[1]] = x[2]});
     return callback(result);
    }
   )
   state.textOut(
    anchors.map(
      function(a){
       var fn = $(a).text();
       readFile(
        dir + "/" + fn,
        function(str){cb([fn, str])}
       );
       return fn;
      }
    ).join("\n")
   );
  }
 );
}

state.htmlList = function htmlList(htmls){
 return "<ul>\n" +
  htmls.map(
   function(html){return " <li>" + html + "</li>";}
  ).join("\n") +
  "\n</ul>";
}
state.textList = function textList(texts){
 return state.htmlList(
  texts.map(
   function(text){
    return (""+text).split("\n").map(
     state.escapeHtml.bind(state)
    ).join("<br />\n");
   }
  )
 )
};
state.textListOut = function textListOut(texts){
 return this.htmlOut(
  this.textList(texts)
 );
};
state.listify = function listify(xs){return [].slice.call(xs);};
state.ls_dir = function ls_dir(dir, callback){
 return readFile(
  dir,
  function(html){
   var anchors = state.listify($(html).find("a"));
   return callback(anchors.map(function(a){return $(a).text();}));
  }
 );
};
state.decode_dumbhex = function decode(s){
 var pieces = s.split("-");
 if("hex" != pieces[0]) return;
 pieces.shift();
 return pieces.map(
  function(hex){
   return String.fromCharCode(parseInt(hex, 16));
  }
 ).join("");
};

state.get_namespaces = function get_namespaces(callback){
 var dir = __project_path + "persist/sync/"; // TODO: configuration goes in state.config or something
 state.ls_dir(
  dir,
  function(files){
   var namespaces = files.map(
    function(s){return s.split("_");}
   ).filter(function(xs){return xs.length >= 3}).filter(
    function(xs){return "namespace" == xs[1].substr(0, "namespace".length);}
   ).map(function(xs){return xs[2]}).map(
    state.decode_dumbhex.bind(state)
   );
   var d = {};
   namespaces.map(function(k){d[k] = k;});
   return callback(Object.keys(d));
  }
 );
};


state.browse_server = function browse_server(callback){
 (
  function(p, cb){
   cb(cb, p, []);
  }
 )(
  "/admin/introspect/",
  function(f, p, path_soFar){
   function combine_path(base, relative){
    if("" == relative.split("/")[0]) return relative; //absolute
    // TODO: handle ".." and "."
    var result = base + "/" + relative;
    var components = result.split("/");
    if("." == relative) return base;
    if("./" == relative) return base;
    if(".." == relative || "../" == relative){
     var suffix = "";
     components = base.split("/");
     if("" == components[components.length - 1] && components.length > 1){
      suffix = "/"
      components.pop();
     }
     components.pop();
     return components.join("/") + suffix;
    }
    var prefix = components[0] == "" ? "/" : "";
    var suffix = components[components.length - 1] == "" && components.length > 1 ? "/" : "";
    return prefix + components.filter(function(component){return "" != component;}).join("/") + suffix;
   }
   $.get(
    p,
    function(h){
     state.textOut(h);
     var div = $("#preview");
     div[0].innerHTML = h;
     $(div).find("a").each(
      function(){
       var relpath = this.getAttribute("href");
       var path = combine_path(p, relpath);
       this.href = path;
       var pathKey = $(this).text().trim(); //so now we don't support whitespace :/
       var newPath = path_soFar.concat([pathKey]);
       if(".." == relpath){newPath.pop(); newPath.pop();}
       if("../" == relpath){newPath.pop(); newPath.pop();}
       $(this).click(
        function(e){
         f(f, path, newPath);
         e.preventDefault();
         callback(path);
        }
       );
      }
     );
     var evaller = document.createElement("div");
     var key = document.createElement("input");
     evaller.appendChild(key);
     var spell = document.createElement("textarea");
     evaller.appendChild(spell);
     var invoker = document.createElement("input");
     invoker.type = "button";
     invoker.value = "save into";
     evaller.appendChild(invoker);
     $(invoker).click(
      function(){
       var pathStuff = path_soFar.concat([key.value]);
       var expr = spell.value;
       state.dumbWrite(pathStuff, expr, f.bind(this, f, p, path_soFar));
      }
     );
     div[0].appendChild(evaller);
    }
   );
  }
 );
};

state.dumbWrite = function dumbWrite(path, expr, callback){
 // warning! line breaks are not supported in the path
 if(path.filter(function(x){return -1 != (""+x).indexOf("\n");}).length) return callback("not attempting with line breaks");
 $.post(
  "/admin/dumbWrite/",
  {path: path.join("\n"), expr: expr},
  callback
 );
};
 }),
(function _once(){
$("#saveEvalStorage").off("click").bind(
 "click.fromKey",
 function(){
  var val = document.getElementById("storage").value;
  var key = document.getElementById("storageKey").value;
  localStorage[key] = val;
  eval(val);
 }
);
$("#storageKey").on(
 "change.updateStorage",
 function(){
  var key = document.getElementById("storageKey").value;
  var val = "";
  if(key in localStorage)
   val = localStorage[key];
  document.getElementById("storage").value = val;
 }
);
 }),
(function _browse(){
  state.browse_server(function(){});
 })],
"finally": "window.__project_path = " + JSON.stringify(__project_path) + ";\n_init();"},
"$(init);"],
"toHtml": (function toHtml(indentation){
  var space = "";
  while(indentation-- > 0)
   space += " ";
  return space + "<script>\n" + space  + " "+
   this.scripts.map(
    function(x){
     return (""+x).split("\n").join("\n" + space + " ")
    }
   ).join("\n\n" + space + " ") +
   "\n" + space + "</script>";
 })}]},
"body": {"toHtml": (function (indentation){
   var space = "";
   while(indentation-- > 0)
    space += " ";
   var contents = [];
   if("getContents" in this)
    contents = this.getContents();
   return [
    space + "<body>"
   ].concat(
    contents.map(function(x){return x.toHtml(1)}),//TODO: try/catch
    ["</body>"]
   ).join("\n" + space);
  }),
"getContents": (function (){
  if("contents" in this) return this.contents;
  return [];
 }),
"contents": [{"toHtml": (function (){return "<input id=\"path\" style=\"width: 100%;\"></input>";})},
{"toHtml": (function (){
   return "<textarea id=\"box\"></textarea>";
  })},
{"toHtml": (function (){
   //TODO: escape tagName as needed
   var tagName = this.tagName;
   return "<" + tagName + " id=\"" + this.id.split("\"").join("&quot;") + "\" value=\"" + this.value.split("\"").join("&quot;") + "\" type=\"" + this.type.split("\"").join("&quot;") + "\"></" + tagName + ">";
  }),
"tagName": "input",
"id": "load",
"value": "load",
"type": "button"},
{"toHtml": (function toHtml(){
  //TODO: escape tagName as needed
  var tagName = this.tagName;
  var id = this.id.split("\"").join("&quot;");
  var value = this.value.split("\"").join("&quot;");
  var type = this.type.split("\"").join("&quot;");
  var openTag = "<" + tagName + " id=\"" + id + "\" value=\"" + value + "\" type=\"" + type + "\">";
  return openTag + "</" + tagName + ">";
 }),
"tagName": "input",
"id": "save",
"value": "save",
"type": "button"},
{"toHtml": (function (){return "<br />";})},
{"toHtml": (function (){return "<textarea id=\"storage\"></textarea>";})},
{"toHtml": (function toHtml(){
  //TODO: escape tagName as needed
  var tagName = this.tagName;
  var id = (""+ this.id).split("\"").join("&quot;");
  var value = (""+ this.value).split("\"").join("&quot;");
  var type = this.type.split("\"").join("&quot;");
  var openTag = "<" + tagName + " id=\"" + id + "\" value=\"" + value + "\" type=\"" + type + "\">";
  return openTag + "</" + tagName + ">";
 }),
"tagName": "input",
"id": "saveEvalStorage",
"value": "save and eval (local)",
"type": "button"}]},
"toSource": (function toSource(){
 function recur(x, f){return f(f, x);}
 return recur(
  this,
  function(f,x){
   //TODO: detect cycles
   function object_to_dict_str(ob){
    return "{" + Object.keys(ob).map(
     function(k){
      return f(f, k) + ": " + f(f, ob[k]);
     }
    ).join(",\n") + "}";
   }
   if("object" == typeof x){
    if(x instanceof Array)
     return "[" + x.map(function(elem){return f(f, elem);}).join(",\n") + "]";
    else
     return object_to_dict_str(x)
   }
   if("string" == typeof x)
    return JSON.stringify(x);
   if("function" == typeof x)
    return (
     function(f, ob_str){
      if("{}" == ob_str) return "(" + f + ")";
      return "(" +
       function(f, x){
        Object.keys(x).map(function(k){f[k]=x[k];});
        return f;
       } +
       ")(" + f + ", " + ob_str + ")";
     }
    )(x, object_to_dict_str(x));
   return typeof x;
  }
 );
}),
"src": ""}

 );
}
