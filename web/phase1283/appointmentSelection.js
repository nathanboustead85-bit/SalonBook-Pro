(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioAppointmentSelection=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Fictional display-only slot selection. Slots are supplied by a trusted preview fixture,
// NOT computed from live availability or reserved.
const {prepareSelection}=typeof module!=="undefined"&&module.exports
 ?require("../phase1282/serviceStaffSelection")
 :{prepareSelection:window.BoustioServiceStaffSelection.prepareSelection};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const fail=reason=>Object.freeze({status:"APPOINTMENT_PREVIEW_UNAVAILABLE",bookingEnabled:false,reason,appointment:null});
function validDate(s){
 if(typeof s!=="string"||!datePattern.test(s))return false;
 const [y,m,d]=s.split("-").map(Number);
 if(y<2020||y>2100)return false;
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function prepareAppointmentPreview(payload,slug,serviceId,staffId,date,time,previewSlots){
 const selection=prepareSelection(payload,slug,serviceId,staffId);
 if(selection.status!=="SELECTION_PREVIEW_READY")return fail(selection.reason||"selection_unavailable");
 if(!selection.selection.selectedStaff)return fail("staff_required");
 if(!validDate(date))return fail("invalid_date");
 if(typeof time!=="string"||!timePattern.test(time))return fail("invalid_time");
 if(!Array.isArray(previewSlots)||previewSlots.length>200)return fail("invalid_preview_slots");
 const seen=new Set();
 for(const slot of previewSlots){
  if(!slot||typeof slot!=="object"||!validDate(slot.date)||!timePattern.test(slot.time||"")||
     typeof slot.staffId!=="string"||typeof slot.serviceId!=="string"||
     typeof slot.available!=="boolean")return fail("invalid_preview_slot");
  const key=[slot.date,slot.time,slot.staffId,slot.serviceId].join("|");
  if(seen.has(key))return fail("duplicate_preview_slot");
  seen.add(key);
 }
 const slot=previewSlots.find(s=>s.date===date&&s.time===time&&s.staffId===staffId&&s.serviceId===serviceId);
 if(!slot||!slot.available)return fail("preview_slot_unavailable");
 return Object.freeze({status:"APPOINTMENT_PREVIEW_READY",bookingEnabled:false,appointment:Object.freeze({
  businessName:selection.selection.businessName,
  service:selection.selection.service,
  staff:selection.selection.selectedStaff,
  date,time,
  summary:selection.selection.summary+" · "+date+" "+time,
  notice:"Fictional preview only — availability is not live and no booking has been made."
 })});
}
return Object.freeze({validDate,prepareAppointmentPreview});
});
