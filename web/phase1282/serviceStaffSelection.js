(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioServiceStaffSelection=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
const {preparePublicView}=typeof module!=="undefined"&&module.exports
 ?require("../phase1281/cataloguePresentation")
 :{preparePublicView:window.BoustioCataloguePresentation.preparePublicView};
const reject=(reason)=>Object.freeze({status:"SELECTION_UNAVAILABLE",bookingEnabled:false,reason,selection:null});
function prepareSelection(payload,slug,serviceId,staffId){
 const result=preparePublicView(payload,slug);
 if(result.status!=="PUBLIC_VIEW_READY")return reject(result.reason||"catalogue_unavailable");
 const view=result.view;
 if(typeof serviceId!=="string"||!serviceId)return reject("service_required");
 const service=view.services.find(s=>s.id===serviceId);
 if(!service)return reject("service_unavailable");
 const eligible=view.staff.filter(p=>p.serviceIds.includes(serviceId));
 if(staffId!==undefined&&staffId!==null&&staffId!==""){
  if(typeof staffId!=="string")return reject("invalid_staff");
  if(!eligible.some(p=>p.id===staffId))return reject("staff_unavailable");
 }
 const chosen=staffId?eligible.find(p=>p.id===staffId):null;
 return Object.freeze({status:"SELECTION_PREVIEW_READY",bookingEnabled:false,selection:Object.freeze({
  businessName:view.businessName,slug:view.slug,
  service,eligibleStaff:Object.freeze(eligible),
  selectedStaff:chosen||null,
  summary:service.title+" · "+service.durationLabel+" · "+service.priceLabel,
  notice:"Preview only — no appointment has been reserved."
 })});
}
return Object.freeze({prepareSelection});
});
