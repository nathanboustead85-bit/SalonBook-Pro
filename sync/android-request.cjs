"use strict";
const id=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function prepareRequest(session,draft,requestId){
 if(!session||session.verified!==true||!id(session.uid)||!id(session.businessId)||!draft||!id(requestId)||!id(draft.appointmentId)||!["create","cancel","reschedule"].includes(draft.action))throw Error("Invalid request");
 if(!Number.isSafeInteger(draft.expectedRevision)||(draft.action==="create"?draft.expectedRevision!==0:draft.expectedRevision<1))throw Error("Invalid revision");
 const request={businessId:session.businessId,actorId:session.uid,requestId,appointmentId:draft.appointmentId,action:draft.action,expectedRevision:draft.expectedRevision};
 if(draft.action!=="cancel"){
 if(!id(draft.serviceId)||!id(draft.staffId)||typeof draft.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||typeof draft.startTime!=="string"||!/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(draft.startTime))throw Error("Invalid slot");
 Object.assign(request,{serviceId:draft.serviceId,staffId:draft.staffId,date:draft.date,startTime:draft.startTime});
 }
 return Object.freeze(request);
}
module.exports={prepareRequest};
