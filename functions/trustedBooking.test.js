"use strict";

/**
 * BOUSTIO — PHASE 8C.8
 * Trusted Booking Integration Tests
 *
 * 15 tests.
 *
 * Uses a fake Firestore database and
 * injected test functions.
 *
 * No Firebase deployment.
 * No real customer bookings.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createTrustedBooking
} = require("./trustedBooking");

const OWNER = "test-owner";

function makeRequest() {
  return {
    businessId: OWNER,
    serviceId: "haircut",
    staffId: "kody",
    date: "2026-12-07",
    startTime: "10:00",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: "07123456789"
  };
}

function makeCatalogue() {
  return {
    business: {
      ownerUid: OWNER,
      published: true,
      acceptingBookings: true
    },
    services: [
      {
        id: "haircut",
        name: "Haircut",
        price: 20,
        durationMinutes: 30,
        active: true
      }
    ],
    staff: [
      {
        id: "kody",
        name: "Kody",
        active: true,
        serviceIds: ["haircut"]
      }
    ]
  };
}

function makeDatabase(
  publicBusiness = {
    businessId: OWNER,
    published: true,
    acceptingBookings: true
  },
  exists = true
) {
  const calls = [];

  const db = {
    collection(name) {
      calls.push(name);

      return {
        doc(id) {
          calls.push(id);

          return {
            async get() {
              return {
                exists,
                data() {
                  return publicBusiness;
                }
              };
            }
          };
        }
      };
    },

    async runTransaction(callback) {
      return callback({});
    }
  };

  return { db, calls };
}

function makeDependencies() {
  const calls = {
    loader: 0,
    creator: 0,
    payload: null
  };

  const catalogueLoader = async () => {
    calls.loader++;
    return makeCatalogue();
  };

  const bookingCreator = async (payload) => {
    calls.creator++;
    calls.payload = payload;

    return {
      success: true,
      appointmentId: "test-appointment"
    };
  };

  return {
    calls,
    catalogueLoader,
    bookingCreator
  };
}

function execute({
  db,
  request = makeRequest(),
  catalogueLoader,
  bookingCreator
}) {
  return createTrustedBooking({
    db,
    request,
    catalogueLoader,
    bookingCreator
  });
}

// TEST 01

test("01 accepts a valid trusted booking request", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  const result = await execute({
    db,
    ...deps
  });

  assert.equal(result.success, true);
  assert.equal(deps.calls.loader, 1);
  assert.equal(deps.calls.creator, 1);
});

// TEST 02

test("02 rejects an unavailable database", async () => {
  const deps = makeDependencies();

  await assert.rejects(
    execute({
      db: null,
      ...deps
    }),
    /Database is unavailable/
  );

  assert.equal(deps.calls.loader, 0);
  assert.equal(deps.calls.creator, 0);
});

// TEST 03

test("03 rejects a missing booking request", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  await assert.rejects(
    createTrustedBooking({
      db,
      request: null,
      catalogueLoader: deps.catalogueLoader,
      bookingCreator: deps.bookingCreator
    }),
    /Invalid booking request/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 04

test("04 rejects an invalid business ID", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  const request = makeRequest();
  request.businessId = "invalid/business";

  await assert.rejects(
    execute({
      db,
      request,
      ...deps
    }),
    /Invalid business identifier/
  );

  assert.equal(deps.calls.loader, 0);
});

// TEST 05

test("05 rejects a missing public business", async () => {
  const { db } = makeDatabase(null, false);
  const deps = makeDependencies();

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /Business is unavailable/
  );

  assert.equal(deps.calls.loader, 0);
});

// TEST 06

test("06 rejects an unpublished business", async () => {
  const { db } = makeDatabase({
    businessId: OWNER,
    published: false,
    acceptingBookings: true
  });

  const deps = makeDependencies();

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /not accepting bookings/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 07

test("07 rejects disabled public bookings", async () => {
  const { db } = makeDatabase({
    businessId: OWNER,
    published: true,
    acceptingBookings: false
  });

  const deps = makeDependencies();

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /not accepting bookings/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 08

test("08 rejects a mismatched public business owner", async () => {
  const { db } = makeDatabase({
    businessId: "another-owner",
    published: true,
    acceptingBookings: true
  });

  const deps = makeDependencies();

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /not accepting bookings/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 09

test("09 rejects a mismatched catalogue owner", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  deps.catalogueLoader = async () => {
    const catalogue = makeCatalogue();
    catalogue.business.ownerUid =
      "another-owner";

    return catalogue;
  };

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /Trusted business catalogue is invalid/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 10

test("10 rejects an unpublished catalogue", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  deps.catalogueLoader = async () => {
    const catalogue = makeCatalogue();
    catalogue.business.published = false;
    return catalogue;
  };

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /Trusted business catalogue is invalid/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 11

test("11 rejects a catalogue with bookings disabled", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  deps.catalogueLoader = async () => {
    const catalogue = makeCatalogue();
    catalogue.business.acceptingBookings =
      false;

    return catalogue;
  };

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /Trusted business catalogue is invalid/
  );

  assert.equal(deps.calls.creator, 0);
});

// TEST 12

test("12 ignores customer-supplied prices", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  const request = makeRequest();

  request.price = 0.01;
  request.serviceName = "Free Haircut";
  request.durationMinutes = 1;

  await execute({
    db,
    request,
    ...deps
  });

  const payload = deps.calls.payload;

  assert.equal(
    payload.catalogue.services[0].price,
    20
  );

  assert.equal(
    Object.hasOwn(payload.request, "price"),
    false
  );

  assert.equal(
    Object.hasOwn(
      payload.request,
      "serviceName"
    ),
    false
  );

  assert.equal(
    Object.hasOwn(
      payload.request,
      "durationMinutes"
    ),
    false
  );
});

// TEST 13

test("13 ignores a customer-supplied catalogue", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  const request = makeRequest();

  request.catalogue = {
    business: {
      ownerUid: OWNER,
      published: true,
      acceptingBookings: true
    },
    services: [
      {
        id: "haircut",
        name: "Fake Haircut",
        price: 0,
        durationMinutes: 1,
        active: true
      }
    ],
    staff: []
  };

  await execute({
    db,
    request,
    ...deps
  });

  assert.equal(
    deps.calls.payload.catalogue
      .services[0].price,
    20
  );

  assert.equal(
    Object.hasOwn(
      deps.calls.payload.request,
      "catalogue"
    ),
    false
  );
});

// TEST 14

test("14 loads data for the requested business only", async () => {
  const { db, calls } = makeDatabase();
  const deps = makeDependencies();

  let loadedBusinessId = null;

  deps.catalogueLoader = async (options) => {
    loadedBusinessId = options.businessId;
    return makeCatalogue();
  };

  await execute({
    db,
    ...deps
  });

  assert.deepEqual(calls, [
    "publicBusinesses",
    OWNER
  ]);

  assert.equal(
    loadedBusinessId,
    OWNER
  );
});

// TEST 15

test("15 propagates booking engine failures", async () => {
  const { db } = makeDatabase();
  const deps = makeDependencies();

  deps.bookingCreator = async () => {
    throw new Error(
      "This appointment time is already booked."
    );
  };

  await assert.rejects(
    execute({
      db,
      ...deps
    }),
    /already booked/
  );
});
