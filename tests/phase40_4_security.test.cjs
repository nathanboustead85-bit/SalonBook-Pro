"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createSecureRecovery}=require("../web/phase40/secure-recovery-40-4");
const now=Date.now();
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const token=id=>({claims:{user_id:id,email_verified:true},expirationTime:new Date(now+60000).toISOString()});
function setup(verifyRevocation=async()=>true){
 const auth={currentUser:{uid:"owner40",emailVerified:true,async getIdTokenResult(){return token("owner40")}}};
 let callback,stopped=false;
 const vm={subscribe(fn){callback=fn;fn({state:"UNAVAILABLE"});return()=>{callback=null}},userChanged(){},signOut(){callback?.({state:"UNAVAILABLE",reason:"signed_out"})},networkUnavailable(){callback?.({state:"UNAVAILABLE",reason:"network_unavailable"})},async refresh(){return {state:"READY",business:{name:"Synthetic Salon"}}},stop(){stopped=true}};
 const guard=createSecureRecovery({auth,viewModel:vm,verifyRevocation,now:()=>now});
 return {auth,vm,guard,stopped:()=>stopped};
}
test("verified synthetic token and revocation check permits only read-only view",async()=>{const {guard}=setup();assert.equal((await guard.refresh()).state,"READY");assert.equal(guard.canBook,false);guard.stop()});
test("revoked, unknown or failed revocation check fails closed",async()=>{for(const verifier of [async()=>false,async()=>null,async()=>{throw Error("unavailable")}]){const {guard}=setup(verifier);assert.equal((await guard.refresh()).state,"UNAVAILABLE");assert.equal(guard.snapshot().business,null);guard.stop()}});
test("expired, malformed, wrong owner and unverified token claims rejected",async()=>{for(const bad of [{...token("owner40"),expirationTime:new Date(now-1).toISOString()},token("other40"),{claims:{user_id:"owner40",email_verified:false},expirationTime:new Date(now+60000).toISOString()},null]){const {guard,auth}=setup();auth.currentUser.getIdTokenResult=async()=>bad;assert.equal((await guard.refresh()).state,"UNAVAILABLE");guard.stop()}});
test("offline clears data and reconnect requires fresh revocation check",async()=>{let allowed=true,calls=0;const {guard}=setup(async()=>{calls++;return allowed});assert.equal((await guard.refresh()).state,"READY");guard.networkUnavailable();assert.equal(guard.snapshot().business,null);allowed=false;assert.equal((await guard.networkRestored()).state,"UNAVAILABLE");assert.equal(calls,2);guard.stop()});
test("sign out during pending revocation cannot resurrect business",async()=>{const d=deferred(),{guard,auth}=setup(()=>d.promise);const pending=guard.refresh();await Promise.resolve();auth.currentUser=null;guard.signOut();d.resolve(true);await pending;assert.equal(guard.snapshot().state,"UNAVAILABLE");guard.stop()});
test("account switch during pending verification invalidates old owner",async()=>{const d=deferred(),{guard,auth}=setup(()=>d.promise);const pending=guard.refresh();await Promise.resolve();auth.currentUser={uid:"other40",emailVerified:true,async getIdTokenResult(){return token("other40")}};guard.accountChanged(auth.currentUser);d.resolve(true);await pending;assert.equal(guard.snapshot().business,null);guard.stop()});
test("background and foreground revalidate",async()=>{let calls=0;const {guard}=setup(async()=>{calls++;return true});await guard.refresh();guard.background();assert.equal(guard.snapshot().state,"UNAVAILABLE");await guard.foreground();assert.equal(guard.snapshot().state,"READY");assert.equal(calls,2);guard.stop()});
test("stop prevents late verification and tears down view model",async()=>{const d=deferred(),{guard,stopped}=setup(()=>d.promise);const pending=guard.refresh();await Promise.resolve();guard.stop();d.resolve(true);await pending;assert.equal(stopped(),true);assert.equal(guard.snapshot().state,"UNAVAILABLE")});
test("no trusted revocation verifier is rejected",()=>{assert.throws(()=>createSecureRecovery({auth:{},viewModel:{refresh(){},subscribe(){}},verifyRevocation:null}),/isolated_recovery_dependencies_required/)});
