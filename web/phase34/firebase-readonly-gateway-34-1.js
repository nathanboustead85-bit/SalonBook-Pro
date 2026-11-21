"use strict";
// Phase 34.1: injected, read-only Firebase-like gateway; NO SDK initialization or live access.
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validTime=x=>Number.isSafeInteger(x)&&x>=0;
const fail=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,documents:Object.freeze([])});
const PATHS=Object.freeze(["businesses/{uid}","users/{uid}/liveData/services","users/{uid}/liveData/staff"]);
function createReadOnlyGateway(adapter){
 // Accept only an explicit isolated test adapter; never accept a Firestore SDK object.
 if(!adapter||adapter.kind!=="isolated-read-only-test-adapter"||typeof adapter.readDocument!=="function"||
    Object.keys(adapter).some(k=>!["kind","readDocument"].includes(k)))throw new TypeError("isolated_read_only_adapter_required");
 async function readOwnerDocuments(auth,now){
  if(!auth||!id(auth.uid)||auth.emailVerified!==true||!validTime(now)||!Number.isSafeInteger(auth.expiresAt)||auth.expiresAt<=now)return fail("unauthorized_or_expired");
  const uid=auth.uid;
  const paths=PATHS.map(p=>p.replace("{uid}",uid));
  const docs=[];
  try{
   for(const path of paths){
    const doc=await adapter.readDocument(path);
    if(!doc||doc.exists!==true||doc.ownerId!==uid||doc.path!==path||!validTime(doc.updatedAt)||doc.updatedAt>now||
       !Number.isSafeInteger(doc.revision)||doc.revision<0||doc.data===null||typeof doc.data!=="object"||Array.isArray(doc.data))return fail("missing_or_invalid_owner_document");
    docs.push(Object.freeze({path,ownerId:uid,revision:doc.revision,updatedAt:doc.updatedAt,data:Object.freeze({...doc.data})}));
   }
  }catch{return fail("read_failed")}
  if(docs.some(d=>d.revision!==docs[0].revision))return fail("mixed_revision");
  return Object.freeze({status:"ISOLATED_READ_ONLY",reason:null,bookingEnabled:false,editingEnabled:false,documents:Object.freeze(docs)});
 }
 return Object.freeze({readOwnerDocuments});
}
module.exports=Object.freeze({createReadOnlyGateway,PATHS});
