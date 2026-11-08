"use strict";

/**
 * BOUSTIO — PHASE 8D.80
 *
 * Firebase Cloud Functions.
 *
 * Active exports:
 * - publishBusiness
 * - unpublishBusiness
 *
 * Booking endpoints remain disabled.
 *
 * Domain preparation:
 * - Existing Firebase URL remains default.
 * - Boustio domain can be activated later
 *   through BOUSTIO_PUBLIC_BASE_URL.
 *
 * DO NOT ENABLE LIVE BOOKINGS YET.
 */

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  initializeApp
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const DEFAULT_PUBLIC_BASE_URL =
  "https://salonbook-pro-ad5ff.web.app";

const BOUSTIO_PUBLIC_DOMAIN =
  "https://boustio.co.uk";

/**
 * Keep the existing URL until custom-domain
 * hosting, DNS and HTTPS are verified.
 *
 * This value is server-controlled, never
 * accepted from customer requests.
 */
function publicBaseUrl() {
  const configured =
    process.env.BOUSTIO_PUBLIC_BASE_URL;

  if (
    configured === BOUSTIO_PUBLIC_DOMAIN
  ) {
    return BOUSTIO_PUBLIC_DOMAIN;
  }

  return DEFAULT_PUBLIC_BASE_URL;
}

function bookingUrl(slug) {
  return (
    publicBaseUrl() +
    "/book/" +
    encodeURIComponent(slug)
  );
}

/**
 * Require a verified Firebase account.
 */
function verifiedUser(request) {
  const auth = request.auth;

  if (
    !auth ||
    !auth.uid ||
    auth.token.email_verified !== true
  ) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in with a verified email account."
    );
  }

  return auth.uid;
}

/**
 * Validate business URL slug.
 */
function validSlug(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length >= 3 &&
    value.length <= 50
  );
}

/**
 * Validate text field length.
 */
function safeText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.length <= maxLength
  );
}

/**
 * Validate private business profile.
 */
function validateProfile(profile, uid) {
  if (
    !profile ||
    profile.businessId !== uid
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Business ownership could not be verified."
    );
  }

  if (
    !safeText(profile.name, 100) ||
    profile.name.trim().length < 3 ||
    !validSlug(profile.slug) ||
    !safeText(profile.category, 100) ||
    !safeText(profile.phone, 50) ||
    !safeText(profile.address, 500) ||
    !safeText(profile.description, 2000)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "The business profile contains invalid information."
    );
  }
}

/**
 * Publish a business profile.
 *
 * Publishing a catalogue does not enable
 * live customer bookings.
 */
exports.publishBusiness = onCall(
  {
    region: "europe-west2",
    maxInstances: 10,
    enforceAppCheck: false
  },
  async (request) => {
    const uid = verifiedUser(request);

    const profileRef = db
      .collection("users")
      .doc(uid)
      .collection("business")
      .doc("profile");

    const publicRef = db
      .collection("publicBusinesses")
      .doc(uid);

    const result = await db.runTransaction(
      async (transaction) => {
        const privateSnapshot =
          await transaction.get(profileRef);

        if (!privateSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            "Create your business profile first."
          );
        }

        const profile =
          privateSnapshot.data();

        validateProfile(profile, uid);

        const slug = profile.slug;

        const slugRef = db
          .collection("businessSlugs")
          .doc(slug);

        const oldPublicSnapshot =
          await transaction.get(publicRef);

        const slugSnapshot =
          await transaction.get(slugRef);

        const previousSlug =
          oldPublicSnapshot.exists
            ? oldPublicSnapshot.get("slug")
            : null;

        let previousSlugRef = null;
        let previousSlugSnapshot = null;

        if (
          previousSlug &&
          previousSlug !== slug
        ) {
          previousSlugRef = db
            .collection("businessSlugs")
            .doc(previousSlug);

          previousSlugSnapshot =
            await transaction.get(
              previousSlugRef
            );
        }

        if (
          slugSnapshot.exists &&
          slugSnapshot.get("businessId") !== uid
        ) {
          throw new HttpsError(
            "already-exists",
            "This booking link is already taken."
          );
        }

        const publicProfile = {
          businessId: uid,
          name: profile.name.trim(),
          slug,
          category: profile.category,
          phone: profile.phone,
          address: profile.address,
          description: profile.description,
          published: true,
          acceptingBookings: false,
          schemaVersion: 1,
          updatedAt:
            FieldValue.serverTimestamp()
        };

        transaction.set(
          slugRef,
          {
            businessId: uid,
            updatedAt:
              FieldValue.serverTimestamp()
          }
        );

        transaction.set(
          publicRef,
          publicProfile
        );

        if (
          previousSlugRef &&
          previousSlugSnapshot.exists &&
          previousSlugSnapshot.get(
            "businessId"
          ) === uid
        ) {
          transaction.delete(
            previousSlugRef
          );
        }

        return {
          success: true,
          businessId: uid,
          slug,
          bookingUrl: bookingUrl(slug)
        };
      }
    );

    return result;
  }
);

/**
 * Unpublish a business.
 *
 * Its slug remains reserved to its owner.
 */
exports.unpublishBusiness = onCall(
  {
    region: "europe-west2",
    maxInstances: 10,
    enforceAppCheck: false
  },
  async (request) => {
    const uid = verifiedUser(request);

    const publicRef = db
      .collection("publicBusinesses")
      .doc(uid);

    await db.runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(publicRef);

        if (!snapshot.exists) {
          return;
        }

        transaction.update(
          publicRef,
          {
            published: false,
            acceptingBookings: false,
            updatedAt:
              FieldValue.serverTimestamp()
          }
        );
      }
    );

    return {
      success: true,
      published: false
    };
  }
);

/**
 * BOOKING DEPLOYMENT SAFETY
 *
 * trustedBooking.js remains internal.
 *
 * Before enabling customer bookings:
 * 1. Complete final security checks.
 * 2. Verify all Android booking data synced.
 * 3. Test verified migration.
 * 4. Confirm Firestore transaction safety.
 * 5. Add production abuse prevention.
 * 6. Complete end-to-end testing.
 *
 * acceptingBookings must remain false
 * until the production release is approved.
 */

/**
 * Phase 9E.10 — server-side chat release gate.
 * A deployed function stays disabled unless explicitly enabled in its
 * environment. This is independent of the website's disabled UI switch.
 */
function requireChatEnabled() {
  if (process.env.BOUSTIO_CHAT_ENABLED !== "true") {
    throw new HttpsError("failed-precondition", "Customer messaging is not enabled.");
  }
}

/**
 * PHASE 9E.3 — OWNER REPLY BACKEND
 *
 * Only a verified business owner may reply to a conversation
 * belonging to their own business. Customer message creation
 * remains disabled until customer identity and abuse protection
 * are implemented.
 */
exports.sendBusinessChatReply = onCall(
  {
    region: "europe-west2",
    maxInstances: 10,
    enforceAppCheck: false
  },
  async (request) => {
    const uid = verifiedUser(request);
    requireChatEnabled();
    const input = request.data || {};
    const conversationId = input.conversationId;
    const body = input.message;

    if (
      typeof conversationId !== "string" ||
      !/^[A-Za-z0-9_-]{12,128}$/.test(conversationId) ||
      typeof body !== "string" ||
      body.trim().length < 1 ||
      body.length > 2000
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid conversation or message."
      );
    }

    const conversationRef = db
      .collection("businesses")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId);

    const messageRef = conversationRef
      .collection("messages")
      .doc();

    await db.runTransaction(async (transaction) => {
      const conversation = await transaction.get(conversationRef);
      if (
        !conversation.exists ||
        conversation.get("businessId") !== uid ||
        conversation.get("status") === "closed"
      ) {
        throw new HttpsError(
          "not-found",
          "An active conversation was not found."
        );
      }

      // Store text only. Attachments are intentionally disabled.
      transaction.create(messageRef, {
        businessId: uid,
        conversationId,
        senderType: "business",
        senderId: uid,
        text: body.trim(),
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1
      });
      transaction.update(conversationRef, {
        lastMessage: body.trim().slice(0, 180),
        lastMessageSender: "business",
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return { success: true, messageId: messageRef.id };
  }
);


/**
 * PHASE 9E.5 — CUSTOMER CHAT BACKEND (STAGING)
 * Anonymous Firebase Authentication provides a distinct session per browser.
 * Customer reads and writes use callable functions only; Firestore client rules
 * remain owner-read-only. Do not deploy publicly before abuse tests/App Check.
 */
function customerChatIdentity(request) {
  const auth = request.auth;
  if (!auth || typeof auth.uid !== "string" || !auth.token.firebase ||
      auth.token.firebase.sign_in_provider !== "anonymous") {
    throw new HttpsError("unauthenticated", "Start a private guest session first.");
  }
  return auth.uid;
}

function chatText(value, max) {
  return typeof value === "string" &&
    value.trim().length > 0 && value.length <= max;
}

function chatConversationId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12,128}$/.test(value);
}

function customerConversationRef(businessId, conversationId) {
  return db.collection("businesses").doc(businessId)
    .collection("conversations").doc(conversationId);
}

exports.startCustomerChat = onCall(
  { region: "europe-west2", maxInstances: 10, enforceAppCheck: false },
  async (request) => {
    const uid = customerChatIdentity(request);
    requireChatEnabled();
    const input = request.data || {};
    const slug = input.slug;
    const name = input.customerName;
    const message = input.message;
    if (!validSlug(slug) || !chatText(name, 80) || !chatText(message, 2000)) {
      throw new HttpsError("invalid-argument", "Enter a name and message.");
    }

    const slugSnapshot = await db.collection("businessSlugs").doc(slug).get();
    if (!slugSnapshot.exists) {
      throw new HttpsError("not-found", "Business not found.");
    }
    const businessId = slugSnapshot.get("businessId");
    if (typeof businessId !== "string") {
      throw new HttpsError("not-found", "Business not found.");
    }
    const publicSnapshot = await db.collection("publicBusinesses").doc(businessId).get();
    if (!publicSnapshot.exists || publicSnapshot.get("published") !== true ||
        publicSnapshot.get("slug") !== slug) {
      throw new HttpsError("not-found", "Business is not available.");
    }

    // One initial conversation per guest account and business.
    // Stable ID prevents repeated guest starts creating unlimited threads.
    const crypto = require("node:crypto");
    const conversationId = crypto.createHash("sha256")
      .update(businessId + ":" + uid).digest("hex");
    const conversationRef = customerConversationRef(businessId, conversationId);
    const messageRef = conversationRef.collection("messages").doc();
    const now = Date.now();
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(conversationRef);
      if (existing.exists) {
        throw new HttpsError("already-exists", "Conversation already started. Continue it instead.");
      }
      tx.create(conversationRef, {
        businessId, customerUid: uid, customerName: name.trim(),
        status: "open", lastMessage: message.trim().slice(0, 180),
        lastMessageSender: "customer", updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(), lastCustomerMessageMs: now,
        schemaVersion: 1
      });
      tx.create(messageRef, {
        businessId, conversationId, senderType: "customer", senderId: uid,
        text: message.trim(), createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1
      });
    });
    return { success: true, businessId, conversationId };
  }
);

exports.sendCustomerChatMessage = onCall(
  { region: "europe-west2", maxInstances: 10, enforceAppCheck: false },
  async (request) => {
    const uid = customerChatIdentity(request);
    requireChatEnabled();
    const input = request.data || {};
    const { businessId, conversationId, message } = input;
    if (typeof businessId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(businessId) ||
        !chatConversationId(conversationId) || !chatText(message, 2000)) {
      throw new HttpsError("invalid-argument", "Invalid message.");
    }
    const ref = customerConversationRef(businessId, conversationId);
    const msgRef = ref.collection("messages").doc();
    const now = Date.now();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get("customerUid") !== uid ||
          snap.get("businessId") !== businessId || snap.get("status") !== "open") {
        throw new HttpsError("permission-denied", "Conversation unavailable.");
      }
      if (now - (snap.get("lastCustomerMessageMs") || 0) < 5000) {
        throw new HttpsError("resource-exhausted", "Please wait before sending another message.");
      }
      tx.create(msgRef, {
        businessId, conversationId, senderType: "customer", senderId: uid,
        text: message.trim(), createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1
      });
      tx.update(ref, {
        lastMessage: message.trim().slice(0, 180),
        lastMessageSender: "customer", lastCustomerMessageMs: now,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    return { success: true };
  }
);

exports.getCustomerChatMessages = onCall(
  { region: "europe-west2", maxInstances: 10, enforceAppCheck: false },
  async (request) => {
    const uid = customerChatIdentity(request);
    requireChatEnabled();
    const input = request.data || {};
    const { businessId, conversationId } = input;
    if (typeof businessId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(businessId) ||
        !chatConversationId(conversationId)) {
      throw new HttpsError("invalid-argument", "Invalid conversation.");
    }
    const ref = customerConversationRef(businessId, conversationId);
    const snap = await ref.get();
    if (!snap.exists || snap.get("customerUid") !== uid ||
        snap.get("businessId") !== businessId) {
      throw new HttpsError("permission-denied", "Conversation unavailable.");
    }
    const messages = await ref.collection("messages")
      .orderBy("createdAt", "desc").limit(50).get();
    return {
      status: snap.get("status") || "open",
      messages: messages.docs.reverse().map((doc) => ({
        id: doc.id,
        senderType: doc.get("senderType"),
        text: doc.get("text"),
        createdAtMs: doc.get("createdAt")?.toMillis?.() || null
      }))
    };
  }
);
