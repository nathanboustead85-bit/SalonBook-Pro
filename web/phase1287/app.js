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
const state={serviceId:"",staffId:"",date:"",time:""};
const view=window.BoustioCataloguePresentation.preparePublicView(catalogue,catalogue.slug);
if(view.status!=="PUBLIC_VIEW_READY"){ $("feedback").textContent="Preview unavailable";return;}
function button(label,pressed,disabled,action){const el=document.createElement("button");el.type="button";el.className="choice";el.textContent=label;el.setAttribute("aria-pressed",String(pressed));el.disabled=disabled;el.addEventListener("click",action);return el;}
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
 $("confirmation").hidden=true;$("feedback").textContent="";updateProgress();
 clear($("services"));view.view.services.forEach(s=>$("services").append(button(s.title+" · "+s.priceLabel+" · "+s.durationLabel,state.serviceId===s.id,false,()=>{state.serviceId=s.id;state.staffId="";state.time="";render();})));
 clear($("staff"));
 const eligible=view.view.staff.filter(s=>s.serviceIds.includes(state.serviceId));
 eligible.forEach(s=>$("staff").append(button(s.name,state.staffId===s.id,false,()=>{state.staffId=s.id;state.time="";render();})));
 if(!eligible.length)$("staff").textContent="Choose a service first.";
 clear($("times"));
 if(state.serviceId&&state.staffId&&state.date){
  slots.filter(s=>s.serviceId===state.serviceId&&s.staffId===state.staffId&&s.date===state.date).forEach(s=>$("times").append(button(s.time+(s.available?"":" · Unavailable"),state.time===s.time,!s.available,()=>{state.time=s.time;render();})));
 }else $("times").textContent="Select your service, professional and date first.";
 clear($("review"));
 const result=window.BoustioBookingReview.prepareBookingReview(catalogue,catalogue.slug,state.serviceId,state.staffId,state.date,state.time,slots);
 if(result.status==="REVIEW_PREVIEW_READY"){const r=result.review;detail($("review"),"Service",r.serviceName);detail($("review"),"Professional",r.staffName);detail($("review"),"Date",r.date);detail($("review"),"Time",r.startTime+"–"+r.endTime);detail($("review"),"Duration",r.durationLabel);detail($("review"),"Total",r.totalLabel);}
 else $("review").textContent="Choose your service, professional and time to see a review.";
}
dates.forEach(date=>{const opt=document.createElement("option");opt.value=date;opt.textContent=date+" (demo)";$("date").append(opt);});
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
 const panel=$("confirmation");clear(panel);const heading=document.createElement("h2");heading.textContent=result.journey.heading;panel.append(heading);
 detail(panel,"Customer",result.journey.customerName);detail(panel,"Service",result.journey.service.name);detail(panel,"Professional",result.journey.staffName);detail(panel,"Date",result.journey.date);detail(panel,"Time",result.journey.startTime+"–"+result.journey.endTime);detail(panel,"Total",result.journey.totalLabel);
 const note=document.createElement("p");note.textContent=result.journey.notice;panel.append(note);panel.hidden=false;panel.focus();
});
render();
})();
