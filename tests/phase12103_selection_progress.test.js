"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("web/phase1287/index.html","utf8"),app=fs.readFileSync("web/phase1287/app.js","utf8"),css=fs.readFileSync("web/phase1287/style.css","utf8");
for(const id of ["selectionReadiness","selectionReadinessFill"])assert.ok(html.includes('id="'+id+'"'));
for(const marker of ['selected+" of 4 selected"','selected*25','state.serviceId,state.staffId,state.date,state.time'])assert.ok(app.includes(marker));
assert.ok(css.includes(".summary-readiness-track"));assert.ok(!app.includes("fetch("));
console.log("PASS Phase 12.103 selection progress contract");
