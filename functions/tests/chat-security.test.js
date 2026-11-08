"use strict";
/**
 * Phase 9E.7: pre-deployment security regression checks.
 * These are source-level guardrails, NOT emulator integration tests.
 * Run: node --test functions/tests/chat-security.test.js
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const backend = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const website = fs.readFileSync(path.join(__dirname, "../../website/book/customer-chat.js"), "utf8");
const rules = fs.readFileSync(path.join(__dirname, "../../firestore.rules"), "utf8");

test("customer chat remains disabled on public website", () => {
  assert.match(website, /const CHAT_ENABLED = false;/);
});
test("customer endpoints require anonymous Firebase authentication", () => {
  assert.match(backend, /function customerChatIdentity\(request\)/);
  assert.match(backend, /sign_in_provider !== "anonymous"/);
  for (const name of ["startCustomerChat", "sendCustomerChatMessage", "getCustomerChatMessages"]) {
    const start = backend.indexOf("exports." + name + " = onCall(");
    assert.ok(start >= 0, name + " must exist");
    const next = backend.indexOf("\nexports.", start + 1);
    const block = backend.slice(start, next < 0 ? undefined : next);
    assert.match(block, /customerChatIdentity\(request\)/, name + " must authenticate");
  }
});
test("customer reads and sends verify conversation ownership", () => {
  for (const name of ["sendCustomerChatMessage", "getCustomerChatMessages"]) {
    const start = backend.indexOf("exports." + name + " = onCall(");
    const next = backend.indexOf("\nexports.", start + 1);
    const block = backend.slice(start, next < 0 ? undefined : next);
    assert.match(block, /customerUid"\) !== uid/);
    assert.match(block, /businessId"\) !== businessId/);
  }
});
test("business replies require verified owner and conversation business match", () => {
  const start = backend.indexOf("exports.sendBusinessChatReply = onCall(");
  const end = backend.indexOf("PHASE 9E.5", start);
  const block = backend.slice(start, end);
  assert.match(block, /verifiedUser\(request\)/);
  assert.match(block, /businessId"\) !== uid/);
});
test("client Firestore chat writes remain denied", () => {
  const start = rules.indexOf("match /businesses/{businessId}/conversations/{conversationId}");
  assert.ok(start >= 0, "chat rules must exist");
  const block = rules.slice(start, start + 500);
  assert.match(block, /allow create, update, delete: if false;/);
});
test("message size and customer throttling checks are present", () => {
  assert.match(backend, /chatText\(message, 2000\)/);
  assert.match(backend, /lastCustomerMessageMs/);
  assert.match(backend, /< 5000/);
});
test("production readiness blockers are visible", () => {
  assert.match(backend, /enforceAppCheck: false/);
  assert.match(website, /CHAT_ENABLED = false/);
});

test("all four chat endpoints require server-side release gate", () => {
  assert.match(backend, /process\.env\.BOUSTIO_CHAT_ENABLED !== "true"/);
  for (const name of ["sendBusinessChatReply", "startCustomerChat", "sendCustomerChatMessage", "getCustomerChatMessages"]) {
    const start = backend.indexOf("exports." + name + " = onCall(");
    const next = backend.indexOf("\nexports.", start + 1);
    const block = backend.slice(start, next < 0 ? undefined : next);
    assert.match(block, /requireChatEnabled\(\)/, name + " must be release-gated");
  }
});


test("website App Check uses the registered Enterprise site key before customer authentication", () => {
  assert.match(website, /const APP_CHECK_SITE_KEY = "6LeyyBUuAAAAABms2cBK0MoshK_016e6BEjAb2NC";/);
  assert.match(website, /firebase-app-check\.js/);
  assert.match(website, /new ReCaptchaEnterpriseProvider\(APP_CHECK_SITE_KEY\)/);
  assert.match(website, /initializeAppCheck\(app,/);
  assert.ok(website.indexOf("initializeAppCheck(app,") < website.indexOf("signInAnonymously(auth)"));
});
