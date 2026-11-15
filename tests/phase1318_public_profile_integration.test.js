"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {createPublicBusinessProfileReader,createPublicBusinessHttpHandler}=require("../functions/phase1318PublicBusinessProfile");
function fixture(mapping,profile){
 const reads=[];
 const db={collection(name){return {doc(id){return {async get(){reads.push(name+"/"+id);const data=name==="businessSlugs"?mapping:profile;return {exists:!!data,get:k=>data?.[k]};}};}};}};
 return {db,reads};
}
(async()=>{
 let f=fixture({businessId:"owner_1"},{slug:"kody-blends",name:"Kody Blends",description:"Barbers",published:true,phone:"PRIVATE",acceptingBookings:true});
 const read=createPublicBusinessProfileReader(f.db);
 let result=await read("kody-blends");
 assert.equal(result.status,200);assert.deepEqual(result.body,{status:"PUBLIC_PROFILE_READY",business:{slug:"kody-blends",name:"Kody Blends",description:"Barbers",acceptingBookings:false}});
 assert.deepEqual(f.reads,["businessSlugs/kody-blends","publicBusinesses/owner_1"]);
 assert.ok(!JSON.stringify(result).includes("PRIVATE"));
 assert.equal((await read("BAD!")).status,400);
 f=fixture({businessId:"owner_1"},{slug:"kody-blends",name:"Kody Blends",published:false});
 assert.equal((await createPublicBusinessProfileReader(f.db)("kody-blends")).status,404);
 f=fixture({businessId:"owner_1"},{slug:"another",name:"Kody Blends",published:true});
 assert.equal((await createPublicBusinessProfileReader(f.db)("kody-blends")).status,404);
 f=fixture(null,null);assert.equal((await createPublicBusinessProfileReader(f.db)("kody-blends")).status,404);
 f=fixture({businessId:"owner_1"},{slug:"kody-blends",name:"Kody Blends",published:true});
 const handler=createPublicBusinessHttpHandler(f.db);
 const res=()=>({status(n){this.code=n;return this;},set(){return this;},json(b){this.body=b;return this;}});
 let reply=res();await handler({method:"POST",query:{business:"kody-blends"}},reply);assert.equal(reply.code,405);
 reply=res();await handler({method:"GET",query:{business:"kody-blends",extra:"x"}},reply);assert.equal(reply.code,400);
 const index=fs.readFileSync(require.resolve("../functions/index.js"),"utf8");
 assert.match(index,/exports\.getPublicBusinessProfile = onRequest/);
 const hosting=JSON.parse(fs.readFileSync(require.resolve("../firebase.json"),"utf8"));
 assert.equal(hosting.hosting.rewrites[0].function.functionId,"getPublicBusinessProfile");
 const page=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 assert.ok(page.includes("/api/public-business?business="));assert.ok(page.includes('ui.bookingContent.classList.add("hidden")'));
 console.log("PASS Phase 13.18 live profile read, public-only fields, fail-closed checks and hosting integration");
})().catch(e=>{console.error(e);process.exitCode=1});
