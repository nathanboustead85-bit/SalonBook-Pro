"use strict";
/** Phase 11.64: isolated emulator integration model. No production Firebase or Android writes. */
const test=require("node:test"),assert=require("node:assert/strict"),admin=require("firebase-admin");
const projectId="demo-boustio-phase-1164";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Phase 11.64 must use the disposable Firestore emulator");
const app=admin.initializeApp({projectId},"phase1164");
const db=app.firestore(),owner="phase1164-disposable";
const legacy=db.doc(`users/${owner}/liveData/bookings`);
const web=db.collection(`businesses/${owner}/appointments`);
const date="2026-11-11";
const local=[
 {id:"phone-1",date,time:"09:00",duration:30,staffId:"barber-a",client:"Existing 1"},
 {id:"phone-2",date,time:"11:30",duration:30,staffId:"barber-b",client:"Existing 2"}
];
const minutes=t=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw Error("invalid time");const [h,m]=t.split(":").map(Number);return h*60+m};
function validate(item){
 const start=minutes(item.time),duration=item.duration;
 if(typeof item.id!=="string"||!item.id||typeof item.staffId!=="string"||!item.staffId||
 !Number.isInteger(duration)||duration<1||duration>720||start+duration>1440)throw Error("invalid appointment");
 return {...item,start,end:start+duration};
}
function compare(phone,website){
 const known=new Set(),accepted=[],warnings=[];
 for(const raw of phone){
  const p=validate(raw);
  if(known.has(p.id))throw Error("duplicate phone ID");
  known.add(p.id);accepted.push({...p,source:"phone"});
 }
 for(const raw of website){
  if(raw.status==="cancelled"||raw.status==="canceled")continue;
  let p;
  try{p=validate(raw)}catch(_){warnings.push({id:raw.id||"unknown",reason:"invalid"});continue}
  const key=`web:${p.id}`;
  if(known.has(key)){warnings.push({id:p.id,reason:"duplicate website ID"});continue}
  known.add(key);
  const overlap=accepted.some(other=>other.date===p.date&&other.staffId===p.staffId&&p.start<other.end&&other.start<p.end);
  if(overlap)warnings.push({id:p.id,reason:"staff time overlap"});
  accepted.push({...p,source:"website",readOnly:true});
 }
 return {accepted,warnings};
}
async function seed(webItems){
 await legacy.set({json:JSON.stringify(local),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 for(const item of webItems)await web.doc(item.docId||item.id).set(item);
}
async function fetchWebsite(){
 const snap=await web.where("date","==",date).get();
 return snap.docs.map(d=>({id:d.id,...d.data()}));
}
test("11.64 isolated website bookings remain separate from legacy phone snapshot",async()=>{
 await seed([{id:"web-1",date,time:"14:00",duration:30,staffId:"barber-a",status:"confirmed"}]);
 const before=(await legacy.get()).get("json");
 const result=compare(local,await fetchWebsite());
 assert.equal(result.accepted.length,3);assert.equal(result.warnings.length,0);
 assert.equal(result.accepted.filter(x=>x.source==="website").length,1);
 assert.equal((await legacy.get()).get("json"),before);
});
test("11.64 same staff overlapping durations raise a warning",async()=>{
 await web.doc("web-2").set({id:"web-2",date,time:"09:15",duration:30,staffId:"barber-a",status:"confirmed"});
 const result=compare(local,await fetchWebsite());
 assert.ok(result.warnings.some(w=>w.id==="web-2"&&w.reason==="staff time overlap"));
});
test("11.64 same time on different staff is not automatically a conflict",async()=>{
 await web.doc("web-3").set({id:"web-3",date,time:"09:00",duration:30,staffId:"barber-b",status:"confirmed"});
 const result=compare(local,await fetchWebsite());
 assert.ok(!result.warnings.some(w=>w.id==="web-3"&&w.reason==="staff time overlap"));
});
test("11.64 cancelled website booking is excluded",async()=>{
 await web.doc("web-cancel").set({id:"web-cancel",date,time:"09:10",duration:30,staffId:"barber-a",status:"cancelled"});
 const result=compare(local,await fetchWebsite());
 assert.ok(!result.accepted.some(x=>x.id==="web-cancel"));
});
test("11.64 duplicate website ID fails safely without merging",()=>{
 const duplicate={id:"web-dup",date,time:"13:00",duration:20,staffId:"barber-a"};
 const result=compare(local,[duplicate,duplicate]);
 assert.ok(result.warnings.some(w=>w.reason==="duplicate website ID"));
 assert.equal(result.accepted.filter(x=>x.id==="web-dup").length,1);
});
test("11.64 invalid duration and malformed time are rejected",()=>{
 const result=compare(local,[{id:"bad-duration",date,time:"10:00",duration:0,staffId:"barber-a"},
 {id:"bad-time",date,time:"99:00",duration:30,staffId:"barber-a"}]);
 assert.equal(result.warnings.filter(x=>x.reason==="invalid").length,2);
});
test("11.64 adjacent bookings do not overlap",()=>{
 const result=compare(local,[{id:"adjacent",date,time:"09:30",duration:30,staffId:"barber-a"}]);
 assert.equal(result.warnings.length,0);
});
test.after(async()=>{try{const docs=await web.get();const batch=db.batch();docs.forEach(d=>batch.delete(d.ref));batch.delete(legacy);await batch.commit()}finally{await app.delete()}});
