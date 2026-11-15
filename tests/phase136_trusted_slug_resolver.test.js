"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {createTrustedSlugResolver,loadResolvedBusiness,requiresServerVerifiedMapping}=require("../web/phase136/trustedSlugResolver");
const doc=()=>({schemaVersion:1,slug:"kody-blends",published:true,businessName:"Kody Blends",services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,published:true}],staff:[{id:"kody",name:"Kody",active:true,serviceIds:["cut"]}],privateNotes:"secret"});
(async()=>{
assert.equal(requiresServerVerifiedMapping,true);
const lookup=async slug=>({slug,businessId:"owner_uid_123",published:true});
let reads=0;
const getter=async(path,id)=>{reads++;assert.equal(path,"publicBusinesses");assert.equal(id,"owner_uid_123");return {exists:()=>true,data:doc};};
const ready=await loadResolvedBusiness("kody-blends",lookup,getter);
assert.equal(ready.status,"PUBLIC_CATALOGUE_READY");assert.equal(ready.bookingEnabled,false);assert.equal(ready.display.heading,"Kody Blends");assert.ok(!JSON.stringify(ready).includes("secret"));assert.equal(reads,1);
assert.equal((await loadResolvedBusiness("kody-blends",null,getter)).status,"PUBLIC_CATALOGUE_UNAVAILABLE");
assert.equal((await loadResolvedBusiness("../admin",lookup,getter)).status,"PUBLIC_CATALOGUE_UNAVAILABLE");assert.equal(reads,1);
for(const bad of [null,{},[],{slug:"wrong",businessId:"owner_uid_123",published:true},{slug:"kody-blends",businessId:"../private",published:true},{slug:"kody-blends",businessId:"owner_uid_123",published:false}]){
 assert.equal(await createTrustedSlugResolver(async()=>bad)("kody-blends"),null);
}
assert.equal((await loadResolvedBusiness("kody-blends",async()=>({slug:"wrong",businessId:"owner_uid_123",published:true}),getter)).status,"PUBLIC_CATALOGUE_UNAVAILABLE");assert.equal(reads,1);
assert.equal((await loadResolvedBusiness("kody-blends",lookup,async()=>({exists:()=>true,data:()=>({...doc(),slug:"other"})}))).status,"PUBLIC_CATALOGUE_UNAVAILABLE");
assert.equal((await loadResolvedBusiness("kody-blends",async()=>{throw Error("offline")},getter)).status,"PUBLIC_CATALOGUE_UNAVAILABLE");
assert.throws(()=>createTrustedSlugResolver(null),TypeError);
const rules=fs.readFileSync("firestore.rules","utf8");
assert.match(rules,/match \/publicBusinesses\/\{businessId\}/);
const code=fs.readFileSync("web/phase136/trustedSlugResolver.js","utf8");
for(const forbidden of ["innerHTML","query(","where(","getDocs(","setDoc(","addDoc(","updateDoc(","deleteDoc(","localStorage"])assert.ok(!code.includes(forbidden),forbidden);
console.log("PASS Phase 13.6 trusted slug resolution, privacy and no-list guard");
})().catch(e=>{console.error(e);process.exitCode=1});
