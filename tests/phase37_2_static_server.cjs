const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve("web/phase37");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8"};
http.createServer((req,res)=>{const name=decodeURIComponent((req.url||"/").split("?")[0]);const file=path.resolve(root,"."+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(data)})}).listen(18737,"127.0.0.1");
