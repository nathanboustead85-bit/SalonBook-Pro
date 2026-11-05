"use strict";

/**
 * BOUSTIO — PHASE 8D.78
 *
 * Transactional booking migration tests.
 * All migration calls use the verified route.
 *
 * EMULATOR ONLY — NEVER PRODUCTION.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const {
  migrateVerifiedAndroidBookings,
  MIGRATION_ID
} = require("./transactionalBookingMigration");

const {
  digestBookings
} = require("./finalBookingSyncVerifier");

const PROJECT_ID = "demo-boustio-migration";

if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.GCLOUD_PROJECT !== PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT !== PROJECT_ID
) {
  throw new Error(
    "Dedicated Firestore emulator required."
  );
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: PROJECT_ID
  });
}

const db = admin.firestore();
let counter = 0;

function uniqueOwner() {
  counter++;
  return (
    "migrationTest_" +
    process.pid + "_" +
    Date.now() + "_" +
    counter
  );
}

function booking(overrides = {}) {
  return {
    id: "booking1",
    client: "Test Client",
    service: "Haircut",
    serviceId: "service1",
    staffId: "staff1",
    date: "2026-11-12",
    time: "10:00",
    duration: 30,
    price: "20.00",
    notes: "",
    ...overrides
  };
}

function refs(owner) {
  const business = db
    .collection("businesses")
    .doc(owner);

  return {
    business,
    mode: business
      .collection("settings")
      .doc("bookingMode"),
    source: db
      .collection("users")
      .doc(owner)
      .collection("liveData")
      .doc("bookings"),
    appointments:
      business.collection("appointments"),
    locks:
      business.collection("bookingLocks"),
    marker: business
      .collection("migrations")
      .doc(MIGRATION_ID)
  };
}

async function seed(owner, bookings) {
  const r = refs(owner);

  await r.mode.set({
    mode: "frozen",
    schemaVersion: 1,
    updatedAt: new Date()
  });

  await r.source.set({
    schemaVersion: 1,
    json: JSON.stringify(bookings),
    updatedAt: new Date().toISOString()
  });

  return r;
}

/*
 * For emulator fixtures only:
 *
 * The test helper obtains a source hash.
 * This is NOT a production cutover protocol.
 *
 * Production must obtain its expectedHash
 * from a trusted independent confirmation.
 */
async function expectedHash(r) {
  const snapshot = await r.source.get();

  if (!snapshot.exists) {
    return digestBookings("[]");
  }

  return digestBookings(
    snapshot.data().json
  );
}

async function migrate(owner, options = {}) {
  const r = refs(owner);

  return migrateVerifiedAndroidBookings({
    db,
    businessId: owner,
    authenticatedUid: owner,
    expectedHash: await expectedHash(r),
    ...options
  });
}

async function counts(r) {
  const [
    appointments,
    locks,
    marker
  ] = await Promise.all([
    r.appointments.get(),
    r.locks.get(),
    r.marker.get()
  ]);

  return {
    appointments: appointments.size,
    locks: locks.size,
    marker: marker.exists
  };
}

test(
  "01 verified migration creates appointments and locks",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    const result = await migrate(owner);

    assert.equal(result.success, true);
    assert.equal(result.verifiedFinalSync, true);
    assert.equal(result.appointmentCount, 1);
    assert.equal(result.lockCount, 2);

    assert.deepEqual(await counts(r), {
      appointments: 1,
      locks: 2,
      marker: true
    });

    const saved = await r.appointments
      .doc("booking1")
      .get();

    assert.equal(
      saved.data().customerName,
      "Test Client"
    );

    assert.equal(saved.data().source, "android");
  }
);

test(
  "02 repeat migration cannot duplicate appointments",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    await migrate(owner);

    await assert.rejects(
      migrate(owner),
      /already migrated/
    );

    assert.deepEqual(await counts(r), {
      appointments: 1,
      locks: 2,
      marker: true
    });
  }
);

test(
  "03 existing booking lock blocks migration",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    await r.locks
      .doc("staff1_2026-11-12_1000")
      .set({
        appointmentId: "existingBooking",
        businessId: owner,
        staffId: "staff1",
        date: "2026-11-12"
      });

    await assert.rejects(
      migrate(owner),
      /booking slots are already occupied/
    );

    assert.deepEqual(await counts(r), {
      appointments: 0,
      locks: 1,
      marker: false
    });
  }
);

test(
  "04 existing appointment ID blocks migration",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    await r.appointments
      .doc("booking1")
      .set({
        source: "existing",
        status: "confirmed"
      });

    await assert.rejects(
      migrate(owner),
      /appointment already exists/
    );

    assert.deepEqual(await counts(r), {
      appointments: 1,
      locks: 0,
      marker: false
    });
  }
);

test(
  "05 invalid source plan creates no writes",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking(),
      booking({
        id: "booking2",
        staffId: ""
      })
    ]);

    await assert.rejects(
      migrate(owner),
      /invalid or overlapping bookings/
    );

    assert.deepEqual(await counts(r), {
      appointments: 0,
      locks: 0,
      marker: false
    });
  }
);

test(
  "06 missing source creates no migration writes",
  async () => {
    const owner = uniqueOwner();
    const r = refs(owner);

    await r.mode.set({
      mode: "frozen"
    });

    await assert.rejects(
      migrate(owner),
      /source is missing/
    );

    assert.deepEqual(await counts(r), {
      appointments: 0,
      locks: 0,
      marker: false
    });
  }
);

test(
  "07 different owner is rejected",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    await assert.rejects(
      migrate(owner, {
        authenticatedUid: "anotherOwner"
      }),
      /ownership verification failed/
    );

    assert.deepEqual(await counts(r), {
      appointments: 0,
      locks: 0,
      marker: false
    });
  }
);

test(
  "08 multiple bookings migrate atomically",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "booking1",
        time: "10:00"
      }),
      booking({
        id: "booking2",
        time: "11:00"
      })
    ]);

    const result = await migrate(owner);

    assert.equal(result.appointmentCount, 2);
    assert.equal(result.lockCount, 4);

    assert.deepEqual(await counts(r), {
      appointments: 2,
      locks: 4,
      marker: true
    });
  }
);

test(
  "09 legacy appointment overlap blocks migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "androidBooking1",
        time: "10:00",
        duration: 30
      })
    ]);

    await r.appointments
      .doc("legacyBooking1")
      .set({
        businessId: owner,
        staffId: "staff1",
        serviceId: "service1",
        date: "2026-11-12",
        startTime: "10:15",
        endTime: "10:45",
        durationMinutes: 30,
        status: "confirmed",
        source: "legacy"
      });

    await assert.rejects(
      migrate(owner),
      /overlap|conflict|occupied/i
    );

    assert.deepEqual(await counts(r), {
      appointments: 1,
      locks: 0,
      marker: false
    });

    const original = await r.appointments
      .doc("legacyBooking1")
      .get();

    const android = await r.appointments
      .doc("androidBooking1")
      .get();

    assert.equal(original.exists, true);
    assert.equal(android.exists, false);
  }
);

test(
  "10 concurrent migrations cannot duplicate",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    const results = await Promise.allSettled([
      migrate(owner),
      migrate(owner)
    ]);

    assert.equal(
      results.filter(
        result => result.status === "fulfilled"
      ).length,
      1
    );

    assert.equal(
      results.filter(
        result => result.status === "rejected"
      ).length,
      1
    );

    assert.deepEqual(await counts(r), {
      appointments: 1,
      locks: 2,
      marker: true
    });
  }
);

test(
  "11 confirmed latest source migrates",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "oldBooking",
        time: "10:00"
      })
    ]);

    await r.source.update({
      json: JSON.stringify([
        booking({
          id: "newBooking",
          time: "11:00"
        })
      ]),
      updatedAt: new Date().toISOString()
    });

    // The test confirms the NEW source hash
    // before invoking verified migration.
    const result = await migrate(owner);

    assert.equal(result.success, true);

    const oldAppointment = await r.appointments
      .doc("oldBooking")
      .get();

    const newAppointment = await r.appointments
      .doc("newBooking")
      .get();

    assert.equal(oldAppointment.exists, false);
    assert.equal(newAppointment.exists, true);

    assert.deepEqual(await counts(r), {
      appointments: 1,
      locks: 2,
      marker: true
    });
  }
);

test(
  "12 competing booking lock blocks migration",
  async () => {
    const owner = uniqueOwner();
    const r = await seed(owner, [booking()]);

    await r.locks
      .doc("staff1_2026-11-12_1015")
      .set({
        businessId: owner,
        staffId: "staff1",
        date: "2026-11-12",
        appointmentId: "onlineBooking"
      });

    await assert.rejects(
      migrate(owner),
      /occupied/
    );

    assert.deepEqual(await counts(r), {
      appointments: 0,
      locks: 1,
      marker: false
    });
  }
);

test(
  "13 source changed after hash confirmation is blocked",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "staleBooking",
        time: "10:00"
      })
    ]);

    // Confirm the original source snapshot.
    const confirmedHash = await expectedHash(r);

    // Simulate a delayed Android upload
    // arriving after confirmation.
    await r.source.update({
      json: JSON.stringify([
        booking({
          id: "freshBooking",
          time: "11:00"
        })
      ]),
      updatedAt: new Date().toISOString()
    });

    await assert.rejects(
      migrate(owner, {
        expectedHash: confirmedHash
      }),
      /snapshot mismatch/
    );

    const stale = await r.appointments
      .doc("staleBooking")
      .get();

    const fresh = await r.appointments
      .doc("freshBooking")
      .get();

    assert.equal(stale.exists, false);
    assert.equal(fresh.exists, false);

    assert.deepEqual(await counts(r), {
      appointments: 0,
      locks: 0,
      marker: false
    });
  }
);
