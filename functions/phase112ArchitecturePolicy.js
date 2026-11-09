"use strict";
/** Phase 11.2 design-only production security boundary and booking preservation policy. */
const deepFreeze=o=>{if(o&&typeof o==="object"){Object.values(o).forEach(deepFreeze);Object.freeze(o);}return o;};
const ARCHITECTURE=deepFreeze({
 status:"DESIGN_ONLY_PRODUCTION_HOLD",
 productionProject:"salonbook-pro-ad5ff",
 emulatorProject:"demo-boustio-legacy-init",
 productionWritesEnabled:false,
 publicBookingsEnabled:false,
 deploymentAllowed:false,
 bookingData:{
  legacySource:"users/{uid}/liveData/bookings",
  legacyMode:"businesses/{businessId}/settings/bookingMode",
  migrationMarker:"businesses/{businessId}/migrations/android-bookings-v1",
  protectedCollections:["businesses/{businessId}/appointments","businesses/{businessId}/bookingLocks"],
  migrationStrategy:"read-only snapshot, verified digest, reversible rehearsal, separately authorised cutover",
  destructiveActionsAllowed:false
 },
 trustBoundaries:{
  publicWeb:"untrusted customer requests; no Firestore Admin or signing key",
  ownerAndroid:"verified owner identity; no migration or audit override",
  bookingApi:"separate narrowly scoped service; authoritative availability, rate limits and idempotency",
  approvalIssuer:"separate execution identity; signed operator approval; no booking writes",
  approvalConsumer:"separate execution identity; atomic single-use approval; no booking source writes",
  signingService:"independent operator authorisation; non-exportable managed key",
  auditService:"independently administered append-only/WORM evidence and reconciliation",
  deployment:"separate change-controlled identity and explicit go/no-go"
 },
 requiredBeforeProduction:[
  "independent security review and verified least-privilege enforcement",
  "non-exportable signing key custody and rotation",
  "independent immutable audit and crash-consistent reconciliation",
  "verified legacy booking preservation and restore rehearsal",
  "concurrency-safe booking engine with authenticated or scoped customer access",
  "monitoring, incident response, rollback and explicit deployment approval"
 ]
});
function assessArchitecture(){
 return Object.freeze({approved:false,productionWritesEnabled:false,publicBookingsEnabled:false,
  blockers:Object.freeze([...ARCHITECTURE.requiredBeforeProduction])});
}
module.exports={ARCHITECTURE,assessArchitecture};
