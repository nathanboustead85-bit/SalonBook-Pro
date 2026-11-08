"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const base = "http://127.0.0.1:5001/demo-boustio-chat/europe-west2/";
const endpoints = [
  "startCustomerChat",
  "sendCustomerChatMessage",
  "getCustomerChatMessages",
  "sendBusinessChatReply"
];

test("unauthenticated calls to every chat endpoint are rejected", async () => {
  for (const endpoint of endpoints) {
    const response = await fetch(base + endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { slug: "demo-boustio", customerName: "Test", message: "Hello", businessId: "fake", conversationId: "abcdefghijklmnop" } })
    });
    assert.equal(response.status, 401, endpoint + " must reject unauthenticated requests");
  }
});
