"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const js=fs.readFileSync("web/phase1287/app.js","utf8"),css=fs.readFileSync("web/phase1287/style.css","utf8");
for(const marker of ['revise.id="reviseDemoDetails"','revise.type="button"','revise.addEventListener("click"','panel.hidden=true','$("customerName").focus()','panel.append(revise)','restart.id="restartDemo"'])assert.ok(js.includes(marker),marker);
assert.ok(css.includes(".revise-demo:focus-visible"));assert.ok(!js.includes("fetch("));console.log("PASS Phase 12.109 confirmation revise-details contract");
