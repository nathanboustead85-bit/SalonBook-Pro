"use strict";

/**
 * BOUSTIO — PHASE 8C.8
 *
 * Firebase Cloud Functions.
 *
 * Existing functions preserved:
 * - publishBusiness
 * - unpublishBusiness
 *
 * New internal booking integration:
 * - load trusted catalogue
 * - verify public business status
 * - call secure booking engine
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

const {
  loadTrustedCatalogue
} = require("./trustedCatalogue");

const {
  createBooking
} = require("./bookingEngine");

initializeApp();

const db = getFirestore();

/**
 * Existing authentication check.
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
 * Existing slug validation.
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
 * Existing text validation.
 */
function safeText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.length <= maxLength
  );
}

/**
 * Existing business profile validation.
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
 * Publish a business profile.
 *
 * Public booking remains disabled.
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
 * Unpublish business.
 *
 * Keeps the existing slug reserved.
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
 * PHASE 8C.8
 * INTERNAL TRUSTED BOOKING INTEGRATION
 *
 * This is intentionally NOT exported as a
 * Firebase Cloud Function.
 *
 * No HTTP or callable booking endpoint
 * exists yet.
 *
 * Future requirements before activation:
 *
 * 1. Trusted catalogue publishing
 * 2. Android booking synchronisation
 * 3. Existing booking lock migration
 * 4. Firestore transaction integration
 * 5. Abuse prevention and rate limiting
 * 6. End-to-end emulator testing
 *
 * The public business document is checked
 * independently of the catalogue.
 */
async function createTrustedBooking(
  bookingRequest
) {
  if (
    !bookingRequest ||
    typeof bookingRequest !== "object" ||
    Array.isArray(bookingRequest)
  ) {
    throw new Error(
      "Invalid booking request."
    );
  }

  const businessId =
    bookingRequest.businessId;

  if (
    typeof businessId !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(
      businessId
    )
  ) {
    throw new Error(
      "Invalid business identifier."
    );
  }

  const publicRef = db
    .collection("publicBusinesses")
    .doc(businessId);

  const publicSnapshot =
    await publicRef.get();

  if (!publicSnapshot.exists) {
    throw new Error(
      "Business is unavailable."
    );
  }

  const publicBusiness =
    publicSnapshot.data();

  if (
    !publicBusiness ||
    publicBusiness.businessId !== businessId ||
    publicBusiness.published !== true ||
    publicBusiness.acceptingBookings !== true
  ) {
    throw new Error(
      "Business is not accepting bookings."
    );
  }

  const catalogue =
    await loadTrustedCatalogue({
      db,
      businessId
    });

  if (
    catalogue.business.ownerUid !== businessId
  ) {
    throw new Error(
      "Business ownership mismatch."
    );
  }

  return createBooking({
    db,
    catalogue,
    request: bookingRequest
  });
}

/**
 * SECURITY NOTE
 *
 * createTrustedBooking is private to
 * this module and cannot be invoked
 * directly by a customer.
 *
 * It is deliberately not exported.
 *
 * Existing Android appointments are not
 * yet represented by the booking locks
 * used by the server booking engine.
 *
 * Public booking activation must wait
 * until both systems share a consistent
 * conflict-prevention mechanism.
 */
