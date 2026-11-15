(function(){
"use strict";
// All catalogue records and slots below are invented for this demonstration.
const catalogue={schemaVersion:1,slug:"kody-blends-demo",published:true,businessName:"Kody Blends",services:[
{id:"cut",name:"Signature Haircut",pricePence:2000,durationMinutes:30,published:true},
{id:"beard",name:"Beard Shape",pricePence:1200,durationMinutes:20,published:true},
{id:"combo",name:"Hair & Beard",pricePence:3000,durationMinutes:50,published:true}
],staff:[{id:"kody",name:"Kody (demo)",active:true,serviceIds:["cut","beard","combo"]},{id:"alex",name:"Alex (demo)",active:true,serviceIds:["cut","combo"]}]};
const dates=["2026-11-20","2026-11-21","2026-11-22"];
const times=["09:00","10:00","11:00","14:00","15:00"];
const slots=dates.flatMap(date=>times.flatMap(time=>catalogue.staff.flatMap(person=>person.serviceIds.map(serviceId=>({date,time,staffId:person.id,serviceId,available:time!=="11:00"})))));
const $=id=>document.getElementById(id);
// Format sample dates locally without parsing UTC midnight into another day.
function displayDate(iso){const [year,month,day]=iso.split("-").map(Number);return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,day)));}
const state={serviceId:"",staffId:"",date:"",time:""};
const view=window.BoustioCataloguePresentation.preparePublicView(catalogue,catalogue.slug);
if(view.status!=="PUBLIC_VIEW_READY"){ $("feedback").textContent="Preview unavailable";return;}
function button(label,pressed,disabled,action){const el=document.createElement("button");el.type="button";el.className="choice";el.textContent=label;el.setAttribute("aria-pressed",String(pressed));el.disabled=disabled;el.addEventListener("click",action);return el;}
function serviceCard(service){
 const el=button(service.title+" · "+service.priceLabel+" · "+service.durationLabel,state.serviceId===service.id,false,()=>{state.serviceId=service.id;state.staffId="";state.time="";render();});
 el.classList.add("service-card");
 el.replaceChildren();
 const name=document.createElement("span");name.className="service-card-name";name.textContent=service.title;
 const meta=document.createElement("span");meta.className="service-card-meta";meta.textContent=service.durationLabel;
 const price=document.createElement("strong");price.className="service-card-price";price.textContent=service.priceLabel;
 el.append(name,meta,price);
 return el;
}
function professionalCard(person){
 const el=button(person.name,state.staffId===person.id,false,()=>{state.staffId=person.id;state.time="";render();});
 el.classList.add("professional-card");
 el.setAttribute("aria-label",person.name);
 el.replaceChildren();
 const avatar=document.createElement("span");avatar.className="professional-avatar";avatar.setAttribute("aria-hidden","true");
 avatar.textContent=person.name.replace(/\\s*\\(demo\\)/i,"").trim().slice(0,1).toUpperCase();
 const copy=document.createElement("span");copy.className="professional-copy";
 const name=document.createElement("strong");name.className="professional-name";name.textContent=person.name;
 const caption=document.createElement("span");caption.className="professional-caption";caption.textContent="Sample professional";
 copy.append(name,caption);
 const check=document.createElement("span");check.className="professional-check";check.setAttribute("aria-hidden","true");check.textContent="✓";
 el.append(avatar,copy,check);
 return el;
}
function clear(node){node.replaceChildren();}
function detail(parent,key,value){const row=document.createElement("div");row.className="detail";const k=document.createElement("span");k.textContent=key;const v=document.createElement("strong");v.textContent=value;row.append(k,v);parent.append(row);}
function updateProgress(){
 const stage=!state.serviceId?0:!state.staffId?1:!state.date||!state.time?2:3;
 const ids=["stepService","stepStaff","stepTime","stepDetails"];
 ids.forEach((id,index)=>{const el=$(id);el.classList.toggle("complete",index<stage);el.classList.toggle("current",index===stage);if(index===stage)el.setAttribute("aria-current","step");else el.removeAttribute("aria-current");});
 const messages=["Start by choosing a service.","Now choose your professional.","Choose a demonstration date and available time.","Selection complete. Review your appointment and enter fictional details."];
 $("progressMessage").textContent=messages[stage];
}
function render(){
 const selected=[state.serviceId,state.staffId,state.date,state.time].filter(Boolean).length;
 $("selectionReadiness").textContent=selected+" of 4 selected";
 $("selectionReadinessFill").style.width=(selected*25)+"%";
 const nextStep=!state.serviceId?"Next: choose a service.":!state.staffId?"Next: choose a professional.":!state.date?"Next: select a demonstration date.":!state.time?"Next: choose an available demonstration time.":"Ready to review. Enter fictional details below.";
 $("summaryNextStep").textContent=nextStep;
 $("summaryNextStep").classList.toggle("summary-next-step-ready",selected===4);
 $("resetSelection").disabled=!state.serviceId&&!state.staffId&&!state.date&&!state.time;
 $("confirmation").hidden=true;$("feedback").textContent="";updateProgress();
 clear($("services"));view.view.services.forEach(s=>$("services").append(serviceCard(s)));
 clear($("staff"));
 const eligible=view.view.staff.filter(s=>s.serviceIds.includes(state.serviceId));
 eligible.forEach(s=>$("staff").append(professionalCard(s)));
 if(!eligible.length)$("staff").textContent="Choose a service first.";
 clear($("times"));
 if(state.serviceId&&state.staffId&&state.date){
  const matching=slots.filter(s=>s.serviceId===state.serviceId&&s.staffId===state.staffId&&s.date===state.date);
  for(const [period,label] of [["morning","Morning"],["afternoon","Afternoon"]]){
   const group=matching.filter(s=>(Number(s.time.slice(0,2))<12?"morning":"afternoon")===period);
   if(!group.length)continue;
   const heading=document.createElement("div");heading.className="time-period-heading";heading.setAttribute("role","heading");heading.setAttribute("aria-level","3");heading.textContent=label;
   $("times").append(heading);
   group.forEach(s=>$("times").append(button(s.time+(s.available?"":" · Unavailable"),state.time===s.time,!s.available,()=>{state.time=s.time;render();})));
  }
 }else $("times").textContent="Select your service, professional and date first.";
 clear($("review"));
 const result=window.BoustioBookingReview.prepareBookingReview(catalogue,catalogue.slug,state.serviceId,state.staffId,state.date,state.time,slots);
 if(result.status==="REVIEW_PREVIEW_READY"){const r=result.review;detail($("review"),"Service",r.serviceName);detail($("review"),"Professional",r.staffName);detail($("review"),"Date",displayDate(r.date));detail($("review"),"Time",r.startTime+"–"+r.endTime);detail($("review"),"Duration",r.durationLabel);detail($("review"),"Total",r.totalLabel);}
 else $("review").textContent="Choose your service, professional and time to see a review.";
}
function updateFieldGuidance(id,hintId,valid,emptyMessage,validMessage,invalidMessage){
 const field=$(id),hint=$(hintId);
 const touched=field.dataset.touched==="true";
 if(!touched){hint.classList.remove("field-hint-error","field-hint-valid");return;}
 const empty=!field.value.trim();
 hint.textContent=empty?emptyMessage:valid?validMessage:invalidMessage;
 hint.classList.toggle("field-hint-error",!valid);
 hint.classList.toggle("field-hint-valid",valid);
 field.setAttribute("aria-invalid",String(!valid));
}
function updateCustomerFieldGuidance(){
 const email=$("customerEmail").value.trim();
 updateFieldGuidance("customerName","nameHint",!!$("customerName").value.trim(),"Enter a fictional name.","Name looks ready.","Please enter a fictional name.");
 updateFieldGuidance("customerEmail","emailHint",/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),"Enter a fictional email address.","Email format looks ready.","Use a valid email format, such as name@example.test.");
 updateFieldGuidance("customerPhone","phoneHint",!!$("customerPhone").value.trim(),"Enter a fictional phone number.","Phone looks ready.","Please enter a fictional phone number.");
}
for(const id of ["customerName","customerEmail","customerPhone"]){
 $(id).addEventListener("blur",()=>{$(id).dataset.touched="true";updateCustomerFieldGuidance();});
 $(id).addEventListener("input",updateCustomerFieldGuidance);
}
function updateDetailsReadiness(){
 const validName=$("customerName").value.trim().length>0;
 const email=$("customerEmail").value.trim();
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 const validPhone=$("customerPhone").value.trim().length>0;
 const ready=[validName,validEmail,validPhone,$("consent").checked].filter(Boolean).length;
 $("detailsReadiness").textContent=ready+" of 4 ready";
 $("detailsReadinessFill").style.width=(ready*25)+"%";
}
for(const id of ["customerName","customerEmail","customerPhone"]){
 $(id).addEventListener("input",updateDetailsReadiness);
}
$("consent").addEventListener("change",updateDetailsReadiness);
updateDetailsReadiness();
$("resetSelection").addEventListener("click",()=>{
 state.serviceId="";state.staffId="";state.date="";state.time="";
 $("date").value="";
 render();
 $("services").querySelector("button")?.focus();
});
dates.forEach(date=>{const opt=document.createElement("option");opt.value=date;opt.textContent=displayDate(date)+" · demo";$("date").append(opt);});
$("date").addEventListener("change",()=>{state.date=$("date").value;state.time="";render();});
$("journey").addEventListener("submit",event=>{
 event.preventDefault();$("confirmation").hidden=true;
 for(const id of ["customerName","customerEmail","customerPhone"]){$(id).removeAttribute("aria-invalid");}
 const customer={name:$("customerName").value,email:$("customerEmail").value,phone:$("customerPhone").value,consent:$("consent").checked};
 const result=window.BoustioBookingJourneyPreview.prepareJourneyPreview(catalogue,{slug:catalogue.slug,...state,customer},slots);
 if(result.status!=="JOURNEY_PREVIEW_READY"){
  $("feedback").className="error";
  const missingSelection=!state.serviceId||!state.staffId||!state.date||!state.time;
  const invalidName=!customer.name.trim();
  const invalidEmail=!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());
  const invalidPhone=!customer.phone.trim();
  if(invalidName)$("customerName").setAttribute("aria-invalid","true");
  if(invalidEmail)$("customerEmail").setAttribute("aria-invalid","true");
  if(invalidPhone)$("customerPhone").setAttribute("aria-invalid","true");
  $("feedback").textContent=missingSelection?"Choose a service, professional, date and time first.":invalidName?"Enter a demonstration name.":invalidEmail?"Enter a valid demonstration email address.":invalidPhone?"Enter a demonstration phone number.":!customer.consent?"Tick the demonstration consent checkbox.":"Check your details and try again.";
  $("feedback").focus();return;
 }
 $("feedback").className="";$("feedback").textContent="";
 const panel=$("confirmation");clear(panel);
 const banner=document.createElement("div");banner.className="confirmation-banner";
 const symbol=document.createElement("span");symbol.className="confirmation-symbol";symbol.setAttribute("aria-hidden","true");symbol.textContent="✓";
 const copy=document.createElement("div");copy.className="confirmation-copy";
 const eyebrow=document.createElement("p");eyebrow.className="confirmation-eyebrow";eyebrow.textContent="DEMONSTRATION PREVIEW";
 const heading=document.createElement("h2");heading.textContent=result.journey.heading;
 const subtitle=document.createElement("p");subtitle.className="confirmation-subtitle";subtitle.textContent="This is an example confirmation. No appointment has been booked.";
 copy.append(eyebrow,heading,subtitle);banner.append(symbol,copy);panel.append(banner);
 detail(panel,"Customer",result.journey.customerName);detail(panel,"Service",result.journey.service.name);detail(panel,"Professional",result.journey.staffName);detail(panel,"Date",displayDate(result.journey.date));detail(panel,"Time",result.journey.startTime+"–"+result.journey.endTime);detail(panel,"Total",result.journey.totalLabel);
 const note=document.createElement("p");note.textContent=result.journey.notice;panel.append(note);panel.hidden=false;panel.focus();
});
render();
})();
