'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const handover=JSON.parse(read('security/phase59-20-messaging-handover.json'));
const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
test('all handover artifacts exist and are not placeholders',()=>{
 for(const file of Object.values(handover.artifacts)){assert.ok(fs.statSync(path.join(root,file)).size>100,file)}
});
test('real-world functionality is explicitly not represented as completed',()=>{
 for(const key of ['launchApproved','realDeviceVerified','realStagingVerified','independentSecurityApproved','customerChatConnected','businessInboxConnected','pushNotificationsDelivered','productionMessagingEnabled'])assert.equal(handover[key],false,key);
 assert.ok(handover.remaining.length>=6);
});
test('all seven independent launch gates are open and live services disabled',()=>{
 assert.deepEqual(Object.keys(gates.gates),['G1','G2','G3','G4','G5','G6','G7']);
 for(const gate of Object.values(gates.gates)){
  assert.equal(gate.status,'OPEN');assert.equal(gate.independentApproval,false);assert.equal(gate.realStagingEvidence,false);
 }
 assert.equal(gates.approval,'NOT_APPROVED');assert.equal(gates.mode,'offline-only');
 for(const key of ['messaging','deployment','payments','liveBookings','appCheckEnforcement'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
test('browser previews remain offline-only with no network or persistence',()=>{
 for(const file of ['web/chat/customer-chat.js','web/chat/business-inbox.js','web/chat/media-controls.js']){
  const source=read(file);
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|firebase|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source,/innerHTML/);
 }
});
test('backend remains emulator-bound and disabled by default',()=>{
 const backend=read('chat/backend.cjs'),inbox=read('chat/emulator-inbox-events.cjs'),session=read('chat/emulator-conversation-session.cjs');
 assert.match(backend,/enabled=false/);
 assert.match(inbox,/enabled=false/);assert.match(session,/enabled=false/);
 assert.match(inbox,/FIRESTORE_EMULATOR_REQUIRED/);assert.match(session,/FIRESTORE_EMULATOR_REQUIRED/);
});
test('Android upgrade safety is explicit and version must be verified before replacement',()=>{
 const gradle=read('app/build.gradle.kts');
 assert.match(gradle,/applicationId\s*=\s*"com\.salonbook\.pro"/);
 assert.match(gradle,/versionCode\s*=\s*2/);
 for(const key of ['neverUninstall','neverClearData','neverOverwriteWithoutVerifiedUpgrade','disposableTestApplicationIdSuffix'])assert.equal(handover.androidSafeguards[key],true);
 assert.equal(handover.androidSafeguards.installedOriginalAppointments,2);
});
