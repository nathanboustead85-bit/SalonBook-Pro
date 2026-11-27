const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('node:fs').readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
test('local loyalty plan validation and isolation',()=>{
 const m=s.slice(s.indexOf('private fun showLoyaltyPlans()'),s.indexOf('private fun showEmployeeDrafts()'));
 for(const token of ['local_loyalty_plan_v1','target !in 1..100','name.isBlank()','prefs.getString(key, null) != raw','Consent is unverified','Delivery is blocked','setNegativeButton("Cancel"']) assert.ok(m.includes(token),token);
 assert.doesNotMatch(m,/Firebase|https:|startActivity|saveBookings|client_records/);
});
