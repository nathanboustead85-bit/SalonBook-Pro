"use strict";

/**
 * BOUSTIO — PHASE 8D.67
 * Booking Mode Unit Tests
 *
 * Uses an in-memory Firestore simulation.
 * No live Firebase database access.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MODES,
  MIGRATION_ID,
  readBookingMode,
  initialiseLegacyMode
} = require("./bookingMode");

function makeDatabase() {
  const records = new Map();
  let transactions = 0;

  function snapshot(path) {
    const exists = records.has(path);

    return {
      exists,
      data() {
        return exists
          ? records.get(path)
          : undefined;
      }
    };
  }

  function reference(path) {
    return {
      path,

      collection(name) {
        return reference(`${path}/${name}`);
      },

      doc(id) {
        return reference(`${path}/${id}`);
      },

      async get() {
        return snapshot(path);
      }
    };
  }

  const db = {
    collection(name) {
      return reference(name);
    },

    async runTransaction(callback) {
      transactions++;

      const pending = [];

      const transaction = {
        async get(ref) {
          return snapshot(ref.path);
        },

        create(ref, data) {
          pending.push({
            path: ref.path,
            data
          });
        }
      };

      const result = await callback(transaction);

      for (const item of pending) {
        if (records.has(item.path)) {
          throw new Error(
            "Document already exists"
          );
        }
      }

      for (const item of pending) {
        records.set(item.path, item.data);
      }

      return result;
    }
  };

  return {
    db,
    records,

    get transactionCount() {
      return transactions;
    }
  };
}

function modePath(id) {
  return `businesses/${id}/settings/bookingMode`;
}

function migrationPath(id) {
  return `businesses/${id}/migrations/${MIGRATION_ID}`;
}

test(
  "Phase 8D.67 booking mode unit tests",
  async t => {

    await t.test(
      "01 new business starts in legacy mode",
      async () => {
        const { db, records } = makeDatabase();

        const result =
          await initialiseLegacyMode(db, "salon1");

        assert.deepEqual(result, {
          mode: MODES.LEGACY,
          created: true
        });

        assert.equal(
          records.get(modePath("salon1")).mode,
          "legacy"
        );
      }
    );

    await t.test(
      "02 repeat initialisation preserves mode",
      async () => {
        const { db, records } = makeDatabase();

        await initialiseLegacyMode(db, "salon2");

        const original =
          records.get(modePath("salon2"));

        const result =
          await initialiseLegacyMode(db, "salon2");

        assert.deepEqual(result, {
          mode: MODES.LEGACY,
          created: false
        });

        assert.strictEqual(
          records.get(modePath("salon2")),
          original
        );
      }
    );

    await t.test(
      "03 frozen business stays frozen",
      async () => {
        const { db, records } = makeDatabase();

        records.set(modePath("salon3"), {
          mode: MODES.FROZEN
        });

        const result =
          await initialiseLegacyMode(db, "salon3");

        assert.equal(result.created, false);
        assert.equal(result.mode, MODES.FROZEN);
      }
    );

    await t.test(
      "04 cloud business stays cloud",
      async () => {
        const { db, records } = makeDatabase();

        records.set(modePath("salon4"), {
          mode: MODES.CLOUD
        });

        const result =
          await initialiseLegacyMode(db, "salon4");

        assert.equal(result.created, false);
        assert.equal(result.mode, MODES.CLOUD);
      }
    );

    await t.test(
      "05 completed migration blocks setup",
      async () => {
        const { db, records } = makeDatabase();

        records.set(migrationPath("salon5"), {
          completed: true
        });

        await assert.rejects(
          initialiseLegacyMode(db, "salon5"),
          /after migration/
        );

        assert.equal(
          records.has(modePath("salon5")),
          false
        );
      }
    );

    await t.test(
      "06 migration blocks existing legacy mode",
      async () => {
        const { db, records } = makeDatabase();

        records.set(modePath("salon6"), {
          mode: MODES.LEGACY
        });

        records.set(migrationPath("salon6"), {
          completed: true
        });

        await assert.rejects(
          initialiseLegacyMode(db, "salon6"),
          /after migration/
        );
      }
    );

    await t.test(
      "07 invalid existing mode is rejected",
      async () => {
        const { db, records } = makeDatabase();

        records.set(modePath("salon7"), {
          mode: "unknown"
        });

        await assert.rejects(
          initialiseLegacyMode(db, "salon7"),
          /invalid/
        );
      }
    );

    await t.test(
      "08 missing mode returns null",
      async () => {
        const { db } = makeDatabase();

        assert.equal(
          await readBookingMode(db, "salon8"),
          null
        );
      }
    );

    await t.test(
      "09 invalid mode cannot be read",
      async () => {
        const { db, records } = makeDatabase();

        records.set(modePath("salon9"), {
          mode: "unsafe"
        });

        await assert.rejects(
          readBookingMode(db, "salon9"),
          /Unknown booking mode/
        );
      }
    );

    await t.test(
      "10 invalid business ID is rejected",
      async () => {
        const context = makeDatabase();

        await assert.rejects(
          initialiseLegacyMode(
            context.db,
            "../another-business"
          ),
          /Invalid business ID/
        );

        assert.equal(
          context.transactionCount,
          0
        );
      }
    );

  }
);
