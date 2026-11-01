"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

function verifiedUser(request) {
  const auth = request.auth;

  if (!auth || !auth.uid || auth.token.email_verified !== true) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in with a verified email account."
    );
  }

  return auth.uid;
}

function validSlug(value) {
  return typeof value === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length >= 3 &&
    value.length <= 50;
}

function safeText(value, maxLength) {
  return typeof value === "string" &&
    value.length <= maxLength;
}

function validateProfile(profile, uid) {
  if (!profile || profile.businessId !== uid) {
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

    const result = await db.runTransaction(async (transaction) => {
      const privateSnapshot = await transaction.get(profileRef);

      if (!privateSnapshot.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Create your business profile first."
        );
      }

      const profile = privateSnapshot.data();
      validateProfile(profile, uid);

      const slug = profile.slug;

      const slugRef = db
        .collection("businessSlugs")
        .doc(slug);

      const oldPublicSnapshot = await transaction.get(publicRef);
      const slugSnapshot = await transaction.get(slugRef);

      const previousSlug = oldPublicSnapshot.exists
        ? oldPublicSnapshot.get("slug")
        : null;

      let previousSlugRef = null;
      let previousSlugSnapshot = null;

      if (previousSlug && previousSlug !== slug) {
        previousSlugRef = db
          .collection("businessSlugs")
          .doc(previousSlug);

        previousSlugSnapshot =
          await transaction.get(previousSlugRef);
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

      // Never publish the owner's login email.
      // Only explicitly approved public fields are copied.
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
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.set(slugRef, {
        businessId: uid,
        updatedAt: FieldValue.serverTimestamp()
      });

      transaction.set(publicRef, publicProfile);

      if (
        previousSlugRef &&
        previousSlugSnapshot.exists &&
        previousSlugSnapshot.get("businessId") === uid
      ) {
        transaction.delete(previousSlugRef);
      }

      return {
        success: true,
        businessId: uid,
        slug,
        bookingUrl:
          "https://salonbook-pro-ad5ff.web.app/book/" +
          encodeURIComponent(slug)
      };
    });

    return result;
  }
);

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

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(publicRef);

      if (!snapshot.exists) {
        return;
      }

      // Keep the slug reserved to its existing owner.
      // This prevents someone else taking a previously
      // advertised business booking link.
      transaction.update(publicRef, {
        published: false,
        acceptingBookings: false,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return {
      success: true,
      published: false
    };
  }
);
