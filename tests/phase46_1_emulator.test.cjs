"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc}=require("firebase/firestore");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const {createIntegrityRecovery}=require("../web/phase45/integrity-recovery-45-4");
const {auditPhase45}=require("../web/phase45/final-audit-45-5");
const {assessLaunchGaps}=require("../web/phase46/readiness-gaps-46-1");
const PROJECT="demo-boustio-phase46-1",owner="owner46gaps",other="other46gaps",p=paths(owner),now=Date.now();
if(process.env.GCLOUD_PROJECT!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")throw Error("isolated_emulators_required");
let env;
test.before(async()=>{env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),p.profile),{businessId:owner,name:"Synthetic Integrity Salon",schemaVersion:1,acceptingBookings:false,updatedAt:new Date(now-1000),revision:2})})});
test.after(async()=>{if(env)await env.cleanup()});
const identity=uid=>({uid,emailVerified:true,revocationVerified:true,appCheckVerified:true,sessionActive:true,online:true});
const read=async uid=>{const snap=await getDoc(doc(env.authenticatedContext(uid,{email_verified:true}).firestore(),p.profile));const d=snap.data();return {business:{businessId:d.businessId,name:d.name,acceptingBookings:d.acceptingBookings},revision:d.revision,updatedAt:d.updatedAt.toMillis()}};
test("authorized synthetic owner data passes integrity gate",async()=>{const g=createIntegrityRecovery({read,now:()=>now});assert.equal((await g.refresh(owner,identity(owner))).status,"ISOLATED_INTEGRITY_READ_ONLY");g.stop()});
test("cross-owner Firestore read denied and app guard stays unavailable",async()=>{await assertFails(getDoc(doc(env.authenticatedContext(other,{email_verified:true}).firestore(),p.profile)));const g=createIntegrityRecovery({read,now:()=>now});assert.equal((await g.refresh(other,identity(other))).status,"UNAVAILABLE");assert.equal(g.snapshot().business,null);g.stop()});
test("anonymous and unverified users denied by Firebase rules",async()=>{await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),p.profile)));await assertFails(getDoc(doc(env.authenticatedContext(owner,{email_verified:false}).firestore(),p.profile)))});
test("synthetic owner reconnect revalidates and signout clears state",async()=>{const g=createIntegrityRecovery({read,now:()=>now});await g.refresh(owner,identity(owner));g.offline();assert.equal(g.snapshot().business,null);assert.equal((await g.reconnect(owner,identity(owner))).status,"ISOLATED_INTEGRITY_READ_ONLY");g.signOut();assert.equal(g.snapshot().business,null);g.stop()});
test("stale revision and corrupt owner fail closed against emulator fixture",async()=>{let revision=3;const g=createIntegrityRecovery({read:async uid=>({...await read(uid),revision}),now:()=>now});assert.equal((await g.refresh(owner,identity(owner))).status,"ISOLATED_INTEGRITY_READ_ONLY");revision=1;assert.equal((await g.refresh(owner,identity(owner))).reason,"revision_rollback");g.stop();const bad=createIntegrityRecovery({read:async uid=>({...await read(uid),business:{businessId:other,acceptingBookings:false}}),now:()=>now});assert.equal((await bad.refresh(owner,identity(owner))).status,"UNAVAILABLE");bad.stop()});
test("owner profile remains readable under existing verified owner rules",async()=>{assert.equal((await assertSucceeds(getDoc(doc(env.authenticatedContext(owner,{email_verified:true}).firestore(),p.profile)))).exists(),true)});

test("Phase 45 final staging audit retains all seven blockers and disables live capabilities",async()=>{const audit=auditPhase45();assert.equal(audit.status,"ISOLATED_AUDIT_CHECKS_PASSED",JSON.stringify(audit.failures));assert.equal(audit.blockers.length,7);assert.ok(audit.blockers.every(b=>b.status==="OPEN"));for(const k of ["stagingApproved","productionReady","canBook","canPay","canMessage","canDeploy"])assert.equal(audit[k],false);await assertFails(getDoc(doc(env.authenticatedContext(other,{email_verified:true}).firestore(),p.profile)))});

test("Phase 46.1 retains seven OPEN blockers and requires evidence beyond emulators",async()=>{const a=assessLaunchGaps();assert.equal(a.status,"ISOLATED_GAP_ASSESSMENT_COMPLETE",JSON.stringify(a.failures));assert.equal(a.openCount,7);assert.ok(a.gaps.every(x=>x.status==="OPEN"&&x.evidenceStatus==="MISSING"&&!x.approved));assert.equal(a.canDeploy,false);await assertFails(getDoc(doc(env.authenticatedContext(other,{email_verified:true}).firestore(),p.profile)))});
