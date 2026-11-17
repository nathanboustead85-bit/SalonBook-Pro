"use strict";
// Source-only guard: never deploy or access Google Cloud in this test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../functions/index.js"), "utf8");
const start = source.indexOf("exports.publishBusiness = onCall(");
const end = source.indexOf("  async (request) => {", start);
assert.ok(start !== -1 && end > start, "publishBusiness callable declaration must exist");
const options = source.slice(start, end);
assert.match(options, /region:\s*"europe-west2"/);
assert.match(options, /serviceAccount:\s*"boustio-business-publisher@salonbook-pro-ad5ff\\.iam\\.gserviceaccount\\.com"/);
assert.match(options, /maxInstances:\s*10/);
assert.match(options, /enforceAppCheck:\s*false/);
assert.match(source, /acceptingBookings:\s*false/);
console.log("PASS: publishBusiness dedicated runtime identity and disabled booking guard (source-only)");
