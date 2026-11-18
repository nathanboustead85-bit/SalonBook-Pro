"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","website/book/index.html"),"utf8");
test("Phase 17 booking page failure and recovery guards",async t=>{
 await t.test("Both catalogue sources handle HTTP and malformed responses",()=>{
  assert.match(html,/fetch\("\/api\/public-business\?business="/);
  assert.match(html,/if \(!response\.ok\) throw new Error\("Public profile unavailable"\)/);
  assert.match(html,/payload\.status !== "PUBLIC_PROFILE_READY"/);
  assert.match(html,/fetch\(catalogueFiles\[slug\]/);
  assert.match(html,/if \(!response\.ok\) throw new Error\("Catalogue request failed:/);
  assert.match(html,/data\.schemaVersion !== 1/);
 });
 await t.test("Network failures expose a retry without enabling bookings",()=>{
  assert.match(html,/function showError\(title, description, retryable = false\)/);
  assert.match(html,/retry\.type = "button"/);
  assert.match(html,/retry\.addEventListener\("click", \(\) => \{/);
  assert.match(html,/retry\.disabled = true;/);
  assert.match(html,/loadCatalogue\(\);\s*\}, \{once:true\}\)/);
  assert.match(html,/showError\("Business unavailable","This published business could not be loaded\.", true\)/);
  assert.match(html,/showError\("Booking preview unavailable","We couldn't load this business\. Please try again later\.", true\)/);
  assert.match(html,/Booking unavailable[^<]*preview only<\/button>/);
 });
 await t.test("Failure clears stale catalogue and avoids demo fallback",()=>{
  assert.match(html,/catalogue = null;\s*ui\.businessName\.textContent = title/);
  assert.match(html,/previousCatalogue\.remove\(\)/);
  assert.match(html,/ui\.bookingContent\.classList\.add\("hidden"\)/);
  assert.match(html,/Never substitute a demonstration catalogue for a real business/);
  assert.match(html,/showError\("Business not found","This booking link is not available\."\)/);
 });
});
