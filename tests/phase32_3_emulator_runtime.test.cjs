"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {validateEmulatorEnvironment}=require("../web/phase32/emulator-guard-32-2");
const root=path.resolve(__dirname,"..");
const project="demo-boustio-phase32-staging";
const cfg=JSON.parse(fs.readFileSync(path.join(root,"web/phase32/emulator-config-32-2.json"),"utf8"));
const emulator=JSON.parse(fs.readFileSync(path.join(root,"web/phase32/firebase.emulator-32-3.json"),"utf8"));
const timeout=()=>AbortSignal.timeout(10000);
test("static safety guard approves demo configuration",()=>{const x=validateEmulatorEnvironment(cfg,root,{});assert(x.approved);assert.equal(x.deployEnabled,false)});
test("emulator runtime config matches validated loopback ports",()=>{for(const name of ["firestore","auth"]){assert.equal(emulator.emulators[name].host,"127.0.0.1");assert.equal(emulator.emulators[name].port,cfg.emulators[name].port)}assert.equal(emulator.emulators.ui.enabled,false);assert.equal(emulator.emulators.singleProjectMode,true)});
test("emulator uses deny-all isolated rules, not production rules",()=>{assert.equal(emulator.firestore.rules,"firestore-deny-all-32-3.rules");const rulesPath=path.resolve(root,"web/phase32",emulator.firestore.rules);assert(fs.existsSync(rulesPath),"emulator security rules file must exist relative to firebase config");const rules=fs.readFileSync(rulesPath,"utf8");assert.match(rules,/allow read, write: if false/);assert(!rules.includes("isVerifiedOwner"))});
test("no production aliases in emulator configuration",()=>{const rc=JSON.parse(fs.readFileSync(path.join(root,".firebaserc"),"utf8"));assert(!Object.values(rc.projects).includes(project));assert(!JSON.stringify(emulator).includes("salonbook-pro-ad5ff"))});
test("Firestore emulator responds and denies anonymous document reads",async()=>{const url="http://127.0.0.1:18080/v1/projects/"+project+"/databases/(default)/documents/phase32_probe/probe";const r=await fetch(url,{signal:timeout()});assert.equal(r.status,403,"expected deny-all rules to reject reads; got "+r.status)});
test("Firestore emulator rejects anonymous writes",async()=>{const url="http://127.0.0.1:18080/v1/projects/"+project+"/databases/(default)/documents/phase32_probe?documentId=probe";const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fields:{test:{stringValue:"synthetic-only"}}}),signal:timeout()});assert.equal(r.status,403,"expected deny-all rules to reject writes; got "+r.status)});
const authEndpoint="http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key";
test("Authentication emulator accepts a synthetic demo-only signup",async()=>{
 const r=await fetch(authEndpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"phase32-smoke@example.test",password:"synthetic-password-123",returnSecureToken:true}),signal:timeout()});
 assert.equal(r.status,200,"expected Auth emulator synthetic signup; got "+r.status+" "+await r.text().catch(()=>"" ));
});
test("Authentication emulator returns synthetic identity in demo project",async()=>{
 const r=await fetch(authEndpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"phase32-second@example.test",password:"synthetic-password-456",returnSecureToken:true}),signal:timeout()});
 assert.equal(r.status,200,"synthetic signup failed");const body=await r.json();assert.equal(body.email,"phase32-second@example.test");assert(typeof body.localId==="string"&&body.localId.length>0);
});
test("runtime endpoints are loopback-only",()=>{assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:18080");assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,"127.0.0.1:19099");assert.equal(process.env.GCLOUD_PROJECT,project)});
