"use strict";

/**
 * BOUSTIO — PHASE 8C.9
 *
 * Firebase Cloud Functions.
 *
 * Active exported functions:
 * - publishBusiness
 * - unpublishBusiness
 *
 * Secure booking logic is maintained
 * separately in trustedBooking.js.
 *
 * No public booking endpoint is enabled.
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

/**
 * Verify Firebase Authentication.
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
 * PHASE 7C
 *
 * Publish a business profile.
 *
 * This function never enables
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
          bookingUrl:
            "https://salonbook-pro-ad5ff.web.app/book/" +
            encodeURIComponent(slug)
        };
      }
    );

    return result;
  }
);

/**
 * PHASE 7C
 *
 * Unpublish a business.
 *
 * The slug remains reserved
 * to its existing owner.
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
 * PHASE 8C.9
 *
 * Booking integration is now maintained
 * in the separate trustedBooking.js module.
 *
 * That module:
 *
 * - Verifies the public business document
 * - Loads the trusted Firestore catalogue
 * - Checks business ownership
 * - Excludes customer-supplied prices
 * - Invokes the transactional booking engine
 *
 * It is not exposed through an HTTP
 * or callable Firebase endpoint.
 *
 * Before public bookings can be enabled:
 *
 * 1. Publish trusted catalogues
 * 2. Synchronise existing Android bookings
 * 3. Migrate existing bookings into locks
 * 4. Test real Firestore transactions
 * 5. Add abuse prevention
 * 6. Complete end-to-end testing
 *
 * Keep acceptingBookings disabled
 * until these requirements are met.
 */
