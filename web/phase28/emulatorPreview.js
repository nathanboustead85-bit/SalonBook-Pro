(function(){"use strict";
// Emulator-only preview entry. Requires a trusted test harness to supply a read-only
// adapter. Never connects to a production project or initializes Firebase.
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),slug=params.get("business");
const status=$("stagingStatus"),services=$("stagingServices"),staff=$("stagingStaff"),name=$("stagingName");
function unavailable(){status.textContent="Published business unavailable. No booking can be made.";name.textContent="Business unavailable";services.replaceChildren();staff.replaceChildren();}
async function start(){
 if(!slug||params.getAll("business").length!==1||!window.BoustioPhase28BookingExperience.getRequestedSlug(location.search)){unavailable();return;}
 const reader=window.BoustioPhase284EmulatorReader;
 if(!reader||reader.projectId!=="demo-boustio-phase284"||typeof reader.lookup!=="function"||typeof reader.getPublicBusiness!=="function"){unavailable();return;}
 const result=await window.BoustioPhase282StagingCatalogue.loadStagingBookingPage(slug,reader.lookup,reader.getPublicBusiness);
 if(result.status!=="PREVIEW_READY"||result.bookingEnabled!==false){unavailable();return;}
 name.textContent=result.businessName;status.textContent="Read-only Firebase emulator preview · bookings disabled";
 services.replaceChildren();staff.replaceChildren();
 for(const s of result.services){const card=document.createElement("div");card.className="choice";const title=document.createElement("strong");title.textContent=s.title;const meta=document.createElement("span");meta.textContent=s.priceLabel+" · "+s.durationLabel;card.append(title,meta);services.append(card);}
 for(const s of result.staff){const card=document.createElement("div");card.className="choice";const title=document.createElement("strong");title.textContent=s.name;card.append(title);staff.append(card);}
}
start().catch(unavailable);
})();
