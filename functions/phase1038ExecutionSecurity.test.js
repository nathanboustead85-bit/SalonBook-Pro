"use strict";
/** Phase 10.38: source-level release gates; no credentials, Firestore or production calls. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("production function entrypoint does not export or import legacy initializer",()=>{
 const index=read("index.js");
 assert.doesNotMatch(index,/controlledLegacyModeInitialization|initialiseArchivedLegacyMode|initialiseLegacyMode/);
});
test("controlled initializer remains disabled unless explicitly enabled",()=>{
 const source=read("controlledLegacyModeInitialization.js");
 assert.match(source,/executionEnabled\s*=\s*false/);
 assert.match(source,/executionEnabled\s*!==\s*true/);
});
test("controlled initializer checks archive owner path",()=>{
 const source=read("controlledLegacyModeInitialization.js");
 assert.match(source,/archive\.sourcePath/);
 assert.match(source,/authenticatedUid/);
});
test("controlled initializer checks mode marker source appointments locks in transaction",()=>{
 const source=read("controlledLegacyModeInitialization.js");
 assert.match(source,/runTransaction/);
 for(const name of ["modeSnap","markerSnap","sourceSnap","appointmentsSnap","locksSnap"])
  assert.ok(source.includes(name),name);
 assert.match(source,/tx\.create\(mode,/);
 assert.doesNotMatch(source,/tx\.(?:delete|update|set)\(/);
});
test("legacy initializer is not exposed by bookingMode module through index",()=>{
 const index=read("index.js");
 assert.doesNotMatch(index,/require\(["']\.\/bookingMode["']\)/);
});
