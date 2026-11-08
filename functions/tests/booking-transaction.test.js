"use strict";
/**
 * Phase 10.3 — booking engine transaction tests using a deterministic
 * Firestore-shaped in-memory fake. Not an emulator or deployed E2E test.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { createBooking } = require("../bookingEngine");

function fixture() {
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const day = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][
    new Date(date + "T12:00:00Z").getUTCDay()];
  const catalogue = {
    business: { ownerUid: "owner1", published: true, acceptingBookings: true },
    services: [{ id: "cut", name: "Cut", active: true, durationMinutes: 30, price: 20 }],
    staff: [{ id: "alex", name: "Alex", active: true, serviceIds: ["cut"],
      weeklySchedule: { [day]: { open: "09:00", close: "10:00" } } }]
  };
  const records = new Map();
  let sequence = 0;
  const db = {
    collection(name) {
      assert.equal(name, "businesses");
      return { doc(owner) {
        assert.equal(owner, "owner1");
        return { collection(kind) {
          return { doc(id) {
            const key = kind + "/" + (id || "generated-" + ++sequence);
            return { key, id: key.split("/")[1] };
          }};
        }};
      }};
    },
    async runTransaction(callback) {
      // Serialize test transactions like Firestore's conflict resolution.
      const writes = [];
      const tx = {
        async get(ref) { return { exists: records.has(ref.key) }; },
        create(ref, value) { writes.push([ref.key, value]); }
      };
      const result = await callback(tx);
      for (const [key] of writes) {
        if (records.has(key)) throw new Error("Already exists");
      }
      for (const [key, value] of writes) records.set(key, value);
      return result;
    }
  };
  const request = {
    businessId: "owner1", serviceId: "cut", staffId: "alex",
    date, startTime: "09:00", customerName: "Test Customer",
    customerEmail: "test@example.com", customerPhone: ""
  };
  return { db, catalogue, request, records };
}

test("confirmed booking writes appointment and both 15-minute locks", async () => {
  const f = fixture();
  const result = await createBooking(f);
  assert.equal(result.success, true);
  assert.equal(f.records.size, 3);
  assert.ok(f.records.has("bookingLocks/alex_" + f.request.date + "_0900"));
  assert.ok(f.records.has("bookingLocks/alex_" + f.request.date + "_0915"));
  const appointment = [...f.records.entries()].find(([key]) => key.startsWith("appointments/"))[1];
  assert.equal(appointment.source, "online");
  assert.equal(appointment.status, "confirmed");
  assert.equal(appointment.price, 20);
});

test("same start time is rejected and does not create another appointment", async () => {
  const f = fixture();
  await createBooking(f);
  await assert.rejects(createBooking(f), /already booked/);
  assert.equal([...f.records.keys()].filter(key => key.startsWith("appointments/")).length, 1);
});

test("partially overlapping appointment is rejected", async () => {
  const f = fixture();
  await createBooking(f);
  f.request = { ...f.request, startTime: "09:15" };
  await assert.rejects(createBooking(f), /already booked/);
});

test("adjacent non-overlapping appointment is allowed", async () => {
  const f = fixture();
  await createBooking(f);
  f.request = { ...f.request, startTime: "09:30" };
  await createBooking(f);
  assert.equal([...f.records.keys()].filter(key => key.startsWith("appointments/")).length, 2);
});

test("disabled business never creates records", async () => {
  const f = fixture();
  f.catalogue.business.acceptingBookings = false;
  await assert.rejects(createBooking(f), /not accepting bookings/);
  assert.equal(f.records.size, 0);
});

test("outside hours never creates records", async () => {
  const f = fixture();
  f.request = { ...f.request, startTime: "09:45" };
  await assert.rejects(createBooking(f), /outside working hours/);
  assert.equal(f.records.size, 0);
});
