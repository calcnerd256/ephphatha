var child_process = require("child_process");
var formStream = require("form_stream");
var FormStream = formStream.FormStream;
//POST request depends upon xdotool

function handleGet(req, res){
 var mover = function mover(evt){
				if(!window.dragState)
				    window.dragState = {dx: 0, dy: 0, frame: 0};
				evt.preventDefault();
				var t = evt.touches[0];
				var x = t.clientX;
				var y = t.clientY;
				var dx = x - window.dragState.x;
				if(!("x" in window.dragState)) dx = 0;
				window.dragState.x = x;
				var dy = y - window.dragState.y;
				if(!("y" in window.dragState)) dy = 0;
				window.dragState.y = y;
				window.dragState.dx += dx;
				window.dragState.dy += dy;
				window.dragState.frame++;
				if(!window.dragState.notReady){
				    window.dragState.notReady = 1;
				    var sensitivity = 0.5;
				    var xd = Math.floor(window.dragState.dx * sensitivity);
				    var yd = Math.floor(window.dragState.dy * sensitivity);
				    window.dragState.dx = 0;
				    window.dragState.dy = 0;
				    window.dragState.frame = 0;
				    var xhr = new XMLHttpRequest();
				    xhr.onreadystatechange = function(){
					if(4 == xhr.readyState)
					    window.dragState.notReady = 0;
				    }

				    xhr.open("POST", document.location.href);
				    var postdata = "x=" +
					xd +
					"&y=" + yd;
				    xhr.send(postdata);
				}
 };

			var src = [
			    "<form method=\"POST\">",
			    " <input name=\"x\"></input>",
			    " <input name=\"y\"></input>",
			    " <input type=\"submit\">",
			    "</form>",
			    "<script>",
			    " document.addEventListener(",
			    "  \"touchstart\",",
			    "  function(evt){",
			    "   //TODO make this happen when the focus finger changes",
			    "   if(!window.dragState)",
			    "    window.dragState = {dx:0, dy:0, frame:0};",
			    "   delete window.dragState.x;",
			    "   delete window.dragState.y;",
			    "  }",
			    " )",
			    " document.addEventListener(\"touchmove\", " + mover + ");",
			    "</script>",
			    ""
			].join("\n")
			res.setHeader("Content-Type", "text/html");
			res.end(src);
}

function handlePost(q, s){
			var form = new FormStream(q);
			var x = 0; var y = 0;
			var state = [
			    0,//x
			    0,//y
			    0//complete called once
			];
			function complete(){
			    if(state[2]) return;
			    state[2] = 1;
			    var kid = child_process.spawn(
				"xdotool",
				[
				    "mousemove_relative",
				    "--",//necessary for negative values of x and y
				    "" + (+x),
				    "" + (+y)
				]
			    );
			    kid.on(
				"exit",
				function(code){
				    if(code)
					console.warn(
					    [
						"xdotool mousemove_relative",
						x,
						y,
						"exited with code",
						code
					    ]
					);
				    s.end(""+code);
				}
			    );
			}
			form.on(
			    "s_x",
			    function(s){
				state[0] = 1;
				formStream.bufferChunks(
				    s, 
				    function(_x){
					state[0] = 2;
					x = _x;
					if(2 == state[1])
					    return complete();
				    }
				).resume();
			    }
			);
			form.on(
			    "s_y",
			    function(s){
				state[1] = 1;
				formStream.bufferChunks(
				    s,
				    function(_y){
					state[1] = 2;
					y = _y;
					if(2 == state[0])
					    return complete();
				    }
				).resume();
			    }
			);
			form.on(
			    "end",
			    function(){
				if(state[0] == 1) return;
				if(state[1] == 1) return;
				complete();
			    }
			);
}

this.handleGet = handleGet;
this.handlePost = handlePost;
