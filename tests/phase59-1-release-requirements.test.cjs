const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const config=fs.readFileSync('app/build.gradle.kts','utf8');
const req=require('../security/phase59-1-release-requirements.json');
const gates=require('../security/phase51-consolidated-gates.json');
test('release requirements include working chat and safe Android upgrade',()=>{
 assert.equal(req.requirements.messaging.requiredForCompletion,true);
 assert.equal(req.requirements.messaging.enabled,false);
 for(const phrase of ['60-second voice notes','photo attachments','notifications'])assert.ok(req.requirements.messaging.features.includes(phrase));
 assert.equal(req.requirements.androidUpgrade.requiredForCompletion,true);
 assert.equal(req.requirements.androidUpgrade.safeUpgradeApproved,false);
});
test('Android package and version facts reflect repository, not installed phone',()=>{
 assert.match(config,/applicationId = "com\.salonbook\.pro"/);
 assert.match(config,/versionCode = 2/);
 assert.match(config,/versionName = "0\.2\.0"/);
 assert.equal(req.requirements.androidUpgrade.installedPackageIdVerified,false);
 assert.equal(req.requirements.androidUpgrade.signingCertificateCompatibilityVerified,false);
});
test('independent approval absent, gates open and no live features enabled',()=>{
 assert.equal(req.independentSecurityApproval,'NOT_OBTAINED');
 assert.equal(req.productionApproval,'NOT_APPROVED');
 assert.deepEqual(Object.keys(req.gates).sort(),['G1','G2','G3','G4','G5','G6','G7']);
 for(const [key,gate] of Object.entries(gates.gates)){assert.equal(req.gates[key],'OPEN');assert.equal(gate.status,'OPEN');}
 for(const key of ['productionPreferencesTouched','productionRestoreEnabled','liveBookings','payments','messaging','appCheckEnforcement','deployment'])assert.equal(req[key],false,key);
 assert.equal(req.originalAndroidAppointments,'DO_NOT_TOUCH');
});
