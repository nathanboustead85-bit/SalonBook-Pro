(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioCataloguePresentation=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Display-only bridge. Never accepts private owner, client or booking records.
const {prepareCatalogue}=typeof module!=="undefined"&&module.exports
 ?require("../phase1280/catalogueContract")
 :{prepareCatalogue:window.BoustioCatalogueContract.prepareCatalogue};
const fail=(reason)=>Object.freeze({status:"CATALOGUE_UNAVAILABLE",bookingEnabled:false,reason,view:null});
function preparePublicView(payload,requestedSlug){
 const result=prepareCatalogue(payload,requestedSlug);
 if(result.status!=="CATALOGUE_DISPLAY_READY")return fail(result.reason||"unavailable");
 const p=result.profile;
 const services=p.services.map(s=>Object.freeze({
  id:s.id,title:s.name,priceLabel:"£"+(s.pricePence/100).toFixed(2),
  durationLabel:s.durationMinutes+" min",pricePence:s.pricePence,durationMinutes:s.durationMinutes
 }));
 const eligible=new Set(services.map(s=>s.id));
 const staff=p.staff.map(s=>Object.freeze({id:s.id,name:s.name,serviceIds:Object.freeze(s.serviceIds.filter(id=>eligible.has(id)))}));
 return Object.freeze({status:"PUBLIC_VIEW_READY",bookingEnabled:false,view:Object.freeze({
  businessName:p.businessName,slug:requestedSlug,
  services:Object.freeze(services),staff:Object.freeze(staff),
  notice:"Preview only — appointments cannot be booked here."
 })});
}
return Object.freeze({preparePublicView});
});
