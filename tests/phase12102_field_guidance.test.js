"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("web/phase1287/index.html","utf8");
const app=fs.readFileSync("web/phase1287/app.js","utf8");
const css=fs.readFileSync("web/phase1287/style.css","utf8");
for(const [id,hint] of [["customerName","nameHint"],["customerEmail","emailHint"],["customerPhone","phoneHint"]]){
 assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('aria-describedby="'+hint+'"'),hint);
 assert.ok(html.includes('id="'+hint+'" class="field-hint"'),hint);
}
for(const marker of ['function updateCustomerFieldGuidance()','addEventListener("blur"','field-hint-error','field-hint-valid','name@example.test'])assert.ok(app.includes(marker),marker);
assert.ok(css.includes('.field-hint-error'));
assert.ok(!app.includes('fetch('));
console.log("PASS Phase 12.102 accessible customer field guidance contract");
