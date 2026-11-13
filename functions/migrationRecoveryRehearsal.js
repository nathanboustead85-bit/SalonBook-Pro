"use strict";
const crypto = require("node:crypto");

function checksum(json) {
  if (typeof json !== "string" || Buffer.byteLength(json,"utf8") > 500000)
    throw new Error("Invalid backup snapshot");
  return crypto.createHash("sha256").update(json,"utf8").digest("hex");
}
function sealSnapshot(json) {
  JSON.parse(json); // Reject malformed snapshots before sealing.
  return Object.freeze({json,sha256:checksum(json)});
}
function verifySnapshot(snapshot) {
  if (!snapshot || typeof snapshot.json !== "string" ||
      typeof snapshot.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(snapshot.sha256))
    throw new Error("Invalid backup envelope");
  if (checksum(snapshot.json) !== snapshot.sha256)
    throw new Error("Backup integrity mismatch");
  const items = JSON.parse(snapshot.json);
  if (!Array.isArray(items)) throw new Error("Backup is not a booking array");
  return items;
}
/**
 * Disposable in-memory rehearsal only. No Firestore SDK, network calls, or
 * production writes. Any injected failure returns a blocked state and
 * restores the complete preflight simulation from the sealed baseline.
 */
function rehearseMigration(snapshot, {failAfter=null,existingIds=[]}={}) {
  const originals=verifySnapshot(snapshot);
  const initialIds=new Set(existingIds);
  const staged=new Set(initialIds);
  let committed=false;
  try {
    for (const [i,booking] of originals.entries()) {
      if (!booking || typeof booking.id !== "string" || !booking.id)
        throw new Error("Invalid appointment ID");
      if (staged.has(booking.id)) throw new Error("Duplicate appointment ID");
      staged.add(booking.id);
      if (failAfter === i+1) throw new Error("Injected migration interruption");
    }
    // Simulate commit only after every record passes validation.
    committed=true;
    return {status:"simulated-success",committed,stagedIds:[...staged],
      originalCount:originals.length,liveBookingsEnabled:false};
  } catch (error) {
    // Rollback the disposable simulation, not a live database.
    return {status:"simulated-rollback",committed:false,
      stagedIds:[...initialIds],originalCount:originals.length,
      liveBookingsEnabled:false,reason:error.message};
  }
}
module.exports={checksum,sealSnapshot,verifySnapshot,rehearseMigration};
