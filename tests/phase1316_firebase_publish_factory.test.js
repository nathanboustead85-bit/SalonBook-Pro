"use strict";
const assert=require("node:assert/strict");
const {createFirebasePublishFunction}=require("../backend/phase1316/firebasePublishFunctionFactory");
const origin="https://boustio.co.uk";
function harness(){
 let registered,authCalls=0,keys=[];
 const onRequest=(options,fn)=>{registered={options,fn};return fn;};
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};},async runTransaction(fn){return fn({
 async get(ref){const data=ref.path==="publicBusinesses/owner_1"?{published:true,slug:"kody-blends"}:null;return {exists:!!data,data:()=>data};},
 create(){},set(){}});}};
 const auth={async verifyIdToken(){authCalls++;return {uid:"owner_1",email_verified:true};}};
 const limiter={async consume(key){keys.push(key);return {allowed:true};}};
 const config={onRequest,db,auth,limiter,clientKey:async()=> "trusted-gateway-1",allowedOrigins:[origin],enabled:true};
 const response=()=>({headers:{},status(n){this.code=n;return this;},set(k,v){this.headers[k]=v;return this;},json(body){this.body=body;return this;}});
 return {config,response,get registered(){return registered;},get authCalls(){return authCalls;},keys};
}
(async()=>{
 const h=harness();
 assert.throws(()=>createFirebasePublishFunction({...h.config,enabled:false}),/disabled/);
 assert.throws(()=>createFirebasePublishFunction({...h.config,limiter:null}),/limiter/);
 assert.throws(()=>createFirebasePublishFunction({...h.config,clientKey:null}),/adapter/);
 const fn=createFirebasePublishFunction(h.config);
 assert.equal(h.registered.options.cors,false);
 const raw=Buffer.from('{"slug":"kody-blends"}');
 const req={method:"POST",headers:{origin,"content-type":"application/json",authorization:"Bearer "+"x".repeat(30)},rawBody:raw};
 let res=h.response();await fn(req,res);
 assert.equal(res.code,200);assert.equal(res.body.status,"MAPPED");assert.deepEqual(h.keys,["publish-link:trusted-gateway-1"]);assert.equal(h.authCalls,1);
 res=h.response();await fn({...req,headers:{...req.headers,origin:"https://evil.example"}},res);
 assert.equal(res.code,403);assert.equal(h.authCalls,1);
 const bad=createFirebasePublishFunction({...h.config,clientKey:async()=>{throw Error("private error");}});
 res=h.response();await bad(req,res);assert.equal(res.code,503);assert.equal(res.body.status,"SERVICE_UNAVAILABLE");assert.ok(!JSON.stringify(res.body).includes("private"));
 console.log("PASS Phase 13.16 deployment gate, Firebase wiring, trusted limiter and error safety");
})().catch(e=>{console.error(e);process.exitCode=1});
