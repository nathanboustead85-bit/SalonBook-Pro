"use strict";

/**
 * BOUSTIO — PHASE 8C.3
 * Automated booking engine tests.
 *
 * Run with:
 * node --test bookingEngine.test.js
 *
 * Uses an in-memory Firestore simulator.
 * Does not connect to Firebase.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateRequest,
  validateAvailability,
  createLockIds,
  createBooking
} = require("./bookingEngine");

const catalogue = {
  business: {
    published: true,
    acceptingBookings: true
  },
  services: [
    {
      id: "haircut",
      name: "Standard Haircut",
      durationMinutes: 30,
      price: 18,
      active: true
    },
    {
      id: "beard",
      name: "Beard Trim",
      durationMinutes: 20,
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
          close: "18:00"
        },
        thursday: {
          open: "09:00",
          close: "18:00"
        },
        saturday: null
      },
      weeklyBreaks: [
        {
          day: "monday",
          start: "12:30",
          end: "13:00"
        }
      ],
      timeOff: [
        {
          date: "2026-11-12",
          start: "09:00",
          end: "17:00"
        }
      ]
    },
    {
      id: "demo",
      name: "Demo Barber",
      active: true,
      serviceIds: ["haircut"],
      weeklySchedule: {
        monday: {
          open: "10:00",
          close: "17:00"
        },
        saturday: {
          open: "09:00",
          close: "16:00"
        }
      },
      weeklyBreaks: [],
      timeOff: []
    }
  ],
  workingHours: {}
};

function request(overrides = {}) {
  return {
    businessId: "test-owner",
    serviceId: "haircut",
    staffId: "kody",
    date: "2026-11-09",
    startTime: "10:00",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: "07123456789",
    ...overrides
  };
}

function availability(
  date,
  startTime,
  staffId = "kody",
  serviceId = "haircut"
) {
  const service = catalogue.services.find(
    item => item.id === serviceId
  );

  const member = catalogue.staff.find(
    item => item.id === staffId
  );

  return validateAvailability(
    catalogue,
    service,
    member,
    date,
    startTime
  );
}

/**
 * Simple in-memory Firestore simulation.
 *
 * Supports only the database operations
 * used by bookingEngine.js.
 *
 * This is not a complete Firestore emulator.
 */
function fakeFirestore() {
  const documents = new Map();
  let nextId = 1;

  function reference(path) {
    return {
      path,

      collection(name) {
        return collection(path + "/" + name);
      }
    };
  }

  function collection(path) {
    return {
      doc(id) {
        const documentId = id || "booking-" + nextId++;

        return {
          ...reference(path + "/" + documentId),
          id: documentId
        };
      }
    };
  }

  return {
    documents,

    collection(name) {
      return collection(name);
    },

    async runTransaction(callback) {
      const writes = [];
      let writing = false;

      const transaction = {
        async get(ref) {
          if (writing) {
            throw new Error(
              "Transaction reads must precede writes."
            );
          }

          return {
            exists: documents.has(ref.path),
            data: () => documents.get(ref.path)
          };
        },

        create(ref, data) {
          writing = true;

          if (
            documents.has(ref.path) ||
            writes.some(
              item => item.path === ref.path
            )
          ) {
            throw new Error(
              "Document already exists."
            );
          }

          writes.push({
            path: ref.path,
            data
          });
        }
      };

      const result = await callback(transaction);

      for (const write of writes) {
        documents.set(
          write.path,
          write.data
        );
      }

      return result;
    }
  };
}

// TEST 1: VALID BOOKING INFORMATION

test("accepts a valid booking request", () => {
  const result = validateRequest(request());

  assert.equal(result.staffId, "kody");
  assert.equal(result.startTime, "10:00");
});

// TEST 2: INVALID CUSTOMER EMAIL

test("rejects invalid customer email", () => {
  assert.throws(
    () => validateRequest(
      request({
        customerEmail: "invalid-email"
      })
    ),
    /valid email/
  );
});

// TEST 3: INVALID DATE

test("rejects an impossible date", () => {
  assert.throws(
    () => validateRequest(
      request({
        date: "2026-02-30"
      })
    ),
    /Invalid appointment date/
  );
});

// TEST 4: INVALID START INTERVAL

test("rejects a non-15-minute start", () => {
  assert.throws(
    () => validateRequest(
      request({
        startTime: "10:10"
      })
    ),
    /15-minute interval/
  );
});

// TEST 5: NORMAL WORKING HOURS

test("allows an appointment within working hours", () => {
  const result = availability(
    "2026-11-09",
    "10:00"
  );

  assert.equal(result.start, 600);
  assert.equal(result.end, 630);
});

// TEST 6: BEFORE OPENING

test("rejects an appointment before opening", () => {
  assert.throws(
    () => availability(
      "2026-11-09",
      "08:45"
    ),
    /outside working hours/
  );
});

// TEST 7: AFTER CLOSING

test("rejects an appointment after closing", () => {
  assert.throws(
    () => availability(
      "2026-11-09",
      "17:45"
    ),
    /outside working hours/
  );
});

// TEST 8: LUNCH BREAK

test("rejects appointments overlapping lunch", () => {
  assert.throws(
    () => availability(
      "2026-11-09",
      "12:15"
    ),
    /staff break/
  );
});

// TEST 9: AFTER LUNCH

test("allows appointments after lunch", () => {
  const result = availability(
    "2026-11-09",
    "13:00"
  );

  assert.equal(result.start, 780);
});

// TEST 10: STAFF TIME OFF

test("rejects appointments during time off", () => {
  assert.throws(
    () => availability(
      "2026-11-12",
      "10:00"
    ),
    /unavailable/
  );
});

// TEST 11: AFTER TIME OFF

test("allows appointments after time off", () => {
  const result = availability(
    "2026-11-12",
    "17:00"
  );

  assert.equal(result.start, 1020);
});

// TEST 12: CLOSED SATURDAY

test("rejects Kody's Saturday appointments", () => {
  assert.throws(
    () => availability(
      "2026-11-14",
      "10:00"
    ),
    /not working/
  );
});

// TEST 13: OTHER STAFF SATURDAY

test("allows Demo Barber on Saturday", () => {
  const result = availability(
    "2026-11-14",
    "09:00",
    "demo"
  );

  assert.equal(result.start, 540);
});

// TEST 14: BOOKING LOCKS

test("locks every occupied 15-minute interval", () => {
  const locks = createLockIds(
    "kody",
    "2026-11-09",
    600,
    620
  );

  assert.deepEqual(locks, [
    "kody_2026-11-09_1000",
    "kody_2026-11-09_1015"
  ]);
});

// TEST 15: CREATE APPOINTMENT

test("creates an appointment and booking locks", async () => {
  const db = fakeFirestore();

  const result = await createBooking({
    db,
    catalogue,
    request: request()
  });

  assert.equal(result.success, true);
  assert.equal(result.startTime, "10:00");
  assert.equal(result.endTime, "10:30");

  const paths = [...db.documents.keys()];

  assert.equal(
    paths.filter(
      path => path.includes("/appointments/")
    ).length,
    1
  );

  assert.equal(
    paths.filter(
      path => path.includes("/bookingLocks/")
    ).length,
    2
  );
});

// TEST 16: DOUBLE BOOKING

test("rejects a second overlapping booking", async () => {
  const db = fakeFirestore();

  await createBooking({
    db,
    catalogue,
    request: request()
  });

  await assert.rejects(
    createBooking({
      db,
      catalogue,
      request: request({
        startTime: "10:15"
      })
    }),
    /already booked/
  );
});

// TEST 17: NON-OVERLAPPING BOOKING

test("allows consecutive appointments", async () => {
  const db = fakeFirestore();

  await createBooking({
    db,
    catalogue,
    request: request()
  });

  const result = await createBooking({
    db,
    catalogue,
    request: request({
      startTime: "10:30"
    })
  });

  assert.equal(result.success, true);

  const appointments = [...db.documents.keys()]
    .filter(path => path.includes("/appointments/"));

  assert.equal(appointments.length, 2);
});

// TEST 18: UNPUBLISHED BUSINESS

test("rejects bookings for an unpublished business", async () => {
  const db = fakeFirestore();

  const privateCatalogue = {
    ...catalogue,
    business: {
      published: false,
      acceptingBookings: false
    }
  };

  await assert.rejects(
    createBooking({
      db,
      catalogue: privateCatalogue,
      request: request()
    }),
    /not accepting bookings/
  );
});

// TEST 19: UNASSIGNED SERVICE

test("rejects a service not assigned to staff", async () => {
  const db = fakeFirestore();

  await assert.rejects(
    createBooking({
      db,
      catalogue,
      request: request({
        staffId: "demo",
        serviceId: "beard",
        date: "2026-11-14",
        startTime: "10:00"
      })
    }),
    /does not offer/
  );
});

// TEST 20: STAFF LOCKS ARE SEPARATE

test("allows different staff at the same time", async () => {
  const db = fakeFirestore();

  await createBooking({
    db,
    catalogue,
    request: request()
  });

  const result = await createBooking({
    db,
    catalogue,
    request: request({
      staffId: "demo"
    })
  });

  assert.equal(result.success, true);

  const appointments = [...db.documents.keys()]
    .filter(path => path.includes("/appointments/"));

  assert.equal(appointments.length, 2);
});
