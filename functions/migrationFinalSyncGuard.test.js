"use strict";

/**
 * BOUSTIO — PHASE 8D.75
 *
 * Transactional final-sync guard unit tests.
 *
 * In-memory simulation only.
 * No production access.
 * No database writes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  verifyMigrationFinalSync,
  validateIdentifiers,
  validateExpectedHash,
  hashesMatch
} = require("./migrationFinalSyncGuard");

const {
  digestBookings
} = require("./finalBookingSyncVerifier");

function makeEnvironment({
  mode = "frozen",
  modeExists = true,
  migrated = false,
  sourceExists = true,
  sourceJson = "[]",
  schemaVersion = 1,
  readFailure = false
} = {}) {
  const documents = {};

  if (modeExists) {
    documents[
      "businesses/owner123/settings/bookingMode"
    ] = { mode };
  }

  if (migrated) {
    documents[
      "businesses/owner123/migrations/android-bookings-v1"
    ] = { status: "completed" };
  }

  if (sourceExists) {
    documents[
      "users/owner123/liveData/bookings"
    ] = {
      schemaVersion,
      json: sourceJson,
      updatedAt: "test-timestamp"
    };
  }

  const reads = [];
  let writes = 0;

  function reference(parts) {
    return {
      path: parts.join("/"),

      collection(name) {
        return {
          doc(id) {
            return reference([
              ...parts,
              name,
              id
            ]);
          }
        };
      }
    };
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          return reference([name, id]);
        }
      };
    }
  };

  const transaction = {
    async get(ref) {
      if (readFailure) {
        throw new Error("Simulated Firestore read failure");
      }

      reads.push(ref.path);

      const exists = Object.prototype.hasOwnProperty.call(
        documents,
        ref.path
      );

      return {
        exists,
        data() {
          return documents[ref.path];
        }
      };
    },

    create() {
      writes++;
    },

    set() {
      writes++;
    },

    update() {
      writes++;
    },

    delete() {
      writes++;
    }
  };

  return {
    db,
    transaction,
    reads,
    get writes() {
      return writes;
    }
  };
}

function options(environment, expectedJson = "[]") {
  return {
    db: environment.db,
    transaction: environment.transaction,
    businessId: "owner123",
    authenticatedUid: "owner123",
    expectedHash: digestBookings(expectedJson)
  };
}

test("01 matching frozen snapshot passes", async () => {
  const environment = makeEnvironment();

  const result = await verifyMigrationFinalSync(
    options(environment)
  );

  assert.equal(result.verified, true);
  assert.equal(result.mode, "frozen");
  assert.equal(result.source.json, "[]");
  assert.equal(result.sourceHash, digestBookings("[]"));
  assert.equal(result.migrationAuthorised, false);
  assert.equal(environment.writes, 0);
});

test("02 legacy booking mode is rejected", async () => {
  const environment = makeEnvironment({
    mode: "legacy"
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /must be frozen/
  );

  assert.equal(environment.writes, 0);
});

test("03 cloud booking mode is rejected", async () => {
  const environment = makeEnvironment({
    mode: "cloud"
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /must be frozen/
  );
});

test("04 missing booking mode is rejected", async () => {
  const environment = makeEnvironment({
    modeExists: false
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /mode is missing/
  );
});

test("05 completed migration is rejected", async () => {
  const environment = makeEnvironment({
    migrated: true
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /already migrated/
  );
});

test("06 mismatched final snapshot is rejected", async () => {
  const environment = makeEnvironment({
    sourceJson: '[{"id":"changed"}]'
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /snapshot mismatch/
  );

  assert.equal(environment.writes, 0);
});

test("07 missing cloud booking source is rejected", async () => {
  const environment = makeEnvironment({
    sourceExists: false
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /source is missing/
  );
});

test("08 unsupported schema is rejected", async () => {
  const environment = makeEnvironment({
    schemaVersion: 2
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /Unsupported Android booking source/
  );
});

test("09 invalid booking JSON is rejected", async () => {
  const environment = makeEnvironment({
    sourceJson: "{invalid}"
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /Invalid Android booking source JSON/
  );
});

test("10 different business owner is rejected", async () => {
  const environment = makeEnvironment();

  await assert.rejects(
    verifyMigrationFinalSync({
      ...options(environment),
      authenticatedUid: "other123"
    }),
    /ownership verification failed/
  );

  assert.equal(environment.reads.length, 0);
});

test("11 invalid expected hash is rejected", async () => {
  const environment = makeEnvironment();

  await assert.rejects(
    verifyMigrationFinalSync({
      ...options(environment),
      expectedHash: "not-a-valid-hash"
    }),
    /Invalid expected booking hash/
  );

  assert.equal(environment.reads.length, 0);
});

test("12 matching hashes compare successfully", () => {
  const hash = digestBookings("[]");

  assert.equal(
    hashesMatch(hash, hash),
    true
  );
});

test("13 different hashes compare unsuccessfully", () => {
  const first = digestBookings("[]");
  const second = digestBookings('[{"id":"one"}]');

  assert.equal(
    hashesMatch(first, second),
    false
  );
});

test("14 verification reads all three documents", async () => {
  const environment = makeEnvironment();

  await verifyMigrationFinalSync(
    options(environment)
  );

  assert.deepEqual(environment.reads, [
    "businesses/owner123/settings/bookingMode",
    "businesses/owner123/migrations/android-bookings-v1",
    "users/owner123/liveData/bookings"
  ]);

  assert.equal(environment.writes, 0);
});

test("15 Firestore read failure blocks verification", async () => {
  const environment = makeEnvironment({
    readFailure: true
  });

  await assert.rejects(
    verifyMigrationFinalSync(options(environment)),
    /Simulated Firestore read failure/
  );

  assert.equal(environment.writes, 0);
});

test("16 invalid business identifier is rejected", () => {
  assert.throws(
    () => validateIdentifiers(
      "invalid/business",
      "invalid/business"
    ),
    /Invalid business or owner identifier/
  );
});

test("17 invalid hash format is rejected", () => {
  assert.throws(
    () => validateExpectedHash("abc"),
    /Invalid expected booking hash/
  );
});
