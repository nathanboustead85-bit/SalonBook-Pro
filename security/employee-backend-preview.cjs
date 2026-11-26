// Offline server authorization contract. Never expose this as a live endpoint without trusted adapters.
"use strict";
async function authorize(request, trusted) {
  try {
    const identity = await trusted.identity();
    if (!identity || identity.verified !== true || typeof identity.uid !== "string" || !identity.uid) return false;
    const {businessId, bookingId, action} = request;
    const validId = x => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
    if (!validId(businessId) || !validId(bookingId) || !["view","contact","edit","cancel"].includes(action)) return false;
    const m = await trusted.membership(businessId, identity.uid);
    const p = await trusted.policy(businessId, identity.uid);
    const booking = await trusted.booking(businessId, bookingId);
    if (!m || !p || !booking || m.active !== true || m.businessId !== businessId || m.userId !== identity.uid ||
        !["EMPLOYEE","MANAGER"].includes(m.role) || !Number.isSafeInteger(m.revision) || m.revision < 1 ||
        p.businessId !== businessId || p.userId !== identity.uid || p.membershipRevision !== m.revision ||
        !Number.isSafeInteger(p.revision) || p.revision < 0 || !Array.isArray(p.grants) ||
        booking.businessId !== businessId || booking.id !== bookingId || !validId(booking.staffUserId) ||
        !Number.isSafeInteger(booking.revision) || booking.revision < 1 || typeof booking.historical !== "boolean") return false;
    const allowed = new Set(["OWN_APPOINTMENTS","ALL_APPOINTMENTS","CREATE_BOOKINGS","EDIT_BOOKINGS","CANCEL_BOOKINGS","CUSTOMER_CONTACT","OWN_WORKING_HOURS","MESSAGING","OWN_PORTFOLIO"]);
    if (p.grants.some(g => !allowed.has(g))) return false;
    const has = g => p.grants.includes(g);
    if (!(has("ALL_APPOINTMENTS") || (booking.staffUserId === identity.uid && has("OWN_APPOINTMENTS")))) return false;
    if (action === "view") return true;
    if (action === "contact") return has("CUSTOMER_CONTACT");
    if (booking.historical || request.expectedRevision !== booking.revision) return false;
    return has(action === "edit" ? "EDIT_BOOKINGS" : "CANCEL_BOOKINGS");
  } catch (_) { return false; }
}
module.exports = {authorize};
