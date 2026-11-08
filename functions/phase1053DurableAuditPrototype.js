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
  try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink())deny("unsafe receipt file");
   body=fs.readFileSync(file,{encoding:"utf8",flag:"r"});}
  catch(error){if(error.code==="ENOENT")deny("missing independent receipt");throw error;}
  let receipt;try{receipt=JSON.parse(body);}catch(_){deny("corrupt independent receipt");}
  if(receipt?.schemaVersion!==1||receipt.businessId!==businessId||
   receipt.approvalId!==approvalId||!(/^[a-f0-9]{64}$/).test(receipt.fingerprint)||
   receipt.checksum!==crypto.createHash("sha256").update(canonical({schemaVersion:1,businessId,approvalId,fingerprint:receipt.fingerprint})).digest("hex"))
   deny("invalid independent receipt");
  return receipt;
 };
 const check=()=>{guard();if(!available)deny("independent store unavailable");};
 return Object.freeze({
  setAvailable(value){available=value===true;},
  witness(event){
   check();
   const fp=fingerprint(event),file=location(event.businessId,event.approvalId);
   const base={schemaVersion:1,businessId:event.businessId,approvalId:event.approvalId,fingerprint:fp};
   const record={...base,checksum:crypto.createHash("sha256").update(canonical(base)).digest("hex")};
   // Stage in a uniquely named, exclusive temporary file; fsync content, then
   // atomically publish via hard-link (fails if destination already exists).
   // A crash before publication leaves only a non-authoritative .pending file.
   const pending=path.join(root,"."+crypto.randomBytes(16).toString("hex")+".pending");
   let fd,linked=false;
   try{
    fd=fs.openSync(pending,"wx",0o600);
    fs.writeFileSync(fd,JSON.stringify(record));
    fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    try{fs.linkSync(pending,file);linked=true;}
    catch(error){if(error.code==="EEXIST")deny("receipt already exists");throw error;}
    const dirfd=fs.openSync(root,"r");
    try{fs.fsyncSync(dirfd);}finally{fs.closeSync(dirfd);}
   }finally{
    if(fd!==undefined)fs.closeSync(fd);
    try{fs.unlinkSync(pending);}catch(error){if(error.code!=="ENOENT")throw error;}
   }
   if(!linked)deny("receipt publication failed");
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
