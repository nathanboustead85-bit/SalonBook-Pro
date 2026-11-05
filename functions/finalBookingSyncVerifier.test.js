"use strict";

/**
 * BOUSTIO — PHASE 8D.74
 *
 * Final Android booking sync verification tests.
 *
 * In-memory Firestore simulation only.
 * No production access.
 * No database writes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  digestBookings,
  verifyFinalBookingSync
} = require("./finalBookingSyncVerifier");

function fakeDatabase({
  mode = "frozen",
  migrated = false,
  sourceJson = "[]",
  sourceExists = true,
  schemaVersion = 1,
  failRead = false
} = {}) {
  const documents = {
    "businesses/owner123/settings/bookingMode": {
      mode
    },
    "users/owner123/liveData/bookings": {
      schemaVersion,
      json: sourceJson
    }
  };

  if (migrated) {
    documents[
      "businesses/owner123/migrations/android-bookings-v1"
    ] = {
      status: "completed"
    };
  }

  if (!sourceExists) {
    delete documents[
      "users/owner123/liveData/bookings"
    ];
  }

  return {
    collection(name) {
      return {
        doc(id) {
          const segments = [name, id];

          function reference(parts) {
            return {
              collection(child) {
                return {
                  doc(childId) {
                    return reference([
                      ...parts,
                      child,
                      childId
                    ]);
                  }
                };
              },

              async get() {
                if (failRead) {
                  throw new Error("Simulated read failure");
                }

                const key = parts.join("/");
                const exists = Object.prototype.hasOwnProperty.call(
                  documents,
                  key
                );

                return {
                  exists,
                  data() {
                    return documents[key];
                  }
                };
              }
            };
          }

          return reference(segments);
        }
      };
    }
  };
}

function args(db, json = "[]") {
  return {
    db,
    businessId: "owner123",
    authenticatedUid: "owner123",
    expectedHash: digestBookings(json)
  };
}

test(
  "01 matching frozen booking snapshot passes",
  async () => {
    const result = await verifyFinalBookingSync(
      args(fakeDatabase())
    );

    assert.equal(result.verified, true);
    assert.equal(result.mode, "frozen");
    assert.equal(result.readOnly, true);
    assert.equal(result.migrationAuthorised, false);
    assert.equal(result.sourceHash, digestBookings("[]"));
  }
);

test(
  "02 mismatched booking snapshot is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(
          fakeDatabase({
            sourceJson: '[{"id":"changed"}]'
          })
        )
      ),
      /does not match/
    );
  }
);

test(
  "03 legacy mode is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(fakeDatabase({ mode: "legacy" }))
      ),
      /must be frozen/
    );
  }
);

test(
  "04 cloud mode is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(fakeDatabase({ mode: "cloud" }))
      ),
      /must be frozen/
    );
  }
);

test(
  "05 completed migration is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(fakeDatabase({ migrated: true }))
      ),
      /already migrated/
    );
  }
);

test(
  "06 missing booking source is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(fakeDatabase({ sourceExists: false }))
      ),
      /document is missing/
    );
  }
);

test(
  "07 unsupported schema is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(fakeDatabase({ schemaVersion: 2 }))
      ),
      /Unsupported cloud booking data/
    );
  }
);

test(
  "08 invalid JSON is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync({
        ...args(fakeDatabase({
          sourceJson: "{invalid}"
        }))
      }),
      /Invalid booking JSON/
    );
  }
);

test(
  "09 unauthorised owner is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync({
        ...args(fakeDatabase()),
        authenticatedUid: "other123"
      }),
      /ownership mismatch/
    );
  }
);

test(
  "10 invalid expected hash is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync({
        ...args(fakeDatabase()),
        expectedHash: "invalid"
      }),
      /Invalid expected booking hash/
    );
  }
);

test(
  "11 Firestore read failure is rejected",
  async () => {
    await assert.rejects(
      verifyFinalBookingSync(
        args(fakeDatabase({ failRead: true }))
      ),
      /Unable to verify Firestore/
    );
  }
);

test(
  "12 invalid booking JSON cannot be hashed",
  () => {
    assert.throws(
      () => digestBookings("{broken}"),
      /Invalid booking JSON/
    );
  }
);

test(
  "13 non-array booking JSON cannot be hashed",
  () => {
    assert.throws(
      () => digestBookings('{"id":"booking1"}'),
      /Invalid booking JSON/
    );
  }
);

test(
  "14 matching hash is deterministic",
  () => {
    assert.equal(
      digestBookings('[{"id":"booking1"}]'),
      digestBookings('[{"id":"booking1"}]')
    );
  }
);
