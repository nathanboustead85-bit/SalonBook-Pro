"use strict";

/**
 * BOUSTIO — PHASE 8D.40
 *
 * Production deployment and Firebase
 * project configuration safeguards.
 *
 * Static tests only.
 * No production deployment.
 * No Firestore modifications.
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

const firebaseProjects =
  readJson(".firebaserc");

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
      "1 - production functions configuration",
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
      "2 - HTTP emulator remains isolated",
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
      "3 - only approved functions exported",
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
      "4 - migration preview not exported",
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
      "5 - booking endpoints not exported",
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
      "6 - customer bookings remain disabled",
      () => {
        const disabledMatches =
          productionSource.match(
            /acceptingBookings:\s*false\b/g
          ) || [];

        assert.ok(
          disabledMatches.length >= 2,
          "Publish and unpublish must disable bookings"
        );

        assert.doesNotMatch(
          productionSource,
          /acceptingBookings:\s*true\b/
        );
      }
    );

    await t.test(
      "7 - production and emulator sources differ",
      () => {
        assert.notEqual(
          productionConfig.functions.source,
          emulatorConfig.functions.source
        );
      }
    );

    await t.test(
      "8 - App Check enforcement not enabled prematurely",
      () => {
        const settings =
          productionSource.match(
            /enforceAppCheck:\s*(true|false)/g
          ) || [];

        assert.equal(settings.length, 2);

        for (const setting of settings) {
          assert.match(
            setting,
            /enforceAppCheck:\s*false/
          );
        }
      }
    );

    await t.test(
      "9 - production Firebase project ID",
      () => {
        assert.equal(
          firebaseProjects.projects.production,
          "salonbook-pro-ad5ff"
        );
      }
    );

    await t.test(
      "10 - emulator Firebase project ID",
      () => {
        assert.equal(
          firebaseProjects.projects.emulator,
          "demo-boustio-migration"
        );
      }
    );

    await t.test(
      "11 - default project matches production",
      () => {
        assert.equal(
          firebaseProjects.projects.default,
          firebaseProjects.projects.production
        );
      }
    );

    await t.test(
      "12 - production and emulator IDs differ",
      () => {
        assert.notEqual(
          firebaseProjects.projects.production,
          firebaseProjects.projects.emulator
        );

        assert.match(
          firebaseProjects.projects.emulator,
          /^demo-/
        );
      }
    );

    await t.test(
      "13 - emulator configuration uses test codebase",
      () => {
        assert.notEqual(
          emulatorConfig.functions.codebase,
          productionConfig.functions.codebase
        );
      }
    );

    await t.test(
      "14 - production configuration does not reference emulator source",
      () => {
        assert.notEqual(
          productionConfig.functions.source,
          "functions/http-emulator"
        );

        assert.equal(
          productionConfig.functions.source,
          "functions"
        );
      }
    );
  }
);
