(function(root,factory){
"use strict";
const api=factory(typeof module!=="undefined"&&module.exports?require("../phase131/publicBusinessProfile"):root.BoustioPhase131PublicProfile);
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPhase132CatalogueDisplay=api;
})(typeof window!=="undefined"?window:this,function(source){
"use strict";
// Read-only public profile rendering. Data must come from an authorized public catalogue response.
// Never render arbitrary HTML, fetch private records or enable bookings.
function prepareDisplay(payload,slug){
 const result=source.prepareBusinessProfile(payload,slug);
 if(result.status!=="PUBLIC_PROFILE_DISPLAY_READY")return Object.freeze({status:"DISPLAY_UNAVAILABLE",bookingEnabled:false,reason:result.reason||"unavailable",display:null});
 const profile=result.profile;
 return Object.freeze({status:"PUBLIC_DISPLAY_READY",bookingEnabled:false,display:Object.freeze({
  heading:profile.businessName,
  services:Object.freeze(profile.services.map(s=>Object.freeze({id:s.id,title:s.title,price:s.priceLabel,duration:s.durationLabel}))),
  professionals:Object.freeze(profile.staff.filter(s=>s.serviceIds.length).map(s=>Object.freeze({id:s.id,name:s.name,serviceIds:s.serviceIds}))),
  disclaimer:"Published business catalogue preview. Live booking is not yet enabled."
 })});
}
function render(container,payload,slug){
 if(!container||typeof container.replaceChildren!=="function")throw new TypeError("container required");
 const prepared=prepareDisplay(payload,slug);
 container.replaceChildren();
 const doc=container.ownerDocument;
 const el=(tag,text)=>{const node=doc.createElement(tag);node.textContent=text;return node;};
 if(prepared.status!=="PUBLIC_DISPLAY_READY"){
  container.append(el("p","Published business profile unavailable."));
  return prepared;
 }
 const data=prepared.display;
 container.append(el("h2",data.heading),el("p",data.disclaimer));
 const services=el("h3","Published services");container.append(services);
 const list=doc.createElement("ul");
 for(const s of data.services)list.append(el("li",s.title+" · "+s.duration+" · "+s.price));
 container.append(list,el("h3","Available professionals"));
 const staff=doc.createElement("ul");
 for(const person of data.professionals)staff.append(el("li",person.name));
 container.append(staff);
 return prepared;
}
return Object.freeze({prepareDisplay,render});
});
