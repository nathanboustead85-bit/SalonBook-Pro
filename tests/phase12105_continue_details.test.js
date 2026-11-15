"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("web/phase1287/index.html","utf8"),app=fs.readFileSync("web/phase1287/app.js","utf8"),css=fs.readFileSync("web/phase1287/style.css","utf8");
assert.ok(html.includes('id="continueToDetails" type="button"'));assert.ok(html.includes('disabled aria-controls="customerName"'));
assert.ok(app.includes('$("continueToDetails").disabled=selected!==4'));
assert.ok(app.includes('$("continueToDetails").addEventListener("click"'));
assert.ok(app.includes('$("customerName").focus()'));
assert.ok(css.includes(".continue-details:disabled"));assert.ok(!app.includes("fetch("));
console.log("PASS Phase 12.105 guided continuation contract");
