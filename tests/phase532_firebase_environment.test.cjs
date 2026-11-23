const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {inspectConfig,inspectFile}=require('../security/phase532-firebase-environment.cjs');
const root=path.resolve(__dirname,'..');
const prod=path.join(root,'app/google-services.json');
const synthetic=(id)=>({project_info:{project_id:id},client:[{client_info:{mobilesdk_app_id:'1:1035453677284:android:abcdef123456',android_client_info:{package_name:'com.salonbook.pro'}}}]});
test('tracked config is production only and must never pass staging check',()=>{
 assert.equal(inspectFile(prod,'production').ok,true);
 assert.equal(inspectFile(prod,'staging').ok,false);
});
test('synthetic staging config passes only correct environment',()=>{
 assert.equal(inspectConfig(synthetic('boustio-staging'),'staging').ok,true);
 assert.equal(inspectConfig(synthetic('boustio-staging'),'production').ok,false);
});
test('fail closed on missing, invalid and wrong client data',()=>{
 assert.equal(inspectFile('/not-present/staging.json','staging').ok,false);
 assert.equal(inspectConfig(synthetic('other-project'),'staging').ok,false);
 const wrong=synthetic('boustio-staging');wrong.client[0].client_info.android_client_info.package_name='com.other.app';
 assert.equal(inspectConfig(wrong,'staging').ok,false);
 assert.equal(inspectConfig(synthetic('boustio-staging'),'unknown').ok,false);
});
test('staging configuration is deliberately not bundled in repository',()=>{
 const fs=require('node:fs');
 assert.equal(fs.existsSync(path.join(root,'app/src/staging/google-services.json')),false);
});
test('seven release blockers remain open',()=>{
 const fs=require('node:fs');
 const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
 assert.equal(Object.keys(gates.gates).length,7);
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[k],false);
});
