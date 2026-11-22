"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {mountIsolatedDashboard}=require("../web/phase40/browser-dashboard-40-2");
test("rejects incomplete browser dependencies",()=>{assert.throws(()=>mountIsolatedDashboard({}),/isolated_browser_dependencies_required/)});
test("adapter never exports live write or deployment capabilities",()=>{const src=require("node:fs").readFileSync(require("node:path").resolve(__dirname,"../web/phase40/browser-dashboard-40-2.js"),"utf8");for(const term of ["initializeApp(","setDoc(","updateDoc(","deleteDoc(","firebase deploy"])assert.equal(src.includes(term),false)});
