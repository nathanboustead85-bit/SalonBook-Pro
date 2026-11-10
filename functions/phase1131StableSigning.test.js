"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const gradle = fs.readFileSync(path.join(root, "app/build.gradle.kts"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/boustio-phase-1130-android-persistence.yml"), "utf8");
test("development package remains separate from production", () => {
  assert.match(gradle, /applicationIdSuffix\s*=\s*"\.devcalendar1110"/);
});
test("CI debug signing uses a stable existing keystore", () => {
  assert.match(gradle, /signingConfig = signingConfigs\.getByName\("salonbookRelease"\)/);
  assert.match(workflow, /SIGNING_KEYSTORE_BASE64/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /SIGNING_KEYSTORE_PATH/);
  assert.match(workflow, /:app:assembleDebug/);
});
test("CI does not generate a fresh ephemeral signing key", () => {
  assert.doesNotMatch(workflow, /keytool -genkey|keytool -genkeypair/);
});
