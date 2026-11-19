"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {optimisePhoto,ImageProcessingError,MAX_INPUT_BYTES,TARGETS}=require("../scripts/phase28-17-image-processor.cjs");
const jpeg=Buffer.from([255,216,255,...Array(40).fill(0)]);
const webp=Buffer.concat([Buffer.from("RIFF"),Buffer.alloc(4),Buffer.from("WEBP"),Buffer.alloc(30)]);
function fakeSharpFactory({meta={format:"jpeg",width:1200,height:900},out=webp,outputMeta={format:"webp",width:1100,height:825}}={}){
 const calls=[];let n=0;
 const sharp=(buf,opts)=>{calls.push({buf,opts});const index=n++;const chain={metadata:async()=>index===0?meta:outputMeta,rotate(){calls.push("rotate");return chain;},resize(w,h,o){calls.push({resize:[w,h],options:o});return chain;},webp(o){calls.push({webp:o});return chain;},toBuffer:async()=>out};return chain;};
 return {sharp,calls};
}
const run=(over={})=>optimisePhoto({buffer:jpeg,mimeType:"image/jpeg",kind:"service",enabled:true,environment:"isolated-test",sharp:fakeSharpFactory().sharp,...over});
async function errorCode(fn){try{await fn();return null;}catch(e){assert.ok(e instanceof ImageProcessingError);return e.code;}}
test("fails closed by default",async()=>assert.equal(await errorCode(()=>optimisePhoto({})), "PROCESSING_DISABLED"));
test("blocks production even when enabled",async()=>assert.equal(await errorCode(()=>run({environment:"production"})),"PROCESSING_DISABLED"));
test("rejects non-buffers",async()=>assert.equal(await errorCode(()=>run({buffer:"hello"})),"INVALID_INPUT_SIZE"));
test("rejects oversize inputs",async()=>assert.equal(await errorCode(()=>run({buffer:Buffer.alloc(MAX_INPUT_BYTES+1)})),"INVALID_INPUT_SIZE"));
test("rejects unsupported mime",async()=>assert.equal(await errorCode(()=>run({mimeType:"image/svg+xml"})),"SIGNATURE_MISMATCH"));
test("rejects MIME signature mismatch",async()=>assert.equal(await errorCode(()=>run({mimeType:"image/png"})),"SIGNATURE_MISMATCH"));
test("rejects invalid photo kind",async()=>assert.equal(await errorCode(()=>run({kind:"other"})),"INVALID_PHOTO_KIND"));
test("rejects missing image processor",async()=>assert.equal(await errorCode(()=>run({sharp:null})),"PROCESSOR_UNAVAILABLE"));
test("rejects invalid image dimensions",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({meta:{format:"jpeg",width:100,height:900}}).sharp})),"INVALID_DIMENSIONS"));
test("rejects huge pixel counts",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({meta:{format:"jpeg",width:7000,height:7000}}).sharp})),"INVALID_DIMENSIONS"));
test("rejects animation",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({meta:{format:"jpeg",width:1200,height:900,pages:2}}).sharp})),"ANIMATED_IMAGES_BLOCKED"));
test("rejects decoder MIME mismatch",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({meta:{format:"png",width:1200,height:900}}).sharp})),"DECODED_FORMAT_MISMATCH"));
test("re-encodes service image to webp without metadata preservation",async()=>{const f=fakeSharpFactory();const r=await run({sharp:f.sharp});assert.equal(r.mimeType,"image/webp");assert.equal(r.metadataStripped,true);assert.deepEqual(f.calls.find(x=>x.resize).resize,[1200,900]);assert.equal(f.calls.some(x=>x==="withMetadata"||x==="keepMetadata"),false);});
test("uses staff portrait dimensions",async()=>{const f=fakeSharpFactory({outputMeta:{format:"webp",width:800,height:800}});await run({sharp:f.sharp,kind:"staff"});assert.deepEqual(f.calls.find(x=>x.resize).resize,[800,800]);});
test("uses cover image dimensions",async()=>{const f=fakeSharpFactory({outputMeta:{format:"webp",width:1500,height:850}});await run({sharp:f.sharp,kind:"cover"});assert.deepEqual(f.calls.find(x=>x.resize).resize,[1600,900]);});
test("rejects oversized processed image",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({out:Buffer.concat([webp,Buffer.alloc(2*1024*1024)])}).sharp})),"INVALID_OUTPUT"));
test("rejects metadata surviving re-encode",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({outputMeta:{format:"webp",width:1100,height:825,exif:Buffer.from([1])}}).sharp})),"METADATA_NOT_STRIPPED"));
test("rejects output exceeding target dimensions",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({outputMeta:{format:"webp",width:2000,height:825}}).sharp})),"INVALID_OUTPUT"));
test("rejects invalid encoded output",async()=>assert.equal(await errorCode(()=>run({sharp:fakeSharpFactory({out:Buffer.from("not webp")}).sharp})),"INVALID_OUTPUT"));
test("prevents unhandled decoder failures",async()=>{const sharp=()=>({metadata:async()=>{throw Error("bad input")}});assert.equal(await errorCode(()=>run({sharp})),"INVALID_IMAGE_DATA");});
test("targets have strict mobile-friendly caps",()=>{assert.deepEqual(Object.keys(TARGETS),["service","staff","cover"]);assert.ok(TARGETS.cover.width<=1600);});
