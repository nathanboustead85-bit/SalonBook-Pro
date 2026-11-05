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
