"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),out=path.join(root,"preview-dist");
const source=fs.readFileSync(path.join(root,"web/phase28/index.html"),"utf8");
const scripts=[...source.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
assert.ok(scripts.length>=4,"Expected the validated catalogue scripts");
let html=source.replace(/<link rel="stylesheet" href="\.\/style\.css">/,()=>"<style>"+fs.readFileSync(path.join(root,"web/phase28/style.css"),"utf8")+"</style>");
for(const src of scripts){assert.match(src,/^\.\.?\/[a-zA-Z0-9/._-]+\.js$/);const file=path.resolve(root,"web/phase28",src);assert.ok(file.startsWith(path.join(root,"web")+path.sep));const js=fs.readFileSync(file,"utf8").replace(/<\/script/gi,"<\\/script");html=html.replace('<script src="'+src+'"></script>',"<script>"+js+"</script>");}
assert.equal(/<script src=|<link rel="stylesheet"/.test(html),false,"Preview must be self-contained");
assert.match(html,/noindex,nofollow/);assert.match(html,/Booking not yet available/);
assert.match(html,/fictional catalogue information/);assert.match(html,/bookingEnabled:false/);
assert.equal(/https?:\/\//.test(html),false,"No external network URLs permitted");
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"Boustio-Website-Preview.html"),html);
console.log("PASS: self-contained, offline, noindex, demo-only Samsung preview built");
