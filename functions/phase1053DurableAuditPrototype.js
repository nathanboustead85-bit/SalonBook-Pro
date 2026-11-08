"use strict";
/** Phase 10.53: isolated filesystem-backed witness prototype. NOT production WORM. */
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {canonical}=require("./phase1043TrustedEmulatorEvidence");
const {evidenceOf}=require("./phase1051IndependentAuditWitness");
const {PROJECT}=require("./phase1040EmulatorLockedInitialization");
function deny(reason){throw Error("phase1053 audit denied: "+reason);}
function guard(){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)deny("demo emulators required");
}
function fingerprint(event){
 return crypto.createHash("sha256").update(canonical(evidenceOf(event))).digest("hex");
}
function createDurableAuditPrototype({directory}={}){
 guard();
 if(typeof directory!=="string"||!path.isAbsolute(directory))deny("absolute test directory required");
 const root=fs.realpathSync(directory);
 if(!fs.statSync(root).isDirectory())deny("test directory required");
 let available=true;
 const location=(businessId,approvalId)=>{
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(businessId||"")||
     !/^[A-Za-z0-9_-]{1,100}$/.test(approvalId||""))deny("invalid scope");
  return path.join(root,crypto.createHash("sha256").update(businessId+"\0"+approvalId).digest("hex")+".receipt");
 };
 const read=(businessId,approvalId)=>{
  const file=location(businessId,approvalId);
  let body;
  try{body=fs.readFileSync(file,{encoding:"utf8",flag:"r"});}
  catch(error){if(error.code==="ENOENT")deny("missing independent receipt");throw error;}
  let receipt;try{receipt=JSON.parse(body);}catch(_){deny("corrupt independent receipt");}
  if(receipt?.schemaVersion!==1||receipt.businessId!==businessId||
   receipt.approvalId!==approvalId||!(/^[a-f0-9]{64}$/).test(receipt.fingerprint))
   deny("invalid independent receipt");
  return receipt;
 };
 const check=()=>{guard();if(!available)deny("independent store unavailable");};
 return Object.freeze({
  setAvailable(value){available=value===true;},
  witness(event){
   check();
   const fp=fingerprint(event),file=location(event.businessId,event.approvalId);
   const record={schemaVersion:1,businessId:event.businessId,approvalId:event.approvalId,fingerprint:fp};
   // wx creates exactly once. Parallel writers cannot overwrite or reconcile by
   // merely trusting mutable Firestore records.
   let fd;
   try{fd=fs.openSync(file,"wx",0o600);}
   catch(error){if(error.code==="EEXIST")deny("receipt already exists");throw error;}
   try{fs.writeFileSync(fd,JSON.stringify(record));fs.fsyncSync(fd);}
   finally{fs.closeSync(fd);}
   return {witnessed:true,fingerprint:fp,productionWriteAllowed:false};
  },
  verify(event){
   check();
   const fp=fingerprint(event),receipt=read(event.businessId,event.approvalId);
   if(receipt.fingerprint!==fp)deny("independent receipt mismatch");
   return {verified:true,productionWriteAllowed:false};
  },
  reconcile(event){
   check();
   // Recovery is read-only and only accepts pre-existing independently recorded
   // receipts. Never mint a receipt from untrusted Firestore data.
   return this.verify(event);
  },
  inspect(businessId,approvalId){
   check();return Object.freeze({...read(businessId,approvalId)});
  }
 });
}
module.exports={createDurableAuditPrototype};
