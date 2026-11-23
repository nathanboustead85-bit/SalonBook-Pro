'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const FIELDS=['bookings','services','staff'];
function parseEnvelope(envelope){
 if(!envelope||envelope.schemaVersion!==1)throw Error('Unsupported backup schema');
 const result={};
 for(const field of FIELDS){
  const raw=envelope[field];
  if(typeof raw!=='string'||raw.length>500000)throw Error('Invalid '+field+' field');
  let data;
  try{data=JSON.parse(raw)}catch{throw Error('Malformed '+field+' JSON')}
  if(!Array.isArray(data))throw Error('Expected '+field+' array');
  result[field]=data;
 }
 const ids=new Set();
 for(const item of result.bookings){
  if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Duplicate or invalid booking id');
  ids.add(item.id);
 }
 return result;
}
function readLocal(filename){return JSON.parse(fs.readFileSync(filename,'utf8'))}
function restoreSynthetic(filename,envelope,{failAt}={}){
 const recovered=parseEnvelope(envelope); // validate before touching any file
 const dir=path.dirname(filename);
 const temporary=path.join(dir,'.boustio-restore-'+crypto.randomUUID()+'.tmp');
 let written=false;
 try{
  fs.writeFileSync(temporary,JSON.stringify(recovered),{flag:'wx',mode:0o600});
  written=true;
  if(failAt==='beforeCommit')throw Error('Simulated interruption before commit');
  fs.renameSync(temporary,filename); // single-file atomic replacement on same filesystem
  written=false;
  return recovered;
 }finally{
  if(written&&fs.existsSync(temporary))fs.unlinkSync(temporary);
 }
}
module.exports={parseEnvelope,readLocal,restoreSynthetic};
