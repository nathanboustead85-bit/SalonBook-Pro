'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'security/phase501-staging-inventory.json'),'utf8'));
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase494-gates.json'),'utf8'));
const review=JSON.parse(fs.readFileSync(path.join(root,'security/phase497-final-review.json'),'utf8'));
function validate(s){const errors=[];
 if(s.phase!=='50.1'||s.status!=='DISCOVERY_ONLY')errors.push('mode');
 for(const k of ['ownerAuthorization','stagingProjectCreated','independentReviewerAssigned','iamVerified','billingGuardrailsVerified','dataIsolationVerified','credentialsProvisioned','realStagingTestsAuthorized','liveBookings','payments','messaging','deployment'])if(s[k]!==false)errors.push(k);
 for(const k of ['stagingProjectId','productionProjectId'])if(s[k]!==null)errors.push(k);
 if(s.launchBlockers!=='ALL_SEVEN_OPEN'||s.androidAppointments!=='preserve-existing-two')errors.push('safety');
 return errors;
}
test('inventory records discovery only and no staging access',()=>assert.deepEqual(validate(inventory),[]));
test('unauthorized environment setup and feature enablement fail closed',()=>{
 for(const k of ['ownerAuthorization','stagingProjectCreated','independentReviewerAssigned','iamVerified','billingGuardrailsVerified','dataIsolationVerified','credentialsProvisioned','realStagingTestsAuthorized','liveBookings','payments','messaging','deployment']){const copy=structuredClone(inventory);copy[k]=true;assert.ok(validate(copy).includes(k));}
});
test('seven blockers still open, independent review not approved',()=>{
 assert.equal(gates.launchBlockers.length,7);
 assert.ok(gates.launchBlockers.every(b=>b.status==='OPEN'&&b.approval===null));
 assert.equal(review.securityDecision,'PENDING');
 assert.equal(review.stagingExecution,'NOT_AUTHORIZED');
});
test('unfound paths are reported as unknown, not absence of Firebase',()=>{
 assert.equal(inventory.repositoryFindings.rootFirebaseJson,'NOT_FOUND');
 assert.match(inventory.repositoryFindings.interpretation,/may exist elsewhere/);
});
test('workflow read-only, no cloud authentication or deployment',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-501-staging-inventory.yml'),'utf8');
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/firebase deploy|google-github-actions\/auth|secrets\.|pull_request_target|id-token: write|contents: write/);
});
