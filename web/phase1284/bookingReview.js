(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioBookingReview=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Read-only review of a fictional appointment preview. No customer input, writes, or live booking.
const {prepareAppointmentPreview}=typeof module!=="undefined"&&module.exports
 ?require("../phase1283/appointmentSelection")
 :{prepareAppointmentPreview:window.BoustioAppointmentSelection.prepareAppointmentPreview};
const fail=reason=>Object.freeze({status:"REVIEW_UNAVAILABLE",bookingEnabled:false,reason,review:null});
function prepareBookingReview(payload,slug,serviceId,staffId,date,time,previewSlots){
 const result=prepareAppointmentPreview(payload,slug,serviceId,staffId,date,time,previewSlots);
 if(result.status!=="APPOINTMENT_PREVIEW_READY")return fail(result.reason||"appointment_unavailable");
 const a=result.appointment;
 const s=a.service;
 if(!Number.isInteger(s.pricePence)||s.pricePence<0||!Number.isInteger(s.durationMinutes)||s.durationMinutes<5)return fail("invalid_service");
 const startMinutes=Number(time.slice(0,2))*60+Number(time.slice(3,5));
 const endMinutes=startMinutes+s.durationMinutes;
 if(endMinutes>1440)return fail("appointment_exceeds_day");
 const endTime=String(Math.floor(endMinutes/60)).padStart(2,"0")+":"+String(endMinutes%60).padStart(2,"0");
 const review=Object.freeze({
  businessName:a.businessName,
  serviceName:s.title,
  staffName:a.staff.name,
  date:a.date,
  startTime:a.time,
  endTime,
  durationMinutes:s.durationMinutes,
  durationLabel:s.durationLabel,
  pricePence:s.pricePence,
  priceLabel:s.priceLabel,
  totalPence:s.pricePence,
  totalLabel:s.priceLabel,
  notice:"Demonstration only — no live availability, payment or reservation."
 });
 return Object.freeze({status:"REVIEW_PREVIEW_READY",bookingEnabled:false,review});
}
return Object.freeze({prepareBookingReview});
});
