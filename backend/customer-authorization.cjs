"use strict";
// Internal emulator prototype: identity must be supplied by trusted authentication.
function authorizeCustomer(identity,request,business){
 return !!(identity&&identity.verified===true&&request&&request.action==="create"&&request.expectedRevision===0&&typeof identity.uid==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid)&&identity.uid===request.actorId&&identity.uid!==request.businessId&&business&&business.ownerUid===request.businessId&&business.published===true&&business.acceptingBookings===true);
}
module.exports={authorizeCustomer};