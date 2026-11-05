"use strict";

/**
 * BOUSTIO — PHASE 8D.77
 *
 * Verified Android booking migration
 * Firestore Emulator integration tests.
 *
 * EMULATOR ONLY. NEVER PRODUCTION.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const {
  migrateVerifiedAndroidBookings
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
    "Verified migration tests require the " +
    "dedicated Firestore emulator project."
  );
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: PROJECT_ID
  });
}

const db = admin.firestore();
let sequence = 0;

function ownerId() {
  sequence++;

  return (
    "verifiedMigration_" +
    process.pid + "_" +
    Date.now() + "_" +
    sequence
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

function references(owner) {
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
      .doc("android-bookings-v1")
  };
}

async function setup({
  mode = "frozen",
  bookings = [booking()],
  sourceExists = true,
  markerExists = false
} = {}) {
  const owner = ownerId();
  const refs = references(owner);
  const json = JSON.stringify(bookings);

  await refs.mode.set({
    mode,
    schemaVersion: 1,
    updatedAt: new Date()
  });

  if (sourceExists) {
    await refs.source.set({
      schemaVersion: 1,
      json,
      updatedAt: new Date()
    });
  }

  if (markerExists) {
    await refs.marker.set({
      status: "completed"
    });
  }

  return {
    owner,
    refs,
    expectedHash: digestBookings(json)
  };
}

function migrate(fixture, overrides = {}) {
  return migrateVerifiedAndroidBookings({
    db,
    businessId: fixture.owner,
    authenticatedUid: fixture.owner,
    expectedHash: fixture.expectedHash,
    ...overrides
  });
}

async function counts(refs) {
  const [
    appointments,
    locks,
    marker
  ] = await Promise.all([
    refs.appointments.get(),
    refs.locks.get(),
    refs.marker.get()
  ]);

  return {
    appointments: appointments.size,
    locks: locks.size,
    marker: marker.exists
  };
}

async function assertNoMigrationWrites(refs) {
  assert.deepEqual(await counts(refs), {
    appointments: 0,
    locks: 0,
    marker: false
  });
}

test(
  "01 matching frozen snapshot migrates atomically",
  async () => {
    const fixture = await setup();

    const result = await migrate(fixture);

    assert.equal(result.success, true);
    assert.equal(result.verifiedFinalSync, true);
    assert.equal(
      result.sourceHash,
      fixture.expectedHash
    );
    assert.equal(result.appointmentCount, 1);
    assert.equal(result.lockCount, 2);

    assert.deepEqual(
      await counts(fixture.refs),
      {
        appointments: 1,
        locks: 2,
        marker: true
      }
    );

    const marker =
      await fixture.refs.marker.get();

    assert.equal(
      marker.data().verifiedFinalSync,
      true
    );

    assert.equal(
      marker.data().sourceHash,
      fixture.expectedHash
    );
  }
);

test(
  "02 mismatched final hash blocks all writes",
  async () => {
    const fixture = await setup();

    await assert.rejects(
      migrate(fixture, {
        expectedHash:
          digestBookings('[{"id":"different"}]')
      }),
      /snapshot mismatch/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "03 legacy mode blocks migration",
  async () => {
    const fixture = await setup({
      mode: "legacy"
    });

    await assert.rejects(
      migrate(fixture),
      /must be frozen/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "04 cloud mode blocks migration",
  async () => {
    const fixture = await setup({
      mode: "cloud"
    });

    await assert.rejects(
      migrate(fixture),
      /must be frozen/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "05 missing source blocks migration",
  async () => {
    const fixture = await setup({
      sourceExists: false
    });

    await assert.rejects(
      migrate(fixture),
      /source is missing/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "06 different owner is rejected",
  async () => {
    const fixture = await setup();

    await assert.rejects(
      migrate(fixture, {
        authenticatedUid: "anotherOwner"
      }),
      /ownership verification failed/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "07 invalid expected hash is rejected",
  async () => {
    const fixture = await setup();

    await assert.rejects(
      migrate(fixture, {
        expectedHash: "invalid"
      }),
      /valid final booking hash is required/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "08 existing migration marker blocks repeat",
  async () => {
    const fixture = await setup({
      markerExists: true
    });

    await assert.rejects(
      migrate(fixture),
      /already migrated/
    );

    assert.deepEqual(
      await counts(fixture.refs),
      {
        appointments: 0,
        locks: 0,
        marker: true
      }
    );
  }
);

test(
  "09 existing appointment ID blocks all writes",
  async () => {
    const fixture = await setup();

    await fixture.refs.appointments
      .doc("booking1")
      .set({
        status: "confirmed",
        source: "existing"
      });

    await assert.rejects(
      migrate(fixture),
      /appointment already exists/
    );

    assert.deepEqual(
      await counts(fixture.refs),
      {
        appointments: 1,
        locks: 0,
        marker: false
      }
    );
  }
);

test(
  "10 existing booking lock blocks migration",
  async () => {
    const fixture = await setup();

    await fixture.refs.locks
      .doc("staff1_2026-11-12_1000")
      .set({
        appointmentId: "existingBooking",
        staffId: "staff1",
        date: "2026-11-12"
      });

    await assert.rejects(
      migrate(fixture),
      /booking slots are already occupied/
    );

    assert.deepEqual(
      await counts(fixture.refs),
      {
        appointments: 0,
        locks: 1,
        marker: false
      }
    );
  }
);

test(
  "11 changed source after verification is rejected",
  async () => {
    const fixture = await setup();

    await fixture.refs.source.update({
      json: JSON.stringify([
        booking({
          id: "changedBooking",
          time: "11:00"
        })
      ])
    });

    await assert.rejects(
      migrate(fixture),
      /snapshot mismatch/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "12 simultaneous migrations cannot duplicate",
  async () => {
    const fixture = await setup();

    const results = await Promise.allSettled([
      migrate(fixture),
      migrate(fixture)
    ]);

    const successes = results.filter(
      result => result.status === "fulfilled"
    );

    const failures = results.filter(
      result => result.status === "rejected"
    );

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);

    assert.deepEqual(
      await counts(fixture.refs),
      {
        appointments: 1,
        locks: 2,
        marker: true
      }
    );
  }
);

test(
  "13 invalid booking plan creates no documents",
  async () => {
    const fixture = await setup({
      bookings: [
        booking({
          staffId: ""
        })
      ]
    });

    await assert.rejects(
      migrate(fixture),
      /invalid or overlapping bookings/
    );

    await assertNoMigrationWrites(fixture.refs);
  }
);

test(
  "14 overlapping legacy appointment blocks migration",
  async () => {
    const fixture = await setup();

    await fixture.refs.appointments
      .doc("legacyBooking")
      .set({
        staffId: "staff1",
        date: "2026-11-12",
        startTime: "10:15",
        endTime: "10:45",
        durationMinutes: 30,
        status: "confirmed",
        source: "legacy"
      });

    await assert.rejects(
      migrate(fixture),
      /overlapping legacy server appointment/
    );

    assert.deepEqual(
      await counts(fixture.refs),
      {
        appointments: 1,
        locks: 0,
        marker: false
      }
    );
  }
);
