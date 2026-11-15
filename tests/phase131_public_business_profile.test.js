"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {prepareBusinessProfile}=require("../web/phase131/publicBusinessProfile");
const sample=()=>({schemaVersion:1,slug:"kody-blends",published:true,businessName:"Kody Blends",services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,published:true},{id:"hidden",name:"Private",pricePence:9999,durationMinutes:60,published:false}],staff:[{id:"kody",name:"Kody",active:true,serviceIds:["cut","hidden"]},{id:"off",name:"Off",active:false,serviceIds:["cut"]}],ownerUid:"secret",clients:[{email:"private@example.test"}],bookings:[{id:"private"}]});
const ok=prepareBusinessProfile(sample(),"kody-blends");
assert.equal(ok.status,"PUBLIC_PROFILE_DISPLAY_READY");assert.equal(ok.bookingEnabled,false);
assert.equal(ok.profile.businessName,"Kody Blends");assert.equal(ok.profile.services.length,1);assert.equal(ok.profile.staff.length,1);
assert.deepEqual(ok.profile.staff[0].serviceIds,["cut"]);
assert.equal(JSON.stringify(ok).includes("private@example.test"),false);
assert.equal(JSON.stringify(ok).includes("secret"),false);
assert.equal(Object.isFrozen(ok.profile),true);
for(const [payload,slug] of [[null,"kody-blends"],[sample(),"other"],[{...sample(),published:false},"kody-blends"],[{...sample(),schemaVersion:2},"kody-blends"],[{...sample(),services:[]},"kody-blends"]]){const result=prepareBusinessProfile(payload,slug);assert.equal(result.status,"PUBLIC_PROFILE_UNAVAILABLE");assert.equal(result.bookingEnabled,false);}
const code=fs.readFileSync("web/phase131/publicBusinessProfile.js","utf8");
for(const forbidden of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bindexedDB\b/,/\bWebSocket\b/,/\bfirebase\./])assert.equal(forbidden.test(code),false,String(forbidden));
console.log("PASS Phase 13.1 public business profile read-only security and filtering");
