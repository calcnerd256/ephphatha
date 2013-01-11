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

this.handleGet = handleGet;