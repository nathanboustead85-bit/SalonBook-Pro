"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root="web/phase1287",html=fs.readFileSync(path.join(root,"index.html"),"utf8"),js=fs.readFileSync(path.join(root,"app.js"),"utf8");
assert.match(html,/noindex,nofollow/);assert.match(html,/DEMONSTRATION ONLY/);assert.match(html,/NO REAL BOOKINGS/i);
assert.match(html,/Nothing is stored or sent/);assert.match(html,/id="journey"/);assert.match(html,/id="confirmation"/);
for(const id of ["services","staff","date","times","review","customerName","customerEmail","customerPhone","consent","resetSelection","editSelection","continueToDetails"])assert.ok(html.includes('id="'+id+'"'),id);
for(const forbidden of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\blocalStorage\b/,/\bsessionStorage\b/,/\bindexedDB\b/])assert.ok(!forbidden.test(js),"Unexpected storage/network API: "+forbidden);
for(const p of ["../phase1280/catalogueContract.js","../phase1281/cataloguePresentation.js","../phase1282/serviceStaffSelection.js","../phase1283/appointmentSelection.js","../phase1284/bookingReview.js","../phase1285/customerConfirmationPreview.js","../phase1286/bookingJourneyPreview.js","./app.js"])assert.ok(fs.existsSync(path.resolve(root,p)),p);
console.log("PASS Phase 12.110 final offline-preview release contract");
