"use strict";
const assert = require("node:assert/strict");
const { auditLegacyBookings } = require("../functions/legacyBookingAudit");
const booking = { id:"one", staffId:"staff-1", date:"2026-11-20",
  startTime:"09:00", durationMinutes:30 };
assert.equal(auditLegacyBookings(JSON.stringify([booking])).safe, true);
assert.equal(auditLegacyBookings([booking]).lockCount, 2);
assert.deepEqual(auditLegacyBookings([booking]).lockPlan.map(x=>x.lockId),
  ["staff-1_2026-11-20_0900","staff-1_2026-11-20_0915"]);
assert.equal(auditLegacyBookings([booking,{...booking,id:"two",startTime:"09:15"}]).lockPlan.length,0);
assert.equal(auditLegacyBookings([booking,{...booking}]).safe, false);
assert.equal(auditLegacyBookings([booking,{...booking,id:"two",startTime:"09:15"}]).collisions.length,1);
assert.equal(auditLegacyBookings([booking,{...booking,id:"two",startTime:"09:30"}]).safe,true);
assert.equal(auditLegacyBookings([{...booking,startTime:"bad"}]).safe,false);
assert.equal(auditLegacyBookings([{...booking,date:"2026-02-30"}]).safe,false);
assert.equal(auditLegacyBookings([{...booking,durationMinutes:0}]).safe,false);
assert.equal(auditLegacyBookings("not json").safe,false);
assert.equal(auditLegacyBookings([{id:"legacy",date:"2026-11-20",time:"09:00"}]).safe,false);
console.log("Read-only legacy booking audit regression checks passed");
