var router = require("webserver_functors");
var MethodRoutingResponder = router.MethodRoutingResponder;
var child_process = require("child_process");
var formStream = require("form_stream");

var responder = new MethodRoutingResponder(
		{
		    "GET": function(q, s){
			var u = q.url.split("/");
			u.shift(); // ""
			if(!u[u.length - 1]) u.pop(); //remove trailing slash
			var p = "/" + u.join("/");
			var kid = child_process.spawn(
			    "gconftool-2",
			    ["--all-dirs", p]
			)
			var lex = new (formStream.SingleCharacterDelimiterLexerEmitter)(kid.stdout, "\n");
			lex.on(
			    "lexer",
			    function(lineStream){
				var sliced = new (formStream.FunctionImageStream)(
				    new (formStream.SlicingStream)(lineStream, 1),
				    escape
				);
				formStream.bufferChunks(
				    sliced.resume(),
				    function(p){
					s.write(
					    "<a href=\"" +
						(
						    function last(xs){
							return xs[xs.length - 1];
						    }
						)(p.split("/")) +
						"/\">" +
						p +
						"</a><br />\n"
					);
				    }
				);
				lineStream.resume();
			    }
			);
			lex.on(
			    "end",
			    function(){
				var kiddo = child_process.spawn("gconftool-2", ["-a", p]);
				s.write("<pre>\n");
				kiddo.stdout.pipe(s);
				kiddo.on(
				    "exit",
				    function(){s.end("</pre>\n");}
				);
			    }
			).resume();
		    }
		}
)

this.responder = responder;