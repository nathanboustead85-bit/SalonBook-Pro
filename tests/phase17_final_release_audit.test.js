"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const backend=read("functions/index.js");
const rules=read("firestore.rules");
const page=read("website/book/index.html");
const home=read("website/index.html");
const chat=read("website/book/customer-chat.js");
const engine=read("functions/bookingEngine.js");
const trusted=read("functions/trustedBooking.js");
const workflow=read(".github/workflows/production-deployment.yml");
const deployment=read(".github/workflows/deploy-website.yml");
const exportsFound=[...backend.matchAll(/\bexports\.([A-Za-z_$][\w$]*)\s*=/g)].map(x=>x[1]);
const checks=[
 {id:"public-booking-off",ready:!exportsFound.some(x=>/booking|reservation|reserveSlot|confirmBooking/i.test(x)) && !/acceptingBookings:\s*true\b/.test(backend),required:true},
 {id:"preview-only",ready:/Booking unavailable[^<]*preview only<\/button>/i.test(page),required:true},
 {id:"private-records-locked",ready:/match \/businesses\/\{businessId\}\/bookingLocks\/\{lockId\}\s*\{\s*allow read, write: if false;/.test(rules),required:true},
 {id:"chat-off",ready:/const CHAT_ENABLED = false\s*;/.test(chat)&&/BOUSTIO_CHAT_ENABLED !== "true"/.test(backend),required:true},
 {id:"production-read-only",ready:/No Firebase deployment commands executed/.test(workflow)&&!/firebase deploy --only|gcloud functions deploy|gcloud run deploy/.test(workflow),required:true},
 {id:"website-deploy-manual-gate",ready:/DEPLOY-BOUSTIO-WEBSITE/.test(deployment)&&/production-release/.test(deployment),required:true},
 {id:"conflict-engine-transaction",ready:/db\.runTransaction/.test(engine)&&/snapshots\.some/.test(engine)&&/transaction\.create\(\s*appointmentRef/.test(engine),required:true},
 {id:"trusted-catalogue-check",ready:/publicBusiness\.acceptingBookings !== true/.test(trusted)&&/catalogue\.business\.acceptingBookings !== true/.test(trusted),required:true}
];
const blockers=[
 "Business website self-registration, verified-email onboarding and account setup are not implemented end to end.",
 "Android legacy appointments must be migrated or represented in the same authoritative booking conflict system; offline lock tests do not prove multi-device safety.",
 "Trusted server-side catalogue publishing and staff availability synchronization need end-to-end verification.",
 "Firebase emulator integration tests and live environment security review remain outstanding; source checks are not a penetration test.",
 "Production-release/main branch deployment workflows, IAM permissions, DNS and hosting configuration require separate review before launch.",
 "Customer bookings must remain disabled until explicit owner approval, staged tests and a controlled deployment plan.",
 "Customer messaging App Check, abuse controls and privacy/retention processes require verification before activation."
];
test("Phase 17 final release audit — fail closed on safety regression",async t=>{
 for(const item of checks)await t.test(item.id,()=>assert.equal(item.ready,true,"Safety control failed: "+item.id));
 await t.test("outstanding launch blockers are explicitly documented",()=>{
  const report=read("docs/PHASE17_RELEASE_READINESS.md");
  for(const blocker of blockers)assert.ok(report.includes(blocker),"Missing blocker: "+blocker);
  assert.match(report,/NOT APPROVED FOR PRODUCTION/i);
 });
});
if(require.main===module){
 console.log("Phase 17 offline safety checks:",checks.filter(x=>x.ready).length+"/"+checks.length);
 console.log("Outstanding launch requirements:",blockers.length);
 console.log("Release status: NOT APPROVED FOR PRODUCTION");
}
