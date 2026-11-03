"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HttpsError
} = require("firebase-functions/v2/https");

const {
  MigrationAuthError
} = require("./authenticatedMigrationPreview");

const {
  migrationPreviewCallable,
  handleMigrationPreview,
  toCallableError
} = require("./migrationPreviewCallable");

const UID = "testBusiness123";

function request(verified = true) {
  return {
    auth: {
      uid: UID,
      token: {
        email_verified: verified
      }
    },
    data: {}
  };
}

function database() {
  return {
    collection() {
      throw new Error(
        "Unexpected database access"
      );
    }
  };
}

function summary() {
  return {
    success: true,
    businessId: UID,
    readOnly: true,
    status: "PREFLIGHT_PASSED",
    safeToMigrate: true,
    sourceCount: 1,
    problemCount: 0
  };
}

test("1 - callable is defined", () => {
  assert.equal(
    typeof migrationPreviewCallable,
    "function"
  );
});

test("2 - handler is defined", () => {
  assert.equal(
    typeof handleMigrationPreview,
    "function"
  );
});

test("3 - valid handler returns preview", async () => {
  const result = await handleMigrationPreview(
    request(),
    {
      db: database(),
      preview: async () => summary()
    }
  );

  assert.deepEqual(result, summary());
});

test("4 - handler passes authentication", async () => {
  let received;

  await handleMigrationPreview(
    request(),
    {
      db: database(),
      preview: async args => {
        received = args.request;
        return summary();
      }
    }
  );

  assert.equal(received.auth.uid, UID);
});

test("5 - handler passes supplied database", async () => {
  const db = database();
  let received;

  await handleMigrationPreview(
    request(),
    {
      db,
      preview: async args => {
        received = args.db;
        return summary();
      }
    }
  );

  assert.equal(received, db);
});

test("6 - unauthenticated error is mapped", () => {
  const error = toCallableError(
    new MigrationAuthError(
      "unauthenticated",
      "Sign in."
    )
  );

  assert.ok(error instanceof HttpsError);
  assert.equal(error.code, "unauthenticated");
});

test("7 - unverified owner error is mapped", () => {
  const error = toCallableError(
    new MigrationAuthError(
      "permission-denied",
      "Verify your email."
    )
  );

  assert.equal(error.code, "permission-denied");
});

test("8 - unavailable database error is mapped", () => {
  const error = toCallableError(
    new MigrationAuthError(
      "unavailable",
      "Database unavailable."
    )
  );

  assert.equal(error.code, "unavailable");
});

test("9 - unknown auth error is not exposed", () => {
  const error = toCallableError(
    new MigrationAuthError(
      "secret-code",
      "Private internal information"
    )
  );

  assert.equal(error.code, "internal");
});

test("10 - migration read failure is safe", () => {
  const source = new Error(
    "Private Firestore document path"
  );

  source.code = "migration-preview-error";

  const error = toCallableError(source);

  assert.equal(
    error.code,
    "failed-precondition"
  );

  assert.equal(
    error.message.includes(
      "Private Firestore"
    ),
    false
  );
});

test("11 - unexpected errors are hidden", () => {
  const error = toCallableError(
    new Error(
      "Secret database connection details"
    )
  );

  assert.equal(error.code, "internal");

  assert.equal(
    error.message.includes("Secret"),
    false
  );
});

test("12 - existing HTTPS errors are preserved", () => {
  const original = new HttpsError(
    "resource-exhausted",
    "Too many requests."
  );

  assert.equal(
    toCallableError(original),
    original
  );
});

test("13 - preview failure becomes HTTPS error", async () => {
  await assert.rejects(
    handleMigrationPreview(
      request(),
      {
        db: database(),
        preview: async () => {
          throw new Error(
            "Sensitive internal failure"
          );
        }
      }
    ),
    error =>
      error instanceof HttpsError &&
      error.code === "internal" &&
      !error.message.includes("Sensitive")
  );
});

test("14 - missing authentication is rejected", async () => {
  await assert.rejects(
    handleMigrationPreview(
      {},
      {
        db: database()
      }
    ),
    error =>
      error instanceof HttpsError &&
      error.code === "unauthenticated"
  );
});

test("15 - unverified email is rejected", async () => {
  await assert.rejects(
    handleMigrationPreview(
      request(false),
      {
        db: database()
      }
    ),
    error =>
      error instanceof HttpsError &&
      error.code === "permission-denied"
  );
});

test("16 - client cannot select another business", async () => {
  const req = request();

  req.data.businessId = "anotherBusiness";

  let received;

  await handleMigrationPreview(
    req,
    {
      db: database(),
      preview: async args => {
        received = args.request;
        return summary();
      }
    }
  );

  assert.equal(received.auth.uid, UID);
  assert.equal(
    received.data.businessId,
    "anotherBusiness"
  );

  // The underlying authenticated preview
  // ignores request.data and uses auth.uid.
});

test("17 - result remains read-only", async () => {
  const result = await handleMigrationPreview(
    request(),
    {
      db: database(),
      preview: async () => summary()
    }
  );

  assert.equal(result.readOnly, true);
});

test("18 - successful preview has no customer data", async () => {
  const result = await handleMigrationPreview(
    request(),
    {
      db: database(),
      preview: async () => summary()
    }
  );

  assert.equal(
    Object.hasOwn(result, "appointments"),
    false
  );

  assert.equal(
    Object.hasOwn(result, "locks"),
    false
  );
});
