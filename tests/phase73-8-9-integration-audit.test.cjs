const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
test("audit workflow retains every baseline job and regression command",()=>{
 const baseline=fs.readFileSync(".github/workflows/boustio-phase-73-8-8-concurrent-bookings.yml","utf8");
 const current=fs.readFileSync(".github/workflows/boustio-phase-73-8-9-integration-audit.yml","utf8");
 for(const job of ["emulator","android","native-integration","browser"])assert.ok(current.includes("  "+job+":"));
 for(const line of baseline.split("\n").filter(l=>l.trim().startsWith("- run:")))assert.ok(current.includes(line),line);
 assert.ok(!/firebase deploy|gradle.*publish|gcloud deploy/.test(current));
 assert.ok(current.includes("--project demo-boustio"));
 assert.ok(current.includes("--browser=all"));
});
