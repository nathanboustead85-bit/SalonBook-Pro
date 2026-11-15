(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioCustomerConfirmationPreview=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Fictional, in-memory demonstration only. Never stores or transmits personal data.
const {prepareBookingReview}=typeof module!=="undefined"&&module.exports
 ?require("../phase1284/bookingReview")
 :{prepareBookingReview:window.BoustioBookingReview.prepareBookingReview};
const reject=reason=>Object.freeze({status:"CONFIRMATION_PREVIEW_UNAVAILABLE",bookingEnabled:false,reason,confirmation:null});
const validName=v=>typeof v==="string"&&v.trim().length>=2&&v.trim().length<=100&&!/[<>\x00-\x1f]/.test(v);
const validEmail=v=>typeof v==="string"&&v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
const validPhone=v=>typeof v==="string"&&/^\+?[0-9 ()-]{7,24}$/.test(v)&&v.replace(/\D/g,"").length>=7;
function prepareConfirmationPreview(payload,slug,serviceId,staffId,date,time,previewSlots,customer){
 const result=prepareBookingReview(payload,slug,serviceId,staffId,date,time,previewSlots);
 if(result.status!=="REVIEW_PREVIEW_READY")return reject(result.reason||"review_unavailable");
 if(!customer||typeof customer!=="object"||Array.isArray(customer))return reject("invalid_customer");
 if(!validName(customer.name)||!validEmail(customer.email)||!validPhone(customer.phone))return reject("invalid_customer_details");
 if(customer.consent!==true)return reject("preview_consent_required");
 const r=result.review;
 // Only the display name is returned; email and phone are deliberately discarded.
 const confirmation=Object.freeze({
  heading:"DEMONSTRATION ONLY · NO REAL APPOINTMENT",
  customerName:customer.name.trim(),
  businessName:r.businessName,
  serviceName:r.serviceName,
  staffName:r.staffName,
  date:r.date,
  startTime:r.startTime,
  endTime:r.endTime,
  totalLabel:r.totalLabel,
  message:"This is a fictional confirmation preview. No booking, payment, email or SMS has been sent."
 });
 return Object.freeze({status:"CONFIRMATION_PREVIEW_READY",bookingEnabled:false,confirmation});
}
return Object.freeze({prepareConfirmationPreview});
});
