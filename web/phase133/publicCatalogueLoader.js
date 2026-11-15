(function(root,factory){
"use strict";
const api=factory(typeof module!=="undefined"&&module.exports?require("../phase132/publicCatalogueDisplay"):root.BoustioPhase132CatalogueDisplay);
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPhase133PublicCatalogueLoader=api;
})(typeof window!=="undefined"?window:this,function(display){
"use strict";
// Phase 13.3: opt-in public catalogue loading contract. An explicitly supplied
// authorized public-data loader is required; no Firestore credentials or private
// owner documents are read here. This module never creates bookings.
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const unavailable=reason=>Object.freeze({status:"PUBLIC_CATALOGUE_UNAVAILABLE",bookingEnabled:false,reason,display:null});
function requestedSlug(locationSearch){
 if(typeof locationSearch!=="string"||locationSearch.length>512)return null;
 try{
  const params=new URLSearchParams(locationSearch.startsWith("?")?locationSearch.slice(1):locationSearch);
  const slugs=params.getAll("business");
  return slugs.length===1&&slugPattern.test(slugs[0])?slugs[0]:null;
 }catch{return null;}
}
async function loadPublishedBusiness(slug,publicLoader){
 if(typeof slug!=="string"||!slugPattern.test(slug))return unavailable("invalid_slug");
 if(typeof publicLoader!=="function")return unavailable("public_loader_not_configured");
 let payload;
 try{payload=await publicLoader(slug);}catch{return unavailable("public_catalogue_request_failed");}
 const result=display.prepareDisplay(payload,slug);
 if(result.status!=="PUBLIC_DISPLAY_READY")return unavailable(result.reason||"unpublished_or_invalid");
 return Object.freeze({status:"PUBLIC_CATALOGUE_READY",bookingEnabled:false,display:result.display});
}
async function renderPublishedBusiness(container,slug,publicLoader){
 if(!container||typeof container.replaceChildren!=="function")throw new TypeError("container required");
 const result=await loadPublishedBusiness(slug,publicLoader);
 container.replaceChildren();
 if(result.status!=="PUBLIC_CATALOGUE_READY"){
  const p=container.ownerDocument.createElement("p");p.textContent="Published business profile unavailable.";container.append(p);return result;
 }
 // Display renderer revalidates the supplied public payload to preserve fail-closed behavior.
 // No private fields are ever included in the returned display.
 const doc=container.ownerDocument,heading=doc.createElement("h2"),notice=doc.createElement("p");
 heading.textContent=result.display.heading;notice.textContent=result.display.disclaimer;
 const services=doc.createElement("ul"),staff=doc.createElement("ul");
 for(const s of result.display.services){const li=doc.createElement("li");li.textContent=s.title+" · "+s.duration+" · "+s.price;services.append(li);}
 for(const p of result.display.professionals){const li=doc.createElement("li");li.textContent=p.name;staff.append(li);}
 container.append(heading,notice,services,staff);return result;
}
return Object.freeze({requestedSlug,loadPublishedBusiness,renderPublishedBusiness});
});
