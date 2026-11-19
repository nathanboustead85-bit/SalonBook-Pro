(function(){"use strict";
// Phase 28.1 uses public-shaped fictional data. No network, Firestore, payment or write operations.
const fixture={schemaVersion:1,slug:"kody-blends-demo",published:true,businessName:"Kody Blends",services:[{id:"cut",name:"Signature Haircut",pricePence:2000,durationMinutes:30,published:true},{id:"beard",name:"Beard Shape",pricePence:1200,durationMinutes:20,published:true},{id:"combo",name:"Hair & Beard",pricePence:3000,durationMinutes:50,published:true}],staff:[{id:"kody",name:"Kody (demo)",active:true,serviceIds:["cut","beard","combo"]},{id:"alex",name:"Alex (demo)",active:true,serviceIds:["cut","combo"]}]};
const $=id=>document.getElementById(id),slug=window.BoustioPhase28BookingExperience.getRequestedSlug(location.search)||fixture.slug;
const page=window.BoustioPhase28BookingExperience.prepareBookingPage(slug===fixture.slug?fixture:null,slug);
const state={service:null,staff:null,date:"",time:""};
function choice(title,sub,selected,action){const b=document.createElement("button");b.type="button";b.className="choice";b.setAttribute("aria-pressed",String(selected));const strong=document.createElement("strong");strong.textContent=title;b.append(strong);if(sub){const s=document.createElement("span");s.textContent=sub;b.append(s);}b.addEventListener("click",action);return b;}
function line(key,value){const row=document.createElement("div");row.className="line";const k=document.createElement("span");k.textContent=key;const v=document.createElement("strong");v.textContent=value;row.append(k,v);return row;}
function render(){const services=$("services"),staff=$("staff"),times=$("times"),summary=$("summary");services.replaceChildren();staff.replaceChildren();times.replaceChildren();summary.replaceChildren();
if(page.status!=="PREVIEW_READY"){services.textContent="This demonstration catalogue is unavailable.";staff.textContent="No professionals available.";summary.textContent="No appointment can be selected.";return;}
page.services.forEach(s=>services.append(choice(s.title,s.priceLabel+" · "+s.durationLabel,state.service===s.id,()=>{state.service=s.id;state.staff=null;state.time="";render();})));
page.staff.filter(s=>state.service&&s.serviceIds.includes(state.service)).forEach(s=>staff.append(choice(s.name,"Professional",state.staff===s.id,()=>{state.staff=s.id;state.time="";render();})));
if(!staff.childNodes.length)staff.textContent="Choose a service first.";
if(state.service&&state.staff&&state.date){["09:00","10:30","14:00","15:30"].forEach(t=>times.append(choice(t,"",state.time===t,()=>{state.time=t;render();})));}else times.textContent="Choose your service, professional and sample date first.";
const service=page.services.find(s=>s.id===state.service),person=page.staff.find(s=>s.id===state.staff);
if(service)summary.append(line("Service",service.title),line("Price",service.priceLabel));if(person)summary.append(line("Professional",person.name));if(state.date)summary.append(line("Date",state.date==="demo-friday"?"Friday (demo)":"Saturday (demo)"));if(state.time)summary.append(line("Time",state.time));if(!service)summary.textContent="Select a service to begin.";
}
if(page.status==="PREVIEW_READY")$("business").textContent=page.businessName;
$("date").addEventListener("change",()=>{state.date=$("date").value;state.time="";render();});render();
})();
