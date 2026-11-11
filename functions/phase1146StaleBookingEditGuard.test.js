"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const cloud=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
const app=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
test("11.46 cloud edits require last acknowledged identical server booking",()=>{
 assert.match(cloud,/private fun assertNoStaleBookingEdits/);
 assert.match(cloud,/trusted != null && trusted\[id\]\?\.toString\(\) == serverBooking\.toString\(\)/);
 assert.match(cloud,/assertNoStaleBookingEdits\(preflight\.getString\("json"\), json, acknowledgedBookingsJson\)/);
 assert.match(cloud,/assertNoStaleBookingEdits\(latest\.getString\("json"\), json, acknowledgedBookingsJson\)/);
 assert.match(cloud,/transaction\.set\(reference, data\)/);
});
test("11.46 owner-scoped baseline stored only on acknowledged same-snapshot upload",()=>{
 const save=app.slice(app.indexOf("private fun saveBookings()"),app.indexOf("private fun loadBookings()"));
 assert.match(save,/bookingSyncAcknowledgedOwner/);
 assert.match(save,/bookingSyncAcknowledgedJson/);
 assert.match(save,/if \(result\.isSuccess\)/);
 assert.match(save,/getString\("bookings", null\) == json/);
 assert.match(save,/takeIf \{ it == ownerAtSave\.uid \}/);
});
