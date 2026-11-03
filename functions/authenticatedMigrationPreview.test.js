"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MigrationAuthError,
  verifiedOwner,
  authenticatedMigrationPreview
} = require("./authenticatedMigrationPreview");

const UID = "testBusiness123";

function request(
  uid = UID,
  verified = true,
  data = {}
) {
  return {
    auth: {
      uid,
      token: {
        email_verified: verified
      }
    },
    data
  };
}

function database() {
  return {
    collection() {
      throw new Error(
        "Database must not be accessed in mock tests"
      );
    }
  };
}

function mockReport(overrides = {}) {
  return {
    status: "PREFLIGHT_PASSED",
    safeToMigrate: true,
    sourceCount: 2,
    proposedAppointmentCount: 2,
    proposedLockCount: 4,
    existingAppointmentCount: 0,
    existingLockCount: 0,
    problemCount: 0,
    appointments: [{
      clientName: "PRIVATE CUSTOMER"
    }],
    locks: [{
      lockId: "PRIVATE LOCK"
    }],
    problems: [{
      reason: "PRIVATE DETAIL"
    }],
    ...overrides
  };
}

async function run(
  req = request(),
  options = {}
) {
  let captured = null;

  const result =
    await authenticatedMigrationPreview({
      db: options.db === undefined
        ? database()
        : options.db,
      request: req,
      preview: async args => {
        captured = args;
        return mockReport(
          options.report || {}
        );
      }
    });

  return {
    result,
    captured
  };
}

test("1 - verified owner is accepted", () => {
  assert.equal(
    verifiedOwner(request()),
    UID
  );
});

test("2 - missing authentication is rejected", () => {
  assert.throws(
    () => verifiedOwner({}),
    error =>
      error instanceof MigrationAuthError &&
      error.code === "unauthenticated"
  );
});

test("3 - missing request is rejected", () => {
  assert.throws(
    () => verifiedOwner(null),
    /Sign in/
  );
});

test("4 - unverified email is rejected", () => {
  assert.throws(
    () => verifiedOwner(request(UID, false)),
    error =>
      error.code === "permission-denied"
  );
});

test("5 - missing token is rejected", () => {
  assert.throws(
    () => verifiedOwner({
      auth: { uid: UID }
    }),
    /Verify your email/
  );
});

test("6 - invalid UID is rejected", () => {
  assert.throws(
    () => verifiedOwner(request("bad/id")),
    /Sign in/
  );
});

test("7 - empty UID is rejected", () => {
  assert.throws(
    () => verifiedOwner(request("")),
    /Sign in/
  );
});

test("8 - valid owner receives summary", async () => {
  const { result } = await run();

  assert.equal(result.success, true);
  assert.equal(result.businessId, UID);
  assert.equal(result.readOnly, true);
});

test("9 - owner UID is passed to preview", async () => {
  const { captured } = await run();

  assert.equal(captured.businessId, UID);
  assert.equal(captured.authenticatedUid, UID);
});

test("10 - client-supplied business ID is ignored", async () => {
  const { captured } = await run(
    request(UID, true, {
      businessId: "anotherBusiness"
    })
  );

  assert.equal(captured.businessId, UID);
});

test("11 - client booking data is ignored", async () => {
  const { captured } = await run(
    request(UID, true, {
      bookingsJson: "malicious"
    })
  );

  assert.equal(
    Object.hasOwn(captured, "bookingsJson"),
    false
  );
});

test("12 - appointment details are not returned", async () => {
  const { result } = await run();

  assert.equal(
    Object.hasOwn(result, "appointments"),
    false
  );
  assert.equal(
    JSON.stringify(result).includes(
      "PRIVATE CUSTOMER"
    ),
    false
  );
});

test("13 - booking locks are not returned", async () => {
  const { result } = await run();

  assert.equal(
    Object.hasOwn(result, "locks"),
    false
  );
  assert.equal(
    JSON.stringify(result).includes(
      "PRIVATE LOCK"
    ),
    false
  );
});

test("14 - problem details are not returned", async () => {
  const { result } = await run();

  assert.equal(
    Object.hasOwn(result, "problems"),
    false
  );
  assert.equal(
    JSON.stringify(result).includes(
      "PRIVATE DETAIL"
    ),
    false
  );
});

test("15 - blocked migration status is preserved", async () => {
  const { result } = await run(
    request(),
    {
      report: {
        status: "MIGRATION_BLOCKED",
        safeToMigrate: false,
        problemCount: 2
      }
    }
  );

  assert.equal(
    result.status,
    "MIGRATION_BLOCKED"
  );
  assert.equal(
    result.safeToMigrate,
    false
  );
  assert.equal(result.problemCount, 2);
});

test("16 - missing database is rejected", async () => {
  await assert.rejects(
    run(request(), { db: null }),
    error =>
      error.code === "unavailable"
  );
});

test("17 - invalid authentication prevents preview", async () => {
  let called = false;

  await assert.rejects(
    authenticatedMigrationPreview({
      db: database(),
      request: {},
      preview: async () => {
        called = true;
        return mockReport();
      }
    })
  );

  assert.equal(called, false);
});

test("18 - database errors propagate", async () => {
  await assert.rejects(
    authenticatedMigrationPreview({
      db: database(),
      request: request(),
      preview: async () => {
        throw new Error(
          "Simulated database failure"
        );
      }
    }),
    /Simulated database failure/
  );
});

test("19 - summary contains expected counts", async () => {
  const { result } = await run();

  assert.equal(result.sourceCount, 2);
  assert.equal(
    result.proposedAppointmentCount,
    2
  );
  assert.equal(
    result.proposedLockCount,
    4
  );
});

test("20 - warning confirms no migration", async () => {
  const { result } = await run();

  assert.match(result.warning, /Read-only/);
  assert.match(
    result.warning,
    /does not authorise/
  );
});
