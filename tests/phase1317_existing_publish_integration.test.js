"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {preparePublicSlugMapping,prepareUnpublishMapping}=require("../functions/phase1317PublicSlugMapping");
function fixture(documents={}){
 const writes=[],reads=[];
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};}};
 const tx={async get(ref){reads.push(ref.path);const value=documents[ref.path];return {exists:!!value,data:()=>value};},set(ref,value){writes.push({type:"set",path:ref.path,value});},delete(ref){writes.push({type:"delete",path:ref.path});}};
 return {db,tx,writes,reads};
}
(async()=>{
 let f=fixture();
 let mapping=await preparePublicSlugMapping(f.db,f.tx,{uid:"owner",slug:"kody",previousSlug:null});
 assert.equal(mapping.status,"READY");assert.equal(f.writes.length,0);mapping.apply();
 assert.deepEqual(f.writes,[{type:"set",path:"publicSlugMappings/kody",value:{slug:"kody",businessId:"owner",published:true}}]);
 f=fixture({"publicSlugMappings/kody":{slug:"kody",businessId:"attacker",published:true}});
 mapping=await preparePublicSlugMapping(f.db,f.tx,{uid:"owner",slug:"kody"});assert.equal(mapping.status,"SLUG_TAKEN");assert.equal(f.writes.length,0);
 f=fixture({"publicSlugMappings/old":{slug:"old",businessId:"owner",published:true}});
 mapping=await preparePublicSlugMapping(f.db,f.tx,{uid:"owner",slug:"new",previousSlug:"old"});mapping.apply();
 assert.ok(f.writes.some(w=>w.type==="delete"&&w.path==="publicSlugMappings/old"));
 f=fixture({"publicSlugMappings/old":{slug:"old",businessId:"another",published:true}});
 mapping=await preparePublicSlugMapping(f.db,f.tx,{uid:"owner",slug:"new",previousSlug:"old"});mapping.apply();
 assert.ok(!f.writes.some(w=>w.type==="delete"));
 f=fixture({"publicSlugMappings/kody":{slug:"kody",businessId:"owner",published:true}});
 const disable=await prepareUnpublishMapping(f.db,f.tx,{uid:"owner",slug:"kody"});disable();
 assert.deepEqual(f.writes,[{type:"set",path:"publicSlugMappings/kody",value:{slug:"kody",businessId:"owner",published:false}}]);
 f=fixture({"publicSlugMappings/kody":{slug:"kody",businessId:"other",published:true}});
 (await prepareUnpublishMapping(f.db,f.tx,{uid:"owner",slug:"kody"}))();assert.equal(f.writes.length,0);
 const index=fs.readFileSync(require.resolve("../functions/index.js"),"utf8");
 assert.match(index,/preparePublicSlugMapping\(db, transaction/);
 assert.match(index,/prepareUnpublishMapping\(db, transaction/);
 assert.match(index,/publicMapping\.apply\(\)/);
 console.log("PASS Phase 13.17 atomic publish, collision, rename and unpublish integration");
})().catch(e=>{console.error(e);process.exitCode=1});
