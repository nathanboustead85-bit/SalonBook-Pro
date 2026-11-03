"use strict";

/**
 * BOUSTIO — PHASE 8C.7
 * Trusted Catalogue Security Tests
 *
 * 15 tests covering:
 * - Business ownership
 * - Publication and booking status
 * - Service data
 * - Staff assignments and schedules
 * - Firestore catalogue loading
 *
 * Uses an in-memory Firestore substitute.
 * No Firebase deployment or network access.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateCatalogue,
  loadTrustedCatalogue
} = require("./trustedCatalogue");

const OWNER = "test-owner";

function makeCatalogue() {
  return {
    schemaVersion: 1,
    business: {
      ownerUid: OWNER,
      published: true,
      acceptingBookings: true
    },
    services: [
      {
        id: "haircut",
        name: "Haircut",
        durationMinutes: 30,
        price: 20,
        active: true
      },
      {
        id: "beard",
        name: "Beard Trim",
        durationMinutes: 15,
        price: 10,
        active: true
      }
    ],
    staff: [
      {
        id: "kody",
        name: "Kody",
        active: true,
        serviceIds: ["haircut", "beard"],
        weeklySchedule: {
          monday: {
            open: "09:00",
            close: "17:00"
          },
          saturday: null
        },
        weeklyBreaks: [
          {
            day: "monday",
            start: "12:00",
            end: "12:30"
          }
        ],
        timeOff: []
      }
    ],
    workingHours: {}
  };
}

function fakeFirestore(data, exists = true) {
  const calls = [];

  const db = {
    collection(name) {
      calls.push(name);

      return {
        doc(id) {
          calls.push(id);

          return {
            collection(subcollection) {
              calls.push(subcollection);

              return {
                doc(documentId) {
                  calls.push(documentId);

                  return {
                    async get() {
                      return {
                        exists,
                        data() {
                          return data;
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  return { db, calls };
}

// 01 — VALID CATALOGUE

test("01 accepts a valid catalogue", () => {
  const result = validateCatalogue(
    makeCatalogue(),
    OWNER
  );

  assert.equal(
    result.business.ownerUid,
    OWNER
  );

  assert.equal(result.services.length, 2);
  assert.equal(result.staff.length, 1);
});

// 02 — INVALID BUSINESS ID

test("02 rejects an invalid business identifier", () => {
  assert.throws(
    () => validateCatalogue(
      makeCatalogue(),
      "invalid/business"
    ),
    /Invalid business identifier/
  );
});

// 03 — WRONG OWNER

test("03 rejects mismatched business ownership", () => {
  assert.throws(
    () => validateCatalogue(
      makeCatalogue(),
      "another-owner"
    ),
    /ownership mismatch/
  );
});

// 04 — MISSING OWNER

test("04 rejects a missing owner UID", () => {
  const data = makeCatalogue();

  delete data.business.ownerUid;

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /ownership mismatch/
  );
});

// 05 — UNPUBLISHED

test("05 rejects an unpublished business", () => {
  const data = makeCatalogue();

  data.business.published = false;

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /not accepting bookings/
  );
});

// 06 — BOOKINGS DISABLED

test("06 rejects disabled customer bookings", () => {
  const data = makeCatalogue();

  data.business.acceptingBookings = false;

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /not accepting bookings/
  );
});

// 07 — UNSUPPORTED VERSION

test("07 rejects unsupported catalogue versions", () => {
  const data = makeCatalogue();

  data.schemaVersion = 99;

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /Unsupported catalogue version/
  );
});

// 08 — NEGATIVE PRICE

test("08 rejects negative service prices", () => {
  const data = makeCatalogue();

  data.services[0].price = -20;

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /service information is invalid/
  );
});

// 09 — INVALID DURATION

test("09 rejects invalid service duration", () => {
  const data = makeCatalogue();

  data.services[0].durationMinutes = 0;

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /service information is invalid/
  );
});

// 10 — DUPLICATE SERVICE

test("10 rejects duplicate service IDs", () => {
  const data = makeCatalogue();

  data.services[1].id = "haircut";

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /service information is invalid/
  );
});

// 11 — UNKNOWN STAFF SERVICE

test("11 rejects unknown service assignments", () => {
  const data = makeCatalogue();

  data.staff[0].serviceIds = [
    "nonexistent-service"
  ];

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /staff information is invalid/
  );
});

// 12 — INVALID WORKING HOURS

test("12 rejects invalid staff working hours", () => {
  const data = makeCatalogue();

  data.staff[0].weeklySchedule.monday = {
    open: "17:00",
    close: "09:00"
  };

  assert.throws(
    () => validateCatalogue(data, OWNER),
    /staff information is invalid/
  );
});

// 13 — VALID FIRESTORE LOAD

test("13 loads catalogue from the correct Firestore path", async () => {
  const { db, calls } = fakeFirestore(
    makeCatalogue()
  );

  const result = await loadTrustedCatalogue({
    db,
    businessId: OWNER
  });

  assert.deepEqual(calls, [
    "businesses",
    OWNER,
    "catalogue",
    "current"
  ]);

  assert.equal(
    result.business.ownerUid,
    OWNER
  );

  assert.equal(result.services[0].price, 20);
});

// 14 — MISSING FIRESTORE DOCUMENT

test("14 rejects a missing Firestore catalogue", async () => {
  const { db } = fakeFirestore(
    null,
    false
  );

  await assert.rejects(
    loadTrustedCatalogue({
      db,
      businessId: OWNER
    }),
    /has not been published/
  );
});

// 15 — UNAVAILABLE DATABASE

test("15 rejects an unavailable database", async () => {
  await assert.rejects(
    loadTrustedCatalogue({
      db: null,
      businessId: OWNER
    }),
    /Database is unavailable/
  );
});
