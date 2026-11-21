"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {validateEmulatorEnvironment}=require("../web/phase32/emulator-guard-32-2");
const root=path.resolve(__dirname,".."),fixture=()=>JSON.parse(fs.readFileSync(path.join(root,"web/phase32/emulator-config-32-2.json"),"utf8"));
const run=(c=fixture(),e={})=>validateEmulatorEnvironment(c,root,e);
test("isolated demo emulator configuration accepted without startup",()=>{const x=run();assert(x.approved);assert.equal(x.emulatorStartAllowed,false);assert.equal(x.deployEnabled,false)});
for(const [name,change] of [
 ["production project",c=>c.projectId="salonbook-pro-ad5ff"],
 ["reserved emulator alias",c=>c.projectId="demo-boustio-migration"],
 ["cloud project",c=>c.projectId="staging-boustio"],
 ["network enabled",c=>c.networkEnabled=true],
 ["deployment enabled",c=>c.deployEnabled=true],
 ["live bookings enabled",c=>c.liveBookings=true],
 ["payments enabled",c=>c.paymentsEnabled=true],
 ["messaging enabled",c=>c.messagingEnabled=true],
 ["external firestore host",c=>c.emulators.firestore.host="0.0.0.0"],
 ["external auth host",c=>c.emulators.auth.host="example.com"],
 ["duplicate port",c=>c.emulators.auth.port=c.emulators.firestore.port],
 ["privileged port",c=>c.emulators.firestore.port=80],
 ["invalid port type",c=>c.emulators.auth.port="9099"],
 ["emulator UI enabled",c=>c.emulators.uiEnabled=true],
 ["multi project mode",c=>c.emulators.singleProjectMode=false],
 ["extra emulator service",c=>c.emulators.functions={host:"127.0.0.1",port:5001}],
 ["invalid schema",c=>c.schemaVersion=2]
])test(name+" rejected",()=>{const c=fixture();change(c);assert.equal(run(c).approved,false)});
test("production environment override rejected",()=>assert(!run(fixture(),{FIREBASE_PROJECT_ID:"salonbook-pro-ad5ff"}).approved));
test("external firestore endpoint rejected",()=>assert(!run(fixture(),{FIRESTORE_EMULATOR_HOST:"example.com:8080"}).approved));
test("external auth endpoint rejected",()=>assert(!run(fixture(),{FIREBASE_AUTH_EMULATOR_HOST:"example.com:9099"}).approved));
test("matching loopback endpoints accepted",()=>assert(run(fixture(),{FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19099",FIREBASE_PROJECT_ID:"demo-boustio-phase32-staging"}).approved));
test("credentials rejected",()=>assert(!run(fixture(),{GOOGLE_APPLICATION_CREDENTIALS:"/tmp/key.json"}).approved));
test("missing configuration rejected",()=>assert(!run(null).approved));
test("configuration remains unchanged",()=>{const c=fixture(),before=JSON.stringify(c);run(c);assert.equal(JSON.stringify(c),before)});
test("production aliases unchanged",()=>{const rc=JSON.parse(fs.readFileSync(path.join(root,".firebaserc"),"utf8"));assert.equal(rc.projects.default,"salonbook-pro-ad5ff");assert.equal(rc.projects.production,"salonbook-pro-ad5ff")});
test("no SDK or network usage",()=>{const s=fs.readFileSync(require.resolve("../web/phase32/emulator-guard-32-2"),"utf8");for(const token of ["initializeApp(","getFirestore(","firebase-admin","XMLHttpRequest","execSync(","spawnSync("])assert(!s.includes(token))});
test("workflow does not run emulators or deploy",()=>{const w=fs.readFileSync(path.join(root,".github/workflows/boustio-phase32-2-emulator-validation.yml"),"utf8");for(const token of ["firebase deploy","firebase emulators:start","firebase emulators:exec","secrets.","id-token: write"])assert(!w.includes(token));assert(w.includes("contents: read"))});
