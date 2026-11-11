"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/boustio-phase-1130-android-persistence.yml"), "utf8");
const cloud = fs.readFileSync(path.join(root, "app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"), "utf8");
const tests = ["phase1133CloudConflictGuard.test.js","phase1143OfflineReconnectEmulator.test.js","phase1146StaleBookingEditGuard.test.js","phase1147TwoDeviceConflictEmulator.test.js"];
test("11.55 workflow push path filters have no duplicates", () => {
 const paths = [...workflow.matchAll(/^      - '([^']+)'$/gm)].map(m => m[1]);
 assert.equal(paths.length, new Set(paths).size, "Duplicate workflow path filters cause maintenance drift");
});
test("11.55 all legacy cloud guard tests use validated non-null snapshots", () => {
 assert.match(cloud, /val verifiedServerJson = preflight\.getString\("json"\)\s*\?: error/);
 assert.match(cloud, /val latestServerJson = latest\.getString\("json"\)\s*\?: error/);
 for (const file of tests) {
  const source = fs.readFileSync(path.join(root,"functions",file),"utf8");
  assert.ok(!source.includes('assertNoRemoteBookingsLost\\(latest\\.getString') && !source.includes('assertNoStaleBookingEdits\\(latest\\.getString') && !source.includes('assertNoStaleBookingEdits\\(preflight\\.getString'), file+" still asserts old nullable snapshot call");
 }
});
test("11.55 all source-only booking guard tests run in fast preflight", () => {
 assert.match(workflow, /name: Phase 11\.55 fast booking guard regression preflight/);
 for (const file of ["phase1133CloudConflictGuard.test.js","phase1146StaleBookingEditGuard.test.js","phase1153IsolatedAndroidEditRehearsal.test.js"])
  assert.ok(workflow.includes("functions/"+file), "Missing preflight coverage for "+file);
});
