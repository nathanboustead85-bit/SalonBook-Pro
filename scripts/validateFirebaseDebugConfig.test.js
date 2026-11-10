const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {clients} = require('./validateFirebaseDebugConfig');
const root = path.resolve(__dirname, '..');
test('production config retains registered production package', () => {
  const prod = JSON.parse(fs.readFileSync(path.join(root,'app/google-services.json'),'utf8'));
  assert.ok(clients(prod).includes('com.salonbook.pro'));
});
test('development build remains isolated from production installation', () => {
  const gradle = fs.readFileSync(path.join(root,'app/build.gradle.kts'),'utf8');
  assert.match(gradle, /applicationIdSuffix\s*=\s*"\.devcalendar1110"/);
});
test('Firebase debug configuration is not silently substituted by production', () => {
  const workflow = fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-1130-android-persistence.yml'),'utf8');
  assert.match(workflow, /BOUSTIO_DEBUG_GOOGLE_SERVICES_B64/);
  assert.match(workflow, /validateFirebaseDebugConfig\.js/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /test -n "\$BOUSTIO_DEBUG_GOOGLE_SERVICES_B64"/);
});
