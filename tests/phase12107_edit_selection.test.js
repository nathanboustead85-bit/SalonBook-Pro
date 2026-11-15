"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("web/phase1287/index.html","utf8"),js=fs.readFileSync("web/phase1287/app.js","utf8"),css=fs.readFileSync("web/phase1287/style.css","utf8");
assert.ok(html.includes('id="editSelection" type="button"'));assert.ok(html.includes('disabled aria-controls="services"'));
assert.ok(js.includes('$("editSelection").disabled=selected===0'));
assert.ok(js.includes('$("editSelection").addEventListener("click"'));
assert.ok(js.includes('button[aria-pressed="true"]'));assert.ok(css.includes(".edit-selection:disabled"));
assert.ok(!js.includes("fetch("));console.log("PASS Phase 12.107 edit selection contract");
