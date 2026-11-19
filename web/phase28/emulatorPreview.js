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
 const state={service:null,professional:null,date:"",time:""};
 const dates=$("stagingDate"),times=$("stagingTimes"),summary=$("stagingSummary");
 function choice(title,subtitle,selected,action){const button=document.createElement("button");button.type="button";button.className="choice";button.setAttribute("aria-pressed",String(selected));const heading=document.createElement("strong");heading.textContent=title;button.append(heading);if(subtitle){const detail=document.createElement("span");detail.textContent=subtitle;button.append(detail);}button.addEventListener("click",action);return button;}
 function row(label,value){const el=document.createElement("div");el.className="line";const key=document.createElement("span");key.textContent=label;const val=document.createElement("strong");val.textContent=value;el.append(key,val);return el;}
 function render(){
  services.replaceChildren();staff.replaceChildren();times.replaceChildren();summary.replaceChildren();
  for(const s of result.services)services.append(choice(s.title,s.priceLabel+" · "+s.durationLabel,state.service===s.id,()=>{state.service=s.id;state.professional=null;state.time="";render();}));
  for(const p of result.staff.filter(p=>state.service&&p.serviceIds.includes(state.service)))staff.append(choice(p.name,"Professional",state.professional===p.id,()=>{state.professional=p.id;state.time="";render();}));
  if(!staff.childNodes.length)staff.textContent="Select a service first.";
  if(state.service&&state.professional&&state.date){for(const t of ["09:00","10:30","14:00","15:30"])times.append(choice(t,"",state.time===t,()=>{state.time=t;render();}));}
  else times.textContent="Choose a service, professional and sample date first.";
  const service=result.services.find(s=>s.id===state.service),person=result.staff.find(p=>p.id===state.professional);
  if(service)summary.append(row("Service",service.title),row("Price",service.priceLabel),row("Duration",service.durationLabel));
  if(person)summary.append(row("Professional",person.name));
  if(state.date)summary.append(row("Date",state.date==="demo-friday"?"Friday (demo)":"Saturday (demo)"));
  if(state.time)summary.append(row("Time",state.time));
  if(!service)summary.textContent="Select a service to begin.";
 }
 dates.addEventListener("change",()=>{state.date=dates.value;state.time="";render();});
 render();
}
start().catch(unavailable);
})();
