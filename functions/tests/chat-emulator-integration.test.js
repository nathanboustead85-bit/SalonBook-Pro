"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const projectId = "demo-boustio-chat";
const app = initializeApp({ projectId }, "chat-integration");
const db = getFirestore(app);
const auth = getAuth(app);
const functionsBase = "http://127.0.0.1:5001/" + projectId + "/europe-west2/";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/";

async function guest() {
  const response = await fetch(authBase + "accounts:signUp?key=fake-api-key", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
async function owner() {
  const email = "owner-" + Date.now() + "@example.test";
  const password = "SecureTestPass123!";
  const created = await auth.createUser({ email, password, emailVerified: true });
  const response = await fetch(authBase + "accounts:signInWithPassword?key=fake-api-key", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return { uid: created.uid, idToken: result.idToken };
}
async function call(name, token, data) {
  const response = await fetch(functionsBase + name, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + token },
    body: JSON.stringify({ data })
  });
  const result = await response.json();
  return { status: response.status, data: result.result, error: result.error };
}

test("customer isolation and owner reply end-to-end", { timeout: 120000 }, async () => {
  const business = await owner();
  const alice = await guest();
  const bob = await guest();
  const slug = "test-chat-business";
  await db.collection("businessSlugs").doc(slug).set({ businessId: business.uid });
  await db.collection("publicBusinesses").doc(business.uid).set({
    businessId: business.uid, slug, published: true
  });

  const started = await call("startCustomerChat", alice.idToken, {
    slug, customerName: "Alice", message: "Hello business"
  });
  assert.equal(started.status, 200, JSON.stringify(started));
  const { businessId, conversationId } = started.data;
  assert.equal(businessId, business.uid);
  const otherRead = await call("getCustomerChatMessages", bob.idToken, { businessId, conversationId });
  assert.equal(otherRead.status, 403, JSON.stringify(otherRead));
  const otherSend = await call("sendCustomerChatMessage", bob.idToken, {
    businessId, conversationId, message: "Not my conversation"
  });
  assert.equal(otherSend.status, 403, JSON.stringify(otherSend));

  const ownerReply = await call("sendBusinessChatReply", business.idToken, {
    conversationId, message: "Hello Alice"
  });
  assert.equal(ownerReply.status, 200, JSON.stringify(ownerReply));

  const aliceRead = await call("getCustomerChatMessages", alice.idToken, { businessId, conversationId });
  assert.equal(aliceRead.status, 200, JSON.stringify(aliceRead));
  assert.deepEqual(aliceRead.data.messages.map(m => m.text), ["Hello business", "Hello Alice"]);

  // Seed the boundary in the emulator rather than sending 100 messages.
  // Verify the server rejects the 101st customer message without writing it.
  const conversationRef = db.collection("businesses").doc(businessId)
    .collection("conversations").doc(conversationId);
  await conversationRef.update({
    customerMessageCount: 100,
    lastCustomerMessageMs: 0
  });
  const beforeQuota = await conversationRef.collection("messages").get();
  const overQuota = await call("sendCustomerChatMessage", alice.idToken, {
    businessId, conversationId, message: "Message 101 should be rejected"
  });
  assert.equal(overQuota.status, 429, JSON.stringify(overQuota));
  const afterQuota = await conversationRef.collection("messages").get();
  assert.equal(afterQuota.size, beforeQuota.size, "quota rejection must not create a message");
  await conversationRef.update({ customerMessageCount: 2 });

  const bobOwnerAttempt = await call("sendBusinessChatReply", bob.idToken, {
    conversationId, message: "Impersonation"
  });
  assert.notEqual(bobOwnerAttempt.status, 200);

  // A guest may send again after the server-side cooldown.
  await new Promise(resolve => setTimeout(resolve, 5100));
  const followUp = await call("sendCustomerChatMessage", alice.idToken, {
    businessId, conversationId, message: "Thank you"
  });
  assert.equal(followUp.status, 200, JSON.stringify(followUp));
});
test.after(async () => { await deleteApp(app); });
