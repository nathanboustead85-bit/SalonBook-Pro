"use strict";

/**
 * BOUSTIO — PHASE 8D.37
 *
 * Production deployment safety guard.
 *
 * Static checks only.
 * Does not connect to Firebase.
 * Does not deploy any functions.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function readJson(filename) {
  return JSON.parse(
    fs.readFileSync(
      path.join(ROOT, filename),
      "utf8"
    )
  );
}

function readSource(filename) {
  return fs.readFileSync(
    path.join(ROOT, filename),
    "utf8"
  );
}

const productionConfig =
  readJson("firebase.json");

const emulatorConfig =
  readJson("firebase.http-emulator.json");

const productionSource =
  readSource("functions/index.js");

const productionExports = [
  ...productionSource.matchAll(
    /\bexports\.([A-Za-z_$][\w$]*)\s*=/g
  )
].map(match => match[1]);

test(
  "Boustio production deployment safeguards",
  async t => {

    await t.test(
      "1 - production source is correct",
      () => {
        assert.equal(
          productionConfig.functions.source,
          "functions"
        );

        assert.equal(
          productionConfig.functions.codebase,
          "default"
        );

        assert.equal(
          productionConfig.functions.runtime,
          "nodejs22"
        );
      }
    );

    await t.test(
      "2 - test source remains isolated",
      () => {
        assert.equal(
          emulatorConfig.functions.source,
          "functions/http-emulator"
        );

        assert.equal(
          emulatorConfig.functions.codebase,
          "migration-http-test"
        );
      }
    );

    await t.test(
      "3 - production exports are restricted",
      () => {
        assert.deepEqual(
          [...productionExports].sort(),
          [
            "publishBusiness",
            "unpublishBusiness"
          ].sort()
        );
      }
    );

    await t.test(
      "4 - migration callable is not exported",
      () => {
        assert.equal(
          productionExports.includes(
            "migrationPreviewCallable"
          ),
          false
        );
      }
    );

    await t.test(
      "5 - booking endpoints are not exported",
      () => {
        const forbidden = [
          "createBooking",
          "publicBooking",
          "trustedBooking",
          "executeMigration",
          "migrateBookings"
        ];

        for (const name of forbidden) {
          assert.equal(
            productionExports.includes(name),
            false,
            `${name} must not be exported`
          );
        }
      }
    );

    await t.test(
      "6 - public bookings remain disabled",
      () => {
        assert.match(
          productionSource,
          /acceptingBookings:\s*false/g
        );

        assert.equal(
          /acceptingBookings:\s*true\b/.test(
            productionSource
          ),
          false
        );
      }
    );

    await t.test(
      "7 - production config excludes test source",
      () => {
        assert.notEqual(
          productionConfig.functions.source,
          emulatorConfig.functions.source
        );
      }
    );

    await t.test(
      "8 - production does not enforce App Check prematurely",
      () => {
        assert.match(
          productionSource,
          /enforceAppCheck:\s*false/
        );
      }
    );
  }
);
