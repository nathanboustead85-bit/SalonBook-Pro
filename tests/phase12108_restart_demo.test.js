"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const js=fs.readFileSync("web/phase1287/app.js","utf8"),css=fs.readFileSync("web/phase1287/style.css","utf8");
for(const marker of ['restart.id="restartDemo"','restart.type="button"','restart.addEventListener("click"','state.serviceId=""','state.staffId=""','state.date=""','state.time=""','field.value=""','delete field.dataset.touched','$("consent").checked=false','updateDetailsReadiness();render()','$("services").querySelector("button")?.focus()'])assert.ok(js.includes(marker),marker);
assert.ok(css.includes(".restart-demo:focus-visible"));assert.ok(!js.includes("fetch("));console.log("PASS Phase 12.108 private demo restart contract");
