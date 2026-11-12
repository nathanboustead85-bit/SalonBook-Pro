const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const rules = fs.readFileSync('firestore.rules','utf8');
test('manual client name is editable only without appointments',()=>{
 assert.match(source,/val editableName = input\("Client name", name\)/);
 assert.match(source,/editableName\.isEnabled = history\.isEmpty\(\)/);
 assert.match(source,/Cannot rename a client linked to appointments/);
});
test('rename prevents duplicate names and saves records and profile together',()=>{
 assert.match(source,/Another client already uses that name/);
 assert.match(source,/\.putString\("manual_clients", records\.toString\(\)\)/);
 assert.match(source,/\.putString\(newKey, data\.toString\(\)\)/);
 assert.match(source,/\.remove\(key\)/);
});
test('private client profile rules require verified owner and disallow deletes',()=>{
 assert.match(rules,/match \/users\/\{userId\}\/clientProfiles\/\{profileId\}/);
 assert.match(rules,/allow get: if isVerifiedOwner\(userId\)/);
 assert.match(rules,/allow list, delete: if false/);
 assert.match(rules,/profileId\.matches/);
});
