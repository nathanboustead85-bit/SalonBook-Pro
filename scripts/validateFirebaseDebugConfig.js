#!/usr/bin/env node
// Validate Firebase Android client selection before packaging a debug APK.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const productionPath = path.join(root, 'app/google-services.json');
const debugPath = path.join(root, 'app/src/debug/google-services.json');
const gradlePath = path.join(root, 'app/build.gradle.kts');
function load(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function clients(config) { return (config.client || []).map(c => c.client_info?.android_client_info?.package_name).filter(Boolean); }
function validate() {
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  const suffix = gradle.match(/applicationIdSuffix\s*=\s*"([^"]+)"/)?.[1];
  const appId = gradle.match(/applicationId\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(appId, 'Missing applicationId in app/build.gradle.kts');
  assert.ok(suffix, 'Expected isolated debug applicationIdSuffix; do not reuse production package');
  const prod = load(productionPath);
  assert.ok(clients(prod).includes(appId), 'Production Firebase config does not match production applicationId');
  assert.ok(fs.existsSync(debugPath), 'Missing dedicated debug Firebase configuration. Register Android app '+appId+suffix+' in Firebase project '+prod.project_info.project_id+'; add its downloaded google-services.json as GitHub Actions secret BOUSTIO_DEBUG_GOOGLE_SERVICES_JSON. Do not copy/rename production config.');
  const debug = load(debugPath);
  assert.equal(debug.project_info?.project_id, prod.project_info?.project_id, 'Debug Firebase project must match production Firebase project');
  const client = (debug.client || []).find(c => c.client_info?.android_client_info?.package_name === appId + suffix);
  assert.ok(client, 'Debug Firebase config must contain registered Android client '+appId+suffix);
  assert.match(client.client_info?.mobilesdk_app_id || '', /^1:\d+:android:[a-fA-F0-9]+$/, 'Missing valid Firebase Android app ID');
  assert.match(client.api_key?.[0]?.current_key || '', /^AIza[\w-]{35}$/, 'Missing/malformed Firebase API key');
  assert.notEqual(client.client_info.mobilesdk_app_id, (prod.client || []).find(c => c.client_info?.android_client_info?.package_name === appId)?.client_info?.mobilesdk_app_id, 'Debug must use a separately registered Firebase Android app');
  console.log('Firebase debug client matches '+appId+suffix+' in project '+debug.project_info.project_id+'. Note: API key validity/restrictions require live sign-in verification.');
}
if (require.main === module) { try { validate(); } catch (e) { console.error('Firebase debug validation failed: '+e.message); process.exitCode = 1; } }
module.exports = { validate, clients };
