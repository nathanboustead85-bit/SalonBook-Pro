"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const app=fs.readFileSync("web/phase1287/app.js","utf8");
for(const marker of ['const firstIssue=missingSelection?','$("services").querySelector("button")','$("staff").querySelector("button")','$("date")','$("times").querySelector("button:not(:disabled)")','invalidName?$("customerName")','invalidEmail?$("customerEmail")','invalidPhone?$("customerPhone")','!customer.consent?$("consent")','if(firstIssue)firstIssue.focus()'])assert.ok(app.includes(marker),marker);
assert.ok(!app.includes("fetch("));
console.log("PASS Phase 12.106 focus recovery contract");
