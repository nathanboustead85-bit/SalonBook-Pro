"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const pages=[
{file:"web/phase28/index.html",label:"booking"},
{file:"web/phase28/photo-preview.html",label:"photographic booking"},
{file:"web/phase28/photo-manager.html",label:"owner photo manager"},
{file:"web/phase28/portfolio-preview.html",label:"staff portfolios"}
];
const styleFiles=["web/phase28/style.css","web/phase28/photo-preview.css","web/phase28/photo-manager.css","web/phase28/portfolio-preview.css"];
for(const page of pages){
test(page.label+" has HTML5 and viewport",()=>{const s=read(page.file);assert.match(s,/<!doctype html>/i);assert.match(s,/<html\s+lang="en"/i);assert.match(s,/name="viewport"/i);});
test(page.label+" prevents indexing",()=>assert.match(read(page.file),/noindex,nofollow/));
test(page.label+" explicitly labels demo / disabled state",()=>{const s=read(page.file);assert.match(s,/preview|demo/i);assert.match(s,/disabled|not available|not enabled|coming soon/i);});
test(page.label+" has page heading and semantic main",()=>{const s=read(page.file);assert.match(s,/<main\b/i);assert.match(s,/<h1\b/i);});
test(page.label+" local stylesheet and scripts resolve",()=>{const s=read(page.file);const dir=path.dirname(page.file);for(const match of s.matchAll(/(?:src|href)="([^"]+)"/g)){const link=match[1];if(link.startsWith("./")||link.startsWith("../"))assert.equal(fs.existsSync(path.join(root,dir,link)),true,link);}});
test(page.label+" has no active submission form",()=>assert.doesNotMatch(read(page.file),/<form\b/i));
}
for(const css of styleFiles){
test(css+" includes mobile breakpoint",()=>assert.match(read(css),/@media\s*\(max-width:/));
test(css+" has no remote font imports",()=>assert.doesNotMatch(read(css),/@import\s+url\s*\(\s*["']?https?:/i));
}
test("booking confirmation remains disabled",()=>assert.match(read("web/phase28/index.html"),/<button\s+id="confirm"\s+disabled\b/));
test("photo booking confirmation remains disabled",()=>assert.match(read("web/phase28/photo-preview.html"),/<button\s+id="confirm"\s+disabled\b/));
test("photo manager upload remains disabled",()=>assert.match(read("web/phase28/photo-manager.html"),/<button\s+type="button"\s+id="addPhoto"\s+disabled\b/));
test("portfolio booking button remains disabled",()=>assert.match(read("web/phase28/portfolio-preview.html"),/<button\s+type="button"\s+disabled>Book an appointment/));
test("photo manager uses safe text DOM construction",()=>assert.doesNotMatch(read("web/phase28/photo-manager.js"),/innerHTML|outerHTML|insertAdjacentHTML/));
test("portfolio gallery uses safe text DOM construction",()=>assert.doesNotMatch(read("web/phase28/portfolio-preview.js"),/innerHTML|outerHTML|insertAdjacentHTML/));
test("owner manager has live status feedback",()=>assert.match(read("web/phase28/photo-manager.html"),/role="status"\s+aria-live="polite"/));
test("portfolio has live status feedback",()=>assert.match(read("web/phase28/portfolio-preview.html"),/role="status"\s+aria-live="polite"/));
test("photo manager has filter labels",()=>assert.match(read("web/phase28/photo-manager.html"),/aria-label="Photo categories"/));
test("portfolio staff select has a label",()=>assert.match(read("web/phase28/portfolio-preview.html"),/<label[^>]+for="professional"/));
test("all previews have distinct page titles",()=>{const titles=pages.map(p=>read(p.file).match(/<title>([^<]+)<\/title>/)?.[1]);assert.equal(titles.filter(Boolean).length,4);assert.equal(new Set(titles).size,3);});
test("photo manager demo has no network or persistent storage",()=>{const s=read("web/phase28/photo-manager-model.js")+read("web/phase28/photo-manager.js");assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|uploadBytes|firebase-admin/);});
test("portfolio demo has no network or persistent storage",()=>{const s=read("web/phase28/portfolio-model.js")+read("web/phase28/portfolio-preview.js");assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|uploadBytes|firebase-admin/);});
test("portfolio model filters business owner",()=>assert.match(read("web/phase28/portfolio-model.js"),/x\.ownerId===ownerId/));
test("photo manager model only permits demo types",()=>assert.match(read("web/phase28/photo-manager-model.js"),/new Set\(\["service","staff","cover"\]\)/));
test("photo manager and portfolio do not embed external photos",()=>{const s=read("web/phase28/photo-manager.html")+read("web/phase28/portfolio-preview.html");assert.doesNotMatch(s,/<img\b[^>]*src=["']https?:/i);});
test("existing photo preview remains opt-in",()=>assert.match(read("web/phase28/photo-preview.html"),/data-photo-preview="true"/));
test("booking and photo previews have explicit disabled labels",()=>{for(const p of pages.slice(0,2))assert.match(read(p.file),/BOOKINGS DISABLED/);});
