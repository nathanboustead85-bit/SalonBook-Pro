"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,updateDoc,deleteDoc,collection,getDocs,Timestamp}=require("firebase/firestore");
const root=path.resolve(__dirname,".."),projectId="demo-boustio-phase32-staging";
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const config=JSON.parse(fs.readFileSync(path.join(root,"firebase.phase32-4.json"),"utf8"));
const owners=["phase325ownerA","phase325ownerB","phase325ownerC"];
const profile=(uid,overrides={})=>({businessId:uid,name:"Synthetic "+uid,slug:"demo-"+uid.toLowerCase(),category:"barber",email:"synthetic@example.test",phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt:Timestamp.now(),...overrides});
test("Phase 32.5 multi-owner real Firestore rules: no cross-tenant access or forged ownership",async t=>{
 assert.equal(process.env.GCLOUD_PROJECT,projectId);
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:18080");
 assert.equal(config.firestore.rules,"firestore.rules");
 assert.equal(config.emulators.firestore.host,"127.0.0.1");
 assert(!JSON.stringify(config).includes("salonbook-pro-ad5ff"));
 const env=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:18080,rules}});
 t.after(async()=>{await env.cleanup()});
 const db=Object.fromEntries(owners.map(uid=>[uid,env.authenticatedContext(uid,{email_verified:true}).firestore()]));
 const unverified=env.authenticatedContext(owners[0],{email_verified:false}).firestore();
 const anonymous=env.unauthenticatedContext().firestore();
 const userPath=(uid,sub,docId)=>"users/"+uid+"/"+sub+"/"+docId;
 const businessPath=(uid,sub,docId)=>"businesses/"+uid+"/"+sub+"/"+docId;
 await env.withSecurityRulesDisabled(async ctx=>{
  const admin=ctx.firestore();
  for(const uid of owners){
   await setDoc(doc(admin,userPath(uid,"business","profile")),profile(uid));
   await setDoc(doc(admin,userPath(uid,"liveData","services")),{json:"[]",schemaVersion:1,updatedAt:Timestamp.now()});
   await setDoc(doc(admin,userPath(uid,"backups","latest")),{synthetic:true});
   await setDoc(doc(admin,businessPath(uid,"appointments","synthetic")),{synthetic:true});
   await setDoc(doc(admin,businessPath(uid,"conversations","synthetic")),{synthetic:true});
   await setDoc(doc(admin,userPath(uid,"customerBookingRequests","synthetic")),{synthetic:true});
  }
 });
 const check=(name,action,allowed)=>t.test(name,async()=>{const result=action();if(allowed)await assertSucceeds(result);else await assertFails(result)});
 for(const uid of owners){
  await check(uid+" verified owner can read own profile",()=>getDoc(doc(db[uid],userPath(uid,"business","profile"))),true);
  await check(uid+" verified owner can read own appointments",()=>getDoc(doc(db[uid],businessPath(uid,"appointments","synthetic"))),true);
 }
 const parallel=[];
 for(let i=0;i<owners.length;i++)for(let j=0;j<owners.length;j++)if(i!==j){
  const actor=owners[i],target=owners[j];
  parallel.push({name:actor+" cannot read "+target+" profile",action:()=>getDoc(doc(db[actor],userPath(target,"business","profile")))});
  parallel.push({name:actor+" cannot read "+target+" appointments",action:()=>getDoc(doc(db[actor],businessPath(target,"appointments","synthetic")))});
  parallel.push({name:actor+" cannot read "+target+" services",action:()=>getDoc(doc(db[actor],userPath(target,"liveData","services")))});
  parallel.push({name:actor+" cannot read "+target+" conversations",action:()=>getDoc(doc(db[actor],businessPath(target,"conversations","synthetic")))});
  parallel.push({name:actor+" cannot read "+target+" backup",action:()=>getDoc(doc(db[actor],userPath(target,"backups","latest")))});
  parallel.push({name:actor+" cannot overwrite "+target+" profile",action:()=>setDoc(doc(db[actor],userPath(target,"business","profile")),profile(target))});
  parallel.push({name:actor+" cannot update "+target+" profile",action:()=>updateDoc(doc(db[actor],userPath(target,"business","profile")),{name:"Attack"})});
  parallel.push({name:actor+" cannot delete "+target+" profile",action:()=>deleteDoc(doc(db[actor],userPath(target,"business","profile")))});
 }
 await t.test("simultaneous cross-owner requests are all denied",async sub=>{
  await Promise.all(parallel.map(item=>sub.test(item.name,async()=>{await assertFails(item.action())})));
 });
 const a=owners[0],b=owners[1];
 await check("owner cannot forge businessId of another owner in own profile",()=>setDoc(doc(db[a],userPath(a,"business","profile")),profile(b)),false);
 await check("owner cannot forge businessId through update",()=>updateDoc(doc(db[a],userPath(a,"business","profile")),{businessId:b}),false);
 await check("owner cannot enable live bookings in own profile",()=>updateDoc(doc(db[a],userPath(a,"business","profile")),{acceptingBookings:true}),false);
 await check("owner cannot inject unapproved profile fields",()=>updateDoc(doc(db[a],userPath(a,"business","profile")),{admin:true}),false);
 await check("owner cannot delete own profile",()=>deleteDoc(doc(db[a],userPath(a,"business","profile"))),false);
 await check("owner cannot write appointments directly",()=>setDoc(doc(db[a],businessPath(a,"appointments","synthetic")),{synthetic:false}),false);
 await check("owner cannot write conversations directly",()=>setDoc(doc(db[a],businessPath(a,"conversations","synthetic")),{synthetic:false}),false);
 await check("owner cannot write customer booking requests",()=>setDoc(doc(db[a],userPath(a,"customerBookingRequests","synthetic")),{synthetic:false}),false);
 await check("owner cannot read server-only customer booking requests",()=>getDoc(doc(db[a],userPath(a,"customerBookingRequests","synthetic"))),false);
 await check("unverified owner cannot read own private profile",()=>getDoc(doc(unverified,userPath(a,"business","profile"))),false);
 await check("unverified owner cannot read appointments",()=>getDoc(doc(unverified,businessPath(a,"appointments","synthetic"))),false);
 await check("anonymous cannot read private profile",()=>getDoc(doc(anonymous,userPath(a,"business","profile"))),false);
 await check("anonymous cannot list private profiles",()=>getDocs(collection(anonymous,"users",a,"business")),false);
 await check("owner cannot list another owner's private profiles",()=>getDocs(collection(db[a],"users",b,"business")),false);
 await check("verified owner can safely update own profile while booking stays disabled",()=>updateDoc(doc(db[a],userPath(a,"business","profile")),{name:"Synthetic Salon Updated"}),true);
 await check("verified owner can read own profile after denied attacks",()=>getDoc(doc(db[a],userPath(a,"business","profile"))),true);
});
