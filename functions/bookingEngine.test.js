"use strict";

/**
 * BOUSTIO — PHASE 8C.6
 *
 * 28 booking engine tests.
 * Includes mandatory owner UID test.
 *
 * In-memory tests only.
 * No Firebase deployment.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateRequest,
  validateBookingDate,
  validateAvailability,
  createLockIds,
  createBooking
} = require("./bookingEngine");

const TIME_ZONE = "Europe/London";

function ukToday() {
  const parts = new Intl.DateTimeFormat(
    "en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function ukCurrentTime() {
  return new Intl.DateTimeFormat(
    "en-GB", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }
  ).format(new Date());
}

function addDays(date, count) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function nextWeekday(dayNumber) {
  const today = ukToday();

  const day = new Date(
    today + "T12:00:00Z"
  ).getUTCDay();

  let offset = (dayNumber - day + 7) % 7;

  if (offset === 0) offset = 7;

  return addDays(today, offset);
}

const NEXT_MONDAY = nextWeekday(1);
const NEXT_THURSDAY = nextWeekday(4);
const NEXT_SATURDAY = nextWeekday(6);

const catalogue = {
  business: {
    ownerUid: "test-owner",
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
          date: NEXT_THURSDAY,
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
    date: NEXT_MONDAY,
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
 * Simple in-memory Firestore simulator.
 * Does not simulate concurrent transactions.
 */
function fakeFirestore() {
  const documents = new Map();
  let nextId = 1;

  function collection(path) {
    return {
      doc(id) {
        const documentId =
          id || "booking-" + nextId++;

        const fullPath = path + "/" + documentId;

        return {
          id: documentId,
          path: fullPath,
          collection(name) {
            return collection(
              fullPath + "/" + name
            );
          }
        };
      }
    };
  }

  return {
    documents,
    collection,

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
        documents.set(write.path, write.data);
      }

      return result;
    }
  };
}

// TESTS 1–20: ORIGINAL BOOKING BEHAVIOUR

test("01 accepts a valid booking request", () => {
  const result = validateRequest(request());

  assert.equal(result.staffId, "kody");
  assert.equal(result.startTime, "10:00");
});

test("02 rejects invalid customer email", () => {
  assert.throws(
    () => validateRequest(
      request({ customerEmail: "invalid-email" })
    ),
    /valid email/
  );
});

test("03 rejects an impossible date", () => {
  assert.throws(
    () => validateRequest(
      request({ date: "2026-02-30" })
    ),
    /Invalid appointment date/
  );
});

test("04 rejects a non-15-minute start", () => {
  assert.throws(
    () => validateRequest(
      request({ startTime: "10:10" })
    ),
    /15-minute interval/
  );
});

test("05 allows an appointment within working hours", () => {
  const result = availability(
    NEXT_MONDAY, "10:00"
  );

  assert.equal(result.start, 600);
  assert.equal(result.end, 630);
});

test("06 rejects an appointment before opening", () => {
  assert.throws(
    () => availability(
      NEXT_MONDAY, "08:45"
    ),
    /outside working hours/
  );
});

test("07 rejects an appointment after closing", () => {
  assert.throws(
    () => availability(
      NEXT_MONDAY, "17:45"
    ),
    /outside working hours/
  );
});

test("08 rejects appointments overlapping lunch", () => {
  assert.throws(
    () => availability(
      NEXT_MONDAY, "12:15"
    ),
    /staff break/
  );
});

test("09 allows appointments after lunch", () => {
  const result = availability(
    NEXT_MONDAY, "13:00"
  );

  assert.equal(result.start, 780);
});

test("10 rejects appointments during time off", () => {
  assert.throws(
    () => availability(
      NEXT_THURSDAY, "10:00"
    ),
    /unavailable/
  );
});

test("11 allows appointments after time off", () => {
  const result = availability(
    NEXT_THURSDAY, "17:00"
  );

  assert.equal(result.start, 1020);
});

test("12 rejects Kody's Saturday appointments", () => {
  assert.throws(
    () => availability(
      NEXT_SATURDAY, "10:00"
    ),
    /not working/
  );
});

test("13 allows Demo Barber on Saturday", () => {
  const result = availability(
    NEXT_SATURDAY, "09:00", "demo"
  );

  assert.equal(result.start, 540);
});

test("14 locks every occupied 15-minute interval", () => {
  const locks = createLockIds(
    "kody", NEXT_MONDAY, 600, 620
  );

  assert.deepEqual(locks, [
    "kody_" + NEXT_MONDAY + "_1000",
    "kody_" + NEXT_MONDAY + "_1015"
  ]);
});

test("15 creates an appointment and booking locks", async () => {
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
      p => p.includes("/appointments/")
    ).length,
    1
  );

  assert.equal(
    paths.filter(
      p => p.includes("/bookingLocks/")
    ).length,
    2
  );
});

test("16 rejects a second overlapping booking", async () => {
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

test("17 allows consecutive appointments", async () => {
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

  const count = [...db.documents.keys()]
    .filter(
      p => p.includes("/appointments/")
    ).length;

  assert.equal(count, 2);
});

test("18 rejects an unpublished business", async () => {
  const db = fakeFirestore();

  const privateCatalogue = {
    ...catalogue,
    business: {
      ...catalogue.business,
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

test("19 rejects a service not assigned to staff", async () => {
  const db = fakeFirestore();

  await assert.rejects(
    createBooking({
      db,
      catalogue,
      request: request({
        staffId: "demo",
        serviceId: "beard",
        date: NEXT_SATURDAY,
        startTime: "10:00"
      })
    }),
    /does not offer/
  );
});

test("20 allows different staff at the same time", async () => {
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

  const count = [...db.documents.keys()]
    .filter(
      p => p.includes("/appointments/")
    ).length;

  assert.equal(count, 2);
});

// TESTS 21–27: DATE AND OWNERSHIP SECURITY

test("21 rejects an appointment dated yesterday", () => {
  const yesterday = addDays(
    ukToday(), -1
  );

  assert.throws(
    () => validateBookingDate(
      yesterday, "10:00"
    ),
    /in the past/
  );
});

test("22 rejects a date 91 days ahead", () => {
  const future = addDays(
    ukToday(), 91
  );

  assert.throws(
    () => validateBookingDate(
      future, "10:00"
    ),
    /90 days ahead/
  );
});

test("23 accepts a date exactly 90 days ahead", () => {
  const future = addDays(
    ukToday(), 90
  );

  assert.equal(
    validateBookingDate(
      future, "10:00"
    ),
    true
  );
});

test("24 rejects a date 365 days ahead", () => {
  const future = addDays(
    ukToday(), 365
  );

  assert.throws(
    () => validateBookingDate(
      future, "10:00"
    ),
    /90 days ahead/
  );
});

test("25 rejects an earlier time today", () => {
  const current = ukCurrentTime();

  const currentMinutes =
    Number(current.slice(0, 2)) * 60 +
    Number(current.slice(3, 5));

  const earlier = Math.max(
    0, currentMinutes - 1
  );

  const earlierTime =
    String(Math.floor(earlier / 60))
      .padStart(2, "0") +
    ":" +
    String(earlier % 60)
      .padStart(2, "0");

  if (currentMinutes === 0) {
    assert.throws(
      () => validateBookingDate(
        ukToday(), "00:00"
      ),
      /already passed/
    );
  } else {
    assert.throws(
      () => validateBookingDate(
        ukToday(), earlierTime
      ),
      /already passed/
    );
  }
});

test("26 rejects mismatched business ownership", async () => {
  const db = fakeFirestore();

  const ownedCatalogue = {
    ...catalogue,
    business: {
      ...catalogue.business,
      ownerUid: "another-owner"
    }
  };

  await assert.rejects(
    createBooking({
      db,
      catalogue: ownedCatalogue,
      request: request()
    }),
    /ownership mismatch/
  );

  assert.equal(db.documents.size, 0);
});

test("27 accepts a matching business owner", async () => {
  const db = fakeFirestore();

  const result = await createBooking({
    db,
    catalogue,
    request: request()
  });

  assert.equal(result.success, true);
});

// TEST 28: MANDATORY OWNERSHIP

test("28 rejects a catalogue with no owner UID", async () => {
  const db = fakeFirestore();

  const unownedCatalogue = {
    ...catalogue,
    business: {
      published: true,
      acceptingBookings: true
    }
  };

  await assert.rejects(
    createBooking({
      db,
      catalogue: unownedCatalogue,
      request: request()
    }),
    /ownership is missing/
  );

  assert.equal(db.documents.size, 0);
});
