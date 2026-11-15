"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("web/phase1287/index.html","utf8"),app=fs.readFileSync("web/phase1287/app.js","utf8"),css=fs.readFileSync("web/phase1287/style.css","utf8");
assert.ok(html.includes('id="summaryNextStep"'));
for(const marker of ["Next: choose a service.","Next: choose a professional.","Next: select a demonstration date.","Next: choose an available demonstration time.","Ready to review. Enter fictional details below."])assert.ok(app.includes(marker),marker);
assert.ok(css.includes(".summary-next-step-ready"));assert.ok(!app.includes("fetch("));
console.log("PASS Phase 12.104 contextual summary next-step contract");
