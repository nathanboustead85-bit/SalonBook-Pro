"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {auditPhase43}=require("../web/phase43/final-audit-43-5");
const {createAppCheckPolicy}=require("../web/phase43/app-check-policy-43-3");
const {createSecureDashboardRecovery}=require("../web/phase43/secure-dashboard-recovery-43-4");
const now=Date.now(),s=Math.floor(now/1000),config={mode:"EMULATOR_ONLY",projectId:"demo-boustio-phase43-5",firestoreHost:"127.0.0.1:18080",authHost:"127.0.0.1:19099",allowNetwork:false,allowWrites:false,allowDeploy:false};
const identity={uid:"owner43",email_verified:true,iat:s-100,auth_time:s-200,exp:s+600,firebase:{sign_in_provider:"password"}};
const app={appId:"synthetic-approved",iat:s-30,exp:s+300};
const req={uid:"owner43",idToken:"synthetic-id",appCheckToken:"synthetic-app",replayKey:"synthetic_nonce_0000000001"};
function policy(o={}){return createAppCheckPolicy({config,approvedAppIds:["synthetic-approved"],verifyIdToken:async()=>identity,verifyAppCheckToken:async()=>app,consumeReplayKey:async()=>true,now:()=>now,...o})}
test("complete isolated audit reports all seven blockers OPEN",()=>{const r=auditPhase43();assert.equal(r.status,"ISOLATED_AUDIT_CHECKS_PASSED",JSON.stringify(r.failures));assert.equal(r.blockers.length,7);assert.ok(r.blockers.every(b=>b.status==="OPEN"));assert.equal(r.sourceCount,4);assert.equal(r.regressionFileCount,8)});
test("audit never approves staging, deployment or live capabilities",()=>{const r=auditPhase43();for(const key of ["stagingConnected","stagingApproved","productionReady","migrationApproved","crossDeviceRevisionVerified","canBook","canPay","canMessage","canDeploy"])assert.equal(r[key],false)});
test("revocation failures and cross-account identity reject access",async()=>{for(const verifyIdToken of [async()=>{throw Error("revoked")},async()=>({...identity,uid:"other"})]){const g=policy({verifyIdToken});assert.equal((await g.verify(req)).status,"DENIED");g.stop()}});
test("unapproved App Check and replay denial reject access",async()=>{for(const opts of [{verifyAppCheckToken:async()=>({...app,appId:"unapproved"})},{consumeReplayKey:async()=>false}]){const g=policy(opts);assert.equal((await g.verify(req)).status,"DENIED");g.stop()}});
test("offline verifier and unknown replay store outcomes reject access",async()=>{for(const opts of [{verifyAppCheckToken:async()=>{throw Error("offline")}},{consumeReplayKey:async()=>undefined}]){const g=policy(opts);assert.equal((await g.verify(req)).status,"DENIED");g.stop()}});
test("invalidation rejects delayed authentication",async()=>{let release;const wait=new Promise(r=>release=r);const g=policy({verifyIdToken:()=>wait});const pending=g.verify(req);g.invalidate();release(identity);assert.equal((await pending).status,"DENIED");g.stop()});
test("read-only dashboard composition never exposes write capabilities",()=>{const auth={currentUser:null},sdk={auth,doc:()=>{},runTransaction:async()=>{},onAuthStateChanged:()=>()=>{}};const guard=createSecureDashboardRecovery({config,environment:config,sdk,db:{},credentials:async()=>null,verifyRevocation:async()=>false,approvedAppIds:["synthetic-approved"],verifyIdToken:async()=>identity,verifyAppCheckToken:async()=>app,consumeReplayKey:async()=>false,now:()=>now});for(const k of ["canBook","canPay","canMessage","canDeploy","stagingApproved"])assert.equal(guard[k],false);guard.stop()});
