const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const rules=fs.readFileSync('firestore.rules','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
const evidence=require('../security/phase59-3-messaging-security.json');
const chat=rules.slice(rules.indexOf('match /businesses/{businessId}/conversations/{conversationId}'));
test('conversation and message client writes remain denied',()=>{
 assert.match(chat,/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\}/);
 assert.match(chat,/match \/messages\/\{messageId\}/);
 assert.equal((chat.match(/allow create, update, delete: if false;/g)||[]).length,2);
});
test('conversation and message reads require verified business owner',()=>{
 assert.equal((chat.match(/allow get, list: if isVerifiedOwner\(businessId\);/g)||[]).length,2);
 assert.match(rules,/request\.auth\.uid == userId/);
 assert.match(rules,/request\.auth\.token\.email_verified == true/);
});
test('chat rules retain final default deny',()=>{
 assert.match(chat,/match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
test('missing executable chat smoke dependencies are disclosed, not treated as green tests',()=>{
 const workflow=fs.readFileSync('.github/workflows/chat-emulator.yml','utf8');
 assert.match(workflow,/functions\/tests\/chat-emulator-smoke\.test\.js/);
 assert.equal(fs.existsSync('functions/tests/chat-emulator-smoke.test.js'),false);
 assert.equal(fs.existsSync('functions/package.json'),false);
 assert.equal(evidence.chatEmulatorSmokeWorkflowRunnable,false);
});
test('gates open, no deployment or production chat activation',()=>{
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 for(const k of ['liveBookings','payments','messaging','appCheckEnforcement','deployment','productionRestoreEnabled'])assert.equal(evidence[k],false,k);
 assert.equal(evidence.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(evidence.independentApproval,false);
});
