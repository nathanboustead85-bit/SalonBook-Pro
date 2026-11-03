"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  previewFirestoreMigration
} = require("./firestoreMigrationPreview");

const UID = "testBusiness123";

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

/**
 * Simulated Firestore.
 * All reads are tracked.
 * No write methods are provided.
 */
function mockFirestore({
  bookings = [booking()],
  sourceExists = true,
  sourceSchema = 1,
  sourceJson,
  appointments = [],
  locks = [],
  failedRead = null
} = {}) {
  const reads = [];

  function collectionSnapshot(ids) {
    return {
      forEach(callback) {
        ids.forEach(id => {
          callback({ id });
        });
      }
    };
  }

  function document(path) {
    return {
      collection(name) {
        return collection(`${path}/${name}`);
      },

      async get() {
        reads.push(path);

        if (failedRead === path) {
          throw new Error("Simulated Firestore failure");
        }

        if (path === `users/${UID}/liveData/bookings`) {
          return {
            exists: sourceExists,
            data() {
              return {
                schemaVersion: sourceSchema,
                json: sourceJson === undefined
                  ? JSON.stringify(bookings)
                  : sourceJson,
                updatedAt: null
              };
            }
          };
        }

        throw new Error("Unexpected document read");
      }
    };
  }

  function collection(path) {
    return {
      doc(id) {
        return document(`${path}/${id}`);
      },

      async get() {
        reads.push(path);

        if (failedRead === path) {
          throw new Error("Simulated Firestore failure");
        }

        if (path === `businesses/${UID}/appointments`) {
          return collectionSnapshot(appointments);
        }

        if (path === `businesses/${UID}/bookingLocks`) {
          return collectionSnapshot(locks);
        }

        throw new Error("Unexpected collection read");
      }
    };
  }

  return {
    db: { collection },
    reads
  };
}

async function preview(options = {}) {
  const {
    db,
    reads
  } = mockFirestore(options);

  const result = await previewFirestoreMigration({
    db,
    businessId: UID,
    authenticatedUid: UID
  });

  return { result, reads };
}

test("1 - valid cloud booking passes preview", async () => {
  const { result } = await preview();

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.status, "PREFLIGHT_PASSED");
});

test("2 - preview is explicitly read-only", async () => {
  const { result } = await preview();

  assert.equal(result.readOnly, true);
  assert.equal(result.source, "firestore");
});

test("3 - all three Firestore paths are read", async () => {
  const { reads } = await preview();

  assert.deepEqual(
    reads.sort(),
    [
      `users/${UID}/liveData/bookings`,
      `businesses/${UID}/appointments`,
      `businesses/${UID}/bookingLocks`
    ].sort()
  );
});

test("4 - existing appointment ID blocks preview", async () => {
  const { result } = await preview({
    appointments: ["booking1"]
  });

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.status, "MIGRATION_BLOCKED");
});

test("5 - existing booking lock blocks preview", async () => {
  const { result } = await preview({
    locks: ["staff1_2026-11-12_1000"]
  });

  assert.equal(result.safeToMigrate, false);
  assert.deepEqual(result.locks, []);
});

test("6 - unrelated server records are allowed", async () => {
  const { result } = await preview({
    appointments: ["anotherBooking"],
    locks: ["staff2_2026-11-12_1000"]
  });

  assert.equal(result.safeToMigrate, true);
});

test("7 - missing cloud document fails closed", async () => {
  const { db } = mockFirestore({
    sourceExists: false
  });

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: UID
    }),
    /missing/
  );
});

test("8 - unsupported schema fails closed", async () => {
  const { db } = mockFirestore({
    sourceSchema: 2
  });

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: UID
    }),
    /unsupported format/
  );
});

test("9 - malformed JSON is rejected", async () => {
  const { db } = mockFirestore({
    sourceJson: "{invalid"
  });

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: UID
    })
  );
});

test("10 - failed Android booking read blocks preview", async () => {
  const { db } = mockFirestore({
    failedRead: `users/${UID}/liveData/bookings`
  });

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: UID
    }),
    /Unable to read/
  );
});

test("11 - failed appointment read blocks preview", async () => {
  const { db } = mockFirestore({
    failedRead: `businesses/${UID}/appointments`
  });

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: UID
    }),
    /Unable to read/
  );
});

test("12 - failed booking lock read blocks preview", async () => {
  const { db } = mockFirestore({
    failedRead: `businesses/${UID}/bookingLocks`
  });

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: UID
    }),
    /Unable to read/
  );
});

test("13 - wrong owner is rejected", async () => {
  const { db, reads } = mockFirestore();

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: UID,
      authenticatedUid: "anotherUser"
    }),
    /ownership/
  );

  assert.equal(reads.length, 0);
});

test("14 - invalid business ID is rejected", async () => {
  const { db } = mockFirestore();

  await assert.rejects(
    previewFirestoreMigration({
      db,
      businessId: "invalid/id",
      authenticatedUid: UID
    }),
    /Invalid business/
  );
});

test("15 - missing database is rejected", async () => {
  await assert.rejects(
    previewFirestoreMigration({
      db: null,
      businessId: UID,
      authenticatedUid: UID
    }),
    /unavailable/
  );
});

test("16 - invalid Android booking blocks preview", async () => {
  const { result } = await preview({
    bookings: [
      booking({ staffId: "" })
    ]
  });

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.proposedAppointmentCount, 0);
});

test("17 - empty cloud booking list is supported", async () => {
  const { result } = await preview({
    bookings: []
  });

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.sourceCount, 0);
});

test("18 - duplicate Android booking IDs block preview", async () => {
  const { result } = await preview({
    bookings: [
      booking(),
      booking({
        client: "Second Client",
        time: "11:00"
      })
    ]
  });

  assert.equal(result.safeToMigrate, false);
});

test("19 - blocked preview returns no proposed writes", async () => {
  const { result } = await preview({
    appointments: ["booking1"]
  });

  assert.deepEqual(result.appointments, []);
  assert.deepEqual(result.locks, []);
});

test("20 - warning describes transaction requirement", async () => {
  const { result } = await preview();

  assert.match(result.warning, /READ-ONLY/);
  assert.match(result.warning, /transactions/);
});
