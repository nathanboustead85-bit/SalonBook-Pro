"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getTrustedAvailability } = require("../trustedAvailability");

function fixture({ reconciled = true, occupied = [], mode = "cloud" } = {}) {
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const day = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][
    new Date(date + "T12:00:00Z").getUTCDay()];
  const catalogue = {
    business: { ownerUid: "owner1", published: true, acceptingBookings: true },
    services: [{ id: "cut", active: true, durationMinutes: 30, price: 20 }],
    staff: [{ id: "alex", active: true, serviceIds: ["cut"], weeklySchedule: {
      [day]: { open: "09:00", close: "10:00" }
    }}]
  };
  const db = {
    collection(name) {
      assert.equal(name, "businesses");
      return { doc(id) {
        assert.equal(id, "owner1");
        return { collection(sub) {
          return { doc(key) {
            if (sub === "migrations") {
              assert.equal(key, "android-bookings-v1");
              return { get: async () => ({
                exists: reconciled,
                get: field => ({
                  status: reconciled ? "completed" : "pending",
                  verifiedFinalSync: reconciled, schemaVersion: 1,
                  businessId: "owner1", appointmentCount: 1, lockCount: 2
                })[field]
              }) };
            }
            if (sub === "settings") {
              assert.equal(key, "bookingMode");
              return { get: async () => ({
                exists: true,
                get: field => field === "mode" ? mode : undefined
              }) };
            }
            assert.equal(sub, "bookingLocks");
            return { id: key };
          }};
        }};
      }};
    },
    async getAll(...refs) {
      return refs.map(ref => ({ exists: occupied.includes(ref.id) }));
    }
  };
  return { db, businessId: "owner1", catalogue, serviceId: "cut", staffId: "alex", date };
}

test("migration not reconciled: fail closed", async () => {
  await assert.rejects(getTrustedAvailability(fixture({ reconciled: false })), /migration is incomplete/);
});
test("disabled business: fail closed", async () => {
  const f = fixture();
  f.catalogue.business.acceptingBookings = false;
  await assert.rejects(getTrustedAvailability(f), /Bookings are disabled/);
});
test("free starts follow duration and 15-minute grid", async () => {
  assert.deepEqual(await getTrustedAvailability(fixture()), ["09:00","09:15","09:30"]);
});
test("existing shared locks remove overlapping starts", async () => {
  const f = fixture({ occupied: ["alex_" + fixture().date + "_0915"] });
  assert.deepEqual(await getTrustedAvailability(f), ["09:30"]);
});
test("invalid dates are rejected", async () => {
  const f = fixture();
  f.date = "2026-02-30";
  await assert.rejects(getTrustedAvailability(f), /Invalid date/);
});
test("catalogue identity must match business", async () => {
  const f = fixture();
  f.catalogue.business.ownerUid = "someoneElse";
  await assert.rejects(getTrustedAvailability(f), /Bookings are disabled/);
});

test("legacy booking mode blocks availability despite migration marker", async () => {
  await assert.rejects(getTrustedAvailability(fixture({ mode: "legacy" })), /migration is incomplete/);
});
test("frozen booking mode blocks availability despite migration marker", async () => {
  await assert.rejects(getTrustedAvailability(fixture({ mode: "frozen" })), /migration is incomplete/);
});
