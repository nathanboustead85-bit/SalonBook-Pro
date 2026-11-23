const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
test('rules verification cannot be approved without actual emulator evidence',()=>{
 const x=JSON.parse(read('security/phase57-4-firestore-rules-evidence.json'));
 assert.equal(x.status,'BLOCKED_MISSING_RULES');
 assert.equal(x.emulatorEvidence,'NOT_EXECUTED');
 assert.equal(x.approval,'NOT_APPROVED');
 assert.equal(x.executionAuthorized,false);
 assert.ok(x.requiredTests.length>=7);
});
test('existing launch gates remain closed to deployment and original data protected',()=>{
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 const x=JSON.parse(read('security/phase57-4-firestore-rules-evidence.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const v of Object.values(g.gates)) assert.equal(v.status,'OPEN');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement']) {
  assert.equal(g[k],false);assert.equal(x[k],false);
 }
 assert.equal(x.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});
test('real rules presence is reported but never confused with verification',()=>{
 const x=JSON.parse(read('security/phase57-4-firestore-rules-evidence.json'));
 const rules=path.join(root,x.rulesPath);
 const config=path.join(root,x.firebaseConfigPath);
 if(fs.existsSync(rules)&&fs.existsSync(config)) {
  const cfg=JSON.parse(fs.readFileSync(config,'utf8'));
  assert.equal(typeof cfg.firestore?.rules,'string','Firebase config must specify reviewed rules path');
  assert.equal(path.normalize(cfg.firestore.rules),path.normalize(x.rulesPath));
 }
 assert.equal(x.emulatorEvidence,'NOT_EXECUTED');
});
test('report records the explicit evidence gap',()=>{
 const s=read('security/phase57-4-firestore-rules-verification.md');
 for(const term of ['BLOCKED','emulator','Console','DO_NOT_TOUCH','G1–G7'])
  assert.ok(s.includes(term),term);
});
