"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditCalendarLocks } = require("../calendarLockAudit");
const date = "2026-11-18";
const booking = { id:"a1", staffId:"alex", date, startTime:"09:00", endTime:"09:30", status:"confirmed" };
const locks = [
  { id:"alex_2026-11-18_0900", appointmentId:"a1" },
  { id:"alex_2026-11-18_0915", appointmentId:"a1" }
];
test("complete shared locks reconcile", () => {
  assert.equal(auditCalendarLocks([booking], locks).reconciled, true);
});
test("missing Android lock blocks migration", () => {
  const result = auditCalendarLocks([booking], locks.slice(0,1));
  assert.equal(result.reconciled, false);
  assert.ok(result.issues.some(x=>x.reason==="missing-lock"));
});
test("overlapping appointments block migration", () => {
  const result = auditCalendarLocks([booking, { ...booking, id:"a2", startTime:"09:15", endTime:"09:45" }], locks);
  assert.ok(result.issues.some(x=>x.reason==="overlapping-appointments"));
});
test("wrong lock owner blocks migration", () => {
  const result = auditCalendarLocks([booking], [{ ...locks[0], appointmentId:"other" }, locks[1]]);
  assert.ok(result.issues.some(x=>x.reason==="wrong-lock-owner"));
});
test("orphan lock blocks migration", () => {
  const result = auditCalendarLocks([booking], [...locks, {id:"alex_2026-11-18_0930",appointmentId:"a2"}]);
  assert.ok(result.issues.some(x=>x.reason==="orphan-lock"));
});
test("cancelled appointments need no locks", () => {
  assert.equal(auditCalendarLocks([{...booking,status:"cancelled"}], []).reconciled,true);
});
