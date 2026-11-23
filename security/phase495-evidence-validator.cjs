'use strict';
const crypto=require('node:crypto');
const REQUIRED=['admin-revocation','session-expiry','owner-isolation','credential-boundaries','staging-isolation','negative-tests','rollback-readiness'];
const HEX=/^[a-f0-9]{64}$/i;
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function validate(manifest,blobs={},options={}){
 const failures=[];
 if(!manifest||manifest.schemaVersion!==1||manifest.phase!=='49.5')failures.push('schema');
 if(!manifest||manifest.environment!=='isolated-demo-only')failures.push('environment');
 if(!manifest||manifest.independentApproval!==false)failures.push('approval-must-remain-false');
 const records=manifest?.records;
 if(!Array.isArray(records)||records.length!==REQUIRED.length)failures.push('record-count');
 const names=Array.isArray(records)?records.map(x=>x?.control):[];
 if(new Set(names).size!==REQUIRED.length||REQUIRED.some(x=>!names.includes(x)))failures.push('controls');
 for(const r of Array.isArray(records)?records:[]){
  if(!r||r.status!=='PENDING')failures.push('unapproved-status:'+r?.control);
  if(r?.sha256!==null||r?.sourceCommit!==null||r?.runUrl!==null||r?.verifiedAtUtc!==null)failures.push('unexpected-evidence:'+r?.control);
 }
 if(options.checkCandidate){
  const c=options.checkCandidate;
  if(!c.author||!c.reviewer||c.author===c.reviewer)failures.push('reviewer-independence');
  if(!HEX.test(c.digest||'')||!Object.hasOwn(blobs,c.control)||sha256(blobs[c.control])!==c.digest)failures.push('digest-integrity');
  if(!/^[a-f0-9]{40}$/i.test(c.commit||''))failures.push('commit-provenance');
  if(!/^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/[0-9]+$/.test(c.runUrl||''))failures.push('run-provenance');
  if(!c.negativeTestsPassed)failures.push('negative-tests');
  if(!c.restrictedStorageConfirmed)failures.push('restricted-evidence-storage');
  if(!c.signedDecision)failures.push('signed-review');
  if(!REQUIRED.includes(c.control))failures.push('unknown-control');
 }
 return {ok:failures.length===0,failures};
}
module.exports={validate,sha256};
