(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioBookingJourneyPreview=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Pure, fictional preview orchestration: no live availability, persistence, or booking actions.
const modules=typeof module!=="undefined"&&module.exports?{
 selection:require("../phase1282/serviceStaffSelection"),
 appointment:require("../phase1283/appointmentSelection"),
 review:require("../phase1284/bookingReview"),
 confirmation:require("../phase1285/customerConfirmationPreview")
}:{
 selection:window.BoustioServiceStaffSelection,
 appointment:window.BoustioAppointmentSelection,
 review:window.BoustioBookingReview,
 confirmation:window.BoustioCustomerConfirmationPreview
};
const fail=(stage,reason)=>Object.freeze({status:"JOURNEY_PREVIEW_UNAVAILABLE",bookingEnabled:false,stage,reason,journey:null});
function prepareJourneyPreview(payload,request,previewSlots){
 if(!request||typeof request!=="object"||Array.isArray(request))return fail("selection","invalid_request");
 const {slug,serviceId,staffId,date,time,customer}=request;
 const selected=modules.selection.prepareSelection(payload,slug,serviceId,staffId);
 if(selected.status!=="SELECTION_PREVIEW_READY")return fail("selection",selected.reason||"selection_unavailable");
 if(!selected.selection.selectedStaff)return fail("selection","staff_required");
 const appointment=modules.appointment.prepareAppointmentPreview(payload,slug,serviceId,staffId,date,time,previewSlots);
 if(appointment.status!=="APPOINTMENT_PREVIEW_READY")return fail("appointment",appointment.reason||"appointment_unavailable");
 const reviewed=modules.review.prepareBookingReview(payload,slug,serviceId,staffId,date,time,previewSlots);
 if(reviewed.status!=="REVIEW_PREVIEW_READY")return fail("review",reviewed.reason||"review_unavailable");
 const confirmed=modules.confirmation.prepareConfirmationPreview(payload,slug,serviceId,staffId,date,time,previewSlots,customer);
 if(confirmed.status!=="CONFIRMATION_PREVIEW_READY")return fail("customer",confirmed.reason||"customer_unavailable");
 const journey=Object.freeze({
  service:Object.freeze({name:reviewed.review.serviceName,durationLabel:reviewed.review.durationLabel,priceLabel:reviewed.review.priceLabel}),
  staffName:reviewed.review.staffName,
  date:reviewed.review.date,
  startTime:reviewed.review.startTime,
  endTime:reviewed.review.endTime,
  totalLabel:reviewed.review.totalLabel,
  customerName:confirmed.confirmation.customerName,
  heading:confirmed.confirmation.heading,
  notice:confirmed.confirmation.message
 });
 return Object.freeze({status:"JOURNEY_PREVIEW_READY",bookingEnabled:false,journey});
}
return Object.freeze({prepareJourneyPreview});
});
