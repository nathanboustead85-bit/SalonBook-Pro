"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const app=fs.readFileSync("web/phase1287/app.js","utf8");
const css=fs.readFileSync("web/phase1287/style.css","utf8");
for(const marker of ['confirmation-banner','confirmation-symbol','confirmation-copy','confirmation-eyebrow','DEMONSTRATION PREVIEW','No appointment has been booked.','copy.append(eyebrow,heading,subtitle)','panel.append(banner)'])assert.ok(app.includes(marker),marker);
for(const marker of ['Phase 12.100','.confirmation-banner','.confirmation-symbol','.confirmation-subtitle'])assert.ok(css.includes(marker),marker);
assert.ok(!app.includes('fetch('));
console.log("PASS Phase 12.100 premium fictional confirmation contract");
