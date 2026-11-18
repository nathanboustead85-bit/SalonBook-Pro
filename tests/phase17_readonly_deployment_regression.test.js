"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");
const probes = [
  {workflow:".github/workflows/boustio-deploy-permissions-readonly.yml", script:"scripts/boustio_deploy_permissions.js", approval:"CHECK_DEPLOY_PERMISSIONS"},
  {workflow:".github/workflows/boustio-phase-1728-deployment-permissions.yml", script:"scripts/phase1728_deployment_permissions.js", approval:"CHECK_DEPLOYMENT_PERMISSIONS"}
];
const forbidden = [
  /\bfirebase\s+deploy\b/i,
  /\bgcloud\s+(?:functions|run|builds)\s+deploy\b/i,
  /\bgcloud\s+projects\s+add-iam-policy-binding\b/i,
  /\bgcloud\s+iam\s+service-accounts\s+add-iam-policy-binding\b/i,
  /\b(?:curl|wget)\b[^\n]*\b(?:DELETE|PATCH|PUT)\b/i
];
for (const {workflow,script,approval} of probes) {
  const w=read(workflow), s=read(script);
  assert.ok(w.includes("workflow_dispatch:"),workflow+" must be manual");
  assert.ok(w.includes(approval),workflow+" approval missing");
  assert.ok(w.includes("github.repository == 'nathanboustead85-bit/SalonBook-Pro'"),workflow+" repo guard missing");
  assert.ok(w.includes("github.ref == 'refs/heads/milestone-customer-booking-experience'"),workflow+" branch guard missing");
  assert.ok(w.includes("environment: boustio-function-deployment"),workflow+" protected environment missing");
  assert.ok(w.includes("persist-credentials: false"),workflow+" checkout credential protection missing");
  assert.ok(w.includes("id-token: write"),workflow+" OIDC permission missing");
  assert.ok(w.includes("node --check "+script),workflow+" script syntax gate missing");
  assert.ok(s.includes("GITHUB_REPOSITORY") && s.includes("GITHUB_REF"),script+" runtime guards missing");
  assert.ok(s.includes(approval),script+" runtime approval missing");
  for (const re of forbidden) {
    assert.ok(!re.test(w),workflow+" contains a forbidden mutation command: "+re);
    assert.ok(!re.test(s),script+" contains a forbidden mutation command: "+re);
  }
}
const production=read(".github/workflows/production-deployment.yml");
assert.ok(production.includes("github.ref == 'refs/heads/production-release'"),"Production workflow must be restricted to production-release");
assert.ok(production.includes("inputs.confirmation == 'PREPARE-BOUSTIO'"),"Production workflow must require explicit confirmation");
assert.ok(production.includes("No Firebase deployment commands executed."),"Production workflow must explicitly state no deployment");
assert.ok(!/firebase deploy --only|gcloud functions deploy|gcloud run deploy/.test(production),"Production verification must not contain deploy commands");
const website=read(".github/workflows/deploy-website.yml");
assert.ok(website.includes("firebase deploy --only hosting"),"Website deploy workflow should be recognized as a real deploy path");
assert.ok(website.includes("workflow_dispatch:"),"Website deployment must be manually triggered");
assert.ok(website.includes("github.repository == 'nathanboustead85-bit/SalonBook-Pro'"),"Website deployment must be repository restricted");
assert.ok(website.includes("github.ref == 'refs/heads/production-release'"),"Website deployment must require production-release branch");
assert.ok(website.includes("inputs.confirmation == 'DEPLOY-BOUSTIO-WEBSITE'"),"Website deployment must require explicit typed confirmation");
assert.ok(website.includes("environment: production"),"Website deployment must use production environment");
assert.ok(website.includes("persist-credentials: false"),"Website checkout must not retain credentials");
assert.ok(!/\bpush\s*:/i.test(website),"Website deployment must not run automatically on push");
console.log("PASS Phase 17 offline deployment safety regression: protected read-only probes; website deployment excluded");
