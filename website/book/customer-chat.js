"use strict";

// Phase 9E.6 — website chat client. SAFETY SWITCH:
// Remains disabled until Firebase Anonymous Auth, App Check, abuse controls,
// functions deployment and security tests have all been verified.
const CHAT_ENABLED = false;
// Public reCAPTCHA Enterprise site key. Fill only after verifying the complete key.
// Do not use a secret key here. This is deliberately fail-closed until configured.
const APP_CHECK_SITE_KEY = "6LeyyBUuAAAAABms2cBK0MoshK_016e6BEjAb2NC";
const $ = (id) => document.getElementById(id);
const nameInput = $("chatName");
const messageInput = $("chatMessage");
const sendButton = $("chatSend");
const status = $("chatStatus");
const history = $("chatHistory");
const slug = location.pathname.split("/").filter(Boolean)[1] || "demo-boustio";

let auth, callFunction, conversation = null;
let busy = false;

function setStatus(value) { status.textContent = value; }
function setEnabled(value) {
  nameInput.disabled = !value || Boolean(conversation);
  messageInput.disabled = !value;
  sendButton.disabled = !value || busy;
  sendButton.textContent = conversation ? "Send message" : "Start conversation";
}
function showMessages(messages) {
  history.classList.remove("hidden");
  history.replaceChildren();
  for (const item of messages) {
    const line = document.createElement("p");
    const sender = item.senderType === "business" ? "Business" : "You";
    line.textContent = sender + ": " + String(item.text || "").slice(0, 2000);
    history.appendChild(line);
  }
}
async function loadMessages() {
  if (!conversation) return;
  const result = await callFunction("getCustomerChatMessages", conversation);
  showMessages(result.messages || []);
  if (result.status !== "open") {
    setStatus("This conversation is closed.");
    setEnabled(false);
  }
}
async function initialize() {
  if (!CHAT_ENABLED) {
    setStatus("Customer messaging is not live yet.");
    return;
  }
  // Firebase Hosting's reserved config endpoint avoids hardcoded credentials.
  const configResponse = await fetch("/__/firebase/init.json", { cache: "no-store" });
  if (!configResponse.ok) throw new Error("Firebase configuration unavailable.");
  const config = await configResponse.json();
  const [{ initializeApp }, { getAuth, signInAnonymously },
    { getFunctions, httpsCallable },
    { initializeAppCheck, ReCaptchaEnterpriseProvider }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js")
    ]);
  const app = initializeApp(config);
  if (!APP_CHECK_SITE_KEY) throw new Error("Website App Check setup is incomplete.");
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
  auth = getAuth(app);
  const functions = getFunctions(app, "europe-west2");
  callFunction = async (name, data) => (await httpsCallable(functions, name)(data)).data;
  if (!auth.currentUser) await signInAnonymously(auth);
  const key = "boustio-chat:" + slug;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (saved && typeof saved.businessId === "string" &&
        typeof saved.conversationId === "string") conversation = saved;
  } catch (_) { /* ignore corrupted local state */ }
  if (conversation) {
    setEnabled(true);
    await loadMessages();
    setStatus("Private conversation loaded. Refresh to check for replies.");
  } else {
    setEnabled(true);
    setStatus("Start a private conversation with this business.");
  }
}
sendButton.addEventListener("click", async () => {
  if (!CHAT_ENABLED || busy || !callFunction) return;
  const message = messageInput.value.trim();
  if (!message || message.length > 2000) {
    setStatus("Enter a message of up to 2,000 characters."); return;
  }
  if (!conversation && (!nameInput.value.trim() || nameInput.value.length > 80)) {
    setStatus("Enter your name."); return;
  }
  busy = true;
  setEnabled(false);
  try {
    if (!conversation) {
      conversation = await callFunction("startCustomerChat", {
        slug, customerName: nameInput.value.trim(), message
      });
      sessionStorage.setItem("boustio-chat:" + slug, JSON.stringify({
        businessId: conversation.businessId,
        conversationId: conversation.conversationId
      }));
    } else {
      await callFunction("sendCustomerChatMessage", { ...conversation, message });
    }
    messageInput.value = "";
    await loadMessages();
    setStatus("Message sent. Refresh to check for replies.");
  } catch (error) {
    setStatus("Message not sent: " + (error.message || "Please try again."));
  } finally {
    busy = false;
    setEnabled(true);
  }
});
initialize().catch((error) => {
  setEnabled(false);
  setStatus("Messaging unavailable: " + (error.message || "Please try later."));
});
