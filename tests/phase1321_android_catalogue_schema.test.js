"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {project}=require("../functions/phase1320OwnerCataloguePublish");
const android=fs.readFileSync(require.resolve("../app/src/main/java/com/salonbook/pro/ManagementActivity.kt"),"utf8");
const cloud=fs.readFileSync(require.resolve("../app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
assert.match(android,/item\.put\(\s*"price",/);
assert.match(android,/item\.put\(\s*"duration",/);
assert.match(android,/item\.put\(\s*"publicVisible",/);
assert.match(android,/item\.put\("serviceIds",/);
assert.match(cloud,/JSONArray\(json\)/);
const services=[
 {id:"e0bbd0e2-a451-4f25-a6cd-22134bba1f66",name:"Haircut",price:"20.00",duration:30,publicVisible:true,internalNotes:"PRIVATE"},
 {id:"hidden",name:"Colour",price:"50.00",duration:90,publicVisible:false}
];
const staff=[
 {id:"1b8491a0-198b-40c3-916a-80d51e4b1734",name:"Kody",publicVisible:true,serviceIds:[services[0].id,"hidden"],weeklySchedule:{monday:{open:"09:00",close:"17:00"}},phone:"SECRET"},
 {id:"other",name:"Unlisted",publicVisible:false,serviceIds:[services[0].id]}
];
const result=project(services,staff);
assert.deepEqual(result,{services:[{id:services[0].id,name:"Haircut",pricePence:2000,durationMinutes:30}],staff:[{id:staff[0].id,name:"Kody",serviceIds:[services[0].id]}]});
assert.ok(!JSON.stringify(result).includes("PRIVATE"));assert.ok(!JSON.stringify(result).includes("SECRET"));
assert.equal(project([{...services[0],price:"20.999"}],staff),null);
assert.equal(project([{...services[0],duration:0}],staff),null);
assert.equal(project([{...services[0],publicVisible:false}],[]).services.length,0);
assert.equal(project(services,[{...staff[0],publicVisible:false}]).staff.length,0);
assert.equal(project([{...services[0],publicVisible:"true"}],[]).services.length,0);
console.log("PASS Phase 13.21 Android field contract, explicit public opt-in, privacy and price conversion");
