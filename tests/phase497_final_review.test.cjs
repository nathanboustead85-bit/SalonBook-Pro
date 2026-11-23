'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const review=json('security/phase497-final-review.json'),gates=json('security/phase494-gates.json'),manifest=json('security/phase495-evidence-manifest.json'),staging=json('security/phase496-staging-readiness.json');
const {validateReview}=require('../security/phase497-review-guard.cjs');
const check=r=>validateReview(r,gates,manifest,staging);
test('consolidated review remains pending and cannot approve launch',()=>{const x=check(review);assert.equal(x.preparationSafe,true);assert.equal(x.independentApproval,false);assert.equal(x.launchAuthorized,false);});
test('premature reviewer assignment, approvals and risk closures fail closed',()=>{
 const changes=[r=>r.reviewStatus='APPROVED',r=>r.securityDecision='PASS',r=>r.independentReviewer='self',r=>r.ownerAuthorization='GRANTED',r=>r.stagingExecution='AUTHORIZED',r=>r.blockerClosureAuthorized=true,r=>r.outstandingRisks[0].status='CLOSED',r=>r.requiredControls.pop(),r=>r.launchBlockers='CLOSED',r=>r.androidAppointments='modify',...['liveBookings','payments','messaging','deployment'].map(k=>r=>r[k]=true)];
 for(const change of changes){const copy=structuredClone(review);change(copy);assert.equal(check(copy).preparationSafe,false);}
});
test('missing upstream evidence or closed blocker is rejected',()=>{
 const g=structuredClone(gates);g.launchBlockers[0].status='CLOSED';assert.equal(validateReview(review,g,manifest,staging).preparationSafe,false);
 const m=structuredClone(manifest);m.records[0].status='VERIFIED';assert.equal(validateReview(review,gates,m,staging).preparationSafe,false);
 const s=structuredClone(staging);s.authorizedStagingExecution=true;assert.equal(validateReview(review,gates,manifest,s).preparationSafe,false);
});
test('independent review documentation records unresolved security requirements',()=>{
 const doc=fs.readFileSync(path.join(root,'docs/security/phase-49-7-final-review-package.md'),'utf8');
 for(const term of ['independent reviewer','revokeRefreshTokens','verifyIdToken','Admin SDK bypasses Firestore Rules','rollback','seven launch blockers','two original Android appointments'])assert.ok(doc.toLowerCase().includes(term.toLowerCase()),term);
});
test('CI is read-only and cannot deploy',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-497-final-review.yml'),'utf8');
 assert.match(wf,/contents: read/);assert.doesNotMatch(wf,/firebase deploy|secrets\.|pull_request_target|id-token: write|contents: write/);
});
