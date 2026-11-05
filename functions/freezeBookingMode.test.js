"use strict";

/**
 * BOUSTIO — PHASE 8D.71
 *
 * Booking Freeze Manager Unit Tests
 *
 * In-memory Firestore simulation.
 * No live Firebase access.
 * No production changes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  freezeBookingMode
} = require("./freezeBookingMode");

const {
  MODES,
  MIGRATION_ID
} = require("./bookingMode");

// =====================================
// IN-MEMORY FIRESTORE TEST DATABASE
// =====================================

function makeDatabase() {
  const records = new Map();

  let transactionCount = 0;

  function snapshot(path) {
    const exists = records.has(path);

    return {
      exists,

      data() {
        return exists
          ? { ...records.get(path) }
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
      transactionCount++;

      const pending = [];

      const transaction = {
        async get(ref) {
          return snapshot(ref.path);
        },

        update(ref, data) {
          pending.push({
            path: ref.path,
            data
          });
        }
      };

      const result =
        await callback(transaction);

      // Apply writes only after the
      // transaction callback succeeds.

      for (const item of pending) {
        if (!records.has(item.path)) {
          throw new Error(
            "Cannot update missing document"
          );
        }
      }

      for (const item of pending) {
        records.set(item.path, {
          ...records.get(item.path),
          ...item.data
        });
      }

      return result;
    }
  };

  return {
    db,
    records,

    get transactionCount() {
      return transactionCount;
    }
  };
}

function modePath(id) {
  return (
    `businesses/${id}/settings/bookingMode`
  );
}

function migrationPath(id) {
  return (
    `businesses/${id}/migrations/${MIGRATION_ID}`
  );
}

function seedMode(context, id, mode) {
  context.records.set(modePath(id), {
    mode,
    schemaVersion: 1
  });
}

// =====================================
// AUTOMATED TESTS
// =====================================

test(
  "Phase 8D.71 booking freeze manager",
  async t => {

    await t.test(
      "01 legacy business freezes successfully",
      async () => {
        const context = makeDatabase();

        seedMode(
          context,
          "salon1",
          MODES.LEGACY
        );

        const result = await freezeBookingMode(
          context.db,
          "salon1"
        );

        assert.deepEqual(result, {
          success: true,
          mode: MODES.FROZEN,
          changed: true
        });

        assert.equal(
          context.records.get(
            modePath("salon1")
          ).mode,
          MODES.FROZEN
        );
      }
    );

    await t.test(
      "02 repeat freeze does not change state",
      async () => {
        const context = makeDatabase();

        seedMode(
          context,
          "salon2",
          MODES.FROZEN
        );

        const original =
          context.records.get(
            modePath("salon2")
          );

        const result = await freezeBookingMode(
          context.db,
          "salon2"
        );

        assert.deepEqual(result, {
          success: true,
          mode: MODES.FROZEN,
          changed: false
        });

        assert.strictEqual(
          context.records.get(
            modePath("salon2")
          ),
          original
        );
      }
    );

    await t.test(
      "03 cloud business cannot be frozen",
      async () => {
        const context = makeDatabase();

        seedMode(
          context,
          "salon3",
          MODES.CLOUD
        );

        await assert.rejects(
          freezeBookingMode(
            context.db,
            "salon3"
          ),
          /Only legacy mode can be frozen/
        );

        assert.equal(
          context.records.get(
            modePath("salon3")
          ).mode,
          MODES.CLOUD
        );
      }
    );

    await t.test(
      "04 missing mode blocks freezing",
      async () => {
        const context = makeDatabase();

        await assert.rejects(
          freezeBookingMode(
            context.db,
            "salon4"
          ),
          /not initialised/
        );

        assert.equal(
          context.records.has(
            modePath("salon4")
          ),
          false
        );
      }
    );

    await t.test(
      "05 completed migration blocks freezing",
      async () => {
        const context = makeDatabase();

        seedMode(
          context,
          "salon5",
          MODES.LEGACY
        );

        context.records.set(
          migrationPath("salon5"),
          {
            completed: true
          }
        );

        await assert.rejects(
          freezeBookingMode(
            context.db,
            "salon5"
          ),
          /already migrated/
        );

        assert.equal(
          context.records.get(
            modePath("salon5")
          ).mode,
          MODES.LEGACY
        );
      }
    );

    await t.test(
      "06 migration marker blocks repeat freeze",
      async () => {
        const context = makeDatabase();

        seedMode(
          context,
          "salon6",
          MODES.FROZEN
        );

        context.records.set(
          migrationPath("salon6"),
          {
            completed: true
          }
        );

        await assert.rejects(
          freezeBookingMode(
            context.db,
            "salon6"
          ),
          /already migrated/
        );
      }
    );

    await t.test(
      "07 invalid mode is rejected",
      async () => {
        const context = makeDatabase();

        seedMode(
          context,
          "salon7",
          "unknown"
        );

        await assert.rejects(
          freezeBookingMode(
            context.db,
            "salon7"
          ),
          /Only legacy mode can be frozen/
        );
      }
    );

    await t.test(
      "08 invalid business ID is rejected",
      async () => {
        const context = makeDatabase();

        await assert.rejects(
          freezeBookingMode(
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

    await t.test(
      "09 missing database is rejected",
      async () => {
        await assert.rejects(
          freezeBookingMode(
            null,
            "salon9"
          ),
          /Trusted Firestore database required/
        );
      }
    );

    await t.test(
      "10 freezing preserves other mode fields",
      async () => {
        const context = makeDatabase();

        context.records.set(
          modePath("salon10"),
          {
            mode: MODES.LEGACY,
            schemaVersion: 1,
            customField: "preserve-me"
          }
        );

        await freezeBookingMode(
          context.db,
          "salon10"
        );

        const result =
          context.records.get(
            modePath("salon10")
          );

        assert.equal(
          result.mode,
          MODES.FROZEN
        );

        assert.equal(
          result.customField,
          "preserve-me"
        );

        assert.equal(
          result.updatedAt instanceof Date,
          true
        );
      }
    );

  }
);
