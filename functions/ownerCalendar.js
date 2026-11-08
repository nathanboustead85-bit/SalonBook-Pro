"use strict";
/**
 * Phase 10.5 — authenticated, read-only shared appointment calendar.
 * Internal handler only. Not exported as a Firebase callable or deployed.
 * The business ID is always derived from the verified sign-in token.
 */
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(date) {
  if (typeof date !== "string" || !DATE.test(date)) return false;
  const parsed = new Date(date + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function requireOwner(request) {
  const auth = request?.auth;
  if (!auth || !ID.test(auth.uid || "") || auth.token?.email_verified !== true) {
    const err = new Error("Verified business sign-in required");
    err.code = "permission-denied";
    throw err;
  }
  return auth.uid;
}
async function getOwnerCalendar({db, request, date}) {
  const businessId = requireOwner(request);
  if (!validDate(date)) throw new Error("Invalid calendar date");
  if (!db || typeof db.collection !== "function") throw new Error("Database unavailable");
  const ref = db.collection("businesses").doc(businessId);
  const snapshot = await ref.collection("appointments").where("date", "==", date).get();
  if (!snapshot || !Array.isArray(snapshot.docs)) throw new Error("Calendar unavailable");
  // Return only fields required by the owner calendar. Never trust a supplied businessId.
  const appointments = snapshot.docs.map(doc => {
    const data = doc.data();
    if (data.businessId !== businessId) throw new Error("Calendar ownership mismatch");
    return {
      id: doc.id, date: data.date, startTime: data.startTime,
      endTime: data.endTime, staffId: data.staffId,
      staffName: data.staffName, serviceId: data.serviceId,
      serviceName: data.serviceName, customerName: data.customerName,
      status: data.status, source: data.source
    };
  }).filter(x => x.status !== "cancelled" && x.status !== "canceled");
  appointments.sort((a,b) => a.startTime.localeCompare(b.startTime) ||
    a.staffId.localeCompare(b.staffId) || a.id.localeCompare(b.id));
  return { date, appointments };
}
module.exports = { getOwnerCalendar, requireOwner, validDate };
