const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const evidence = fs.readFileSync(path.join(root,'docs/security/phase-51-staging-observations-2026-11-22.md'),'utf8');
const gates = JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
test('Staging observations retain scope and limitations',()=>{
 for(const term of ['user-provided screenshots','if it is the published rule set','Admin SDK','Email/Password','localhost','Unenforced','Upgrade project','Cloud Run','independent']) assert.ok(evidence.includes(term),term);
});
test('Every launch gate remains open with no deployment or activation',()=>{
 assert.equal(Object.keys(gates.gates).length,7);
 for(const g of Object.values(gates.gates)){assert.equal(g.status,'OPEN');assert.equal(g.independentApproval,false)}
 for(const key of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
