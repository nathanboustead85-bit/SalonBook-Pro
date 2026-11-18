// Phase 18.2: inert Firebase Auth adapter for future verified business onboarding.
// No Firebase SDK import, initialization, persistent session or network activity.
// Production registration remains OFF until separately reviewed and enabled.
export const PUBLIC_REGISTRATION_ENABLED = false;
export const CUSTOMER_BOOKINGS_ENABLED = false;

export function validateCredentials(email, password) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (normalized.length < 3 || normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  if (typeof password !== "string" || password.length < 12 ||
      password.length > 128) {
    throw new Error("Password must contain 12–128 characters.");
  }
  return { email: normalized, password };
}

export function requireVerifiedOwner(user) {
  if (!user || typeof user.uid !== "string" || !user.uid ||
      user.emailVerified !== true) {
    throw new Error("Verified business owner account required.");
  }
  return user.uid;
}

// Injected SDK functions will be wired in a later, explicitly approved phase.
// A hard-coded gate prevents any SDK call while registration is disabled.
export async function registerBusinessAccount({ email, password, auth, sdk } = {}) {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    throw new Error("Public business registration is not enabled.");
  }
  const credentials = validateCredentials(email, password);
  if (!auth || typeof sdk?.createUserWithEmailAndPassword !== "function" ||
      typeof sdk?.sendEmailVerification !== "function") {
    throw new Error("Secure authentication is unavailable.");
  }
  const result = await sdk.createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
  await sdk.sendEmailVerification(result.user);
  return { uid: result.user.uid, verificationRequired: true };
}

export async function signInVerifiedBusiness({ email, password, auth, sdk } = {}) {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    throw new Error("Public business registration is not enabled.");
  }
  const credentials = validateCredentials(email, password);
  if (!auth || typeof sdk?.signInWithEmailAndPassword !== "function") {
    throw new Error("Secure authentication is unavailable.");
  }
  const result = await sdk.signInWithEmailAndPassword(auth, credentials.email, credentials.password);
  return { uid: requireVerifiedOwner(result.user) };
}
