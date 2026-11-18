import {dashboardModel,DEMO} from "./dashboard.mjs";
// Phase 18.8 preview: display fixed demo data with textContent, never HTML injection.
if(typeof document!=="undefined"){
 const model=dashboardModel(DEMO);
 const byId=id=>document.getElementById(id);
 const put=(id,value)=>{byId(id).textContent=String(value);};
 const row=(container,left,right)=>{
  const line=document.createElement("div");line.className="line";
  const a=document.createElement("span");a.textContent=String(left);
  const b=document.createElement("strong");b.textContent=String(right);
  line.append(a,b);container.append(line);
 };
 put("business-title",model.business);
 put("service-count",model.services.length);
 put("staff-count",model.staff.length);
 put("progress-label",model.progress+"% of demonstration setup details complete");
 byId("progress-bar").setAttribute("aria-valuenow",String(model.progress));
 byId("progress-fill").style.width=model.progress+"%";
 put("account-business",model.business);
 put("account-category",model.category);
 put("account-email",model.owner);
 for(const service of model.services)row(byId("service-list"),service.name,"£"+service.price.toFixed(2)+" · "+service.duration+" min");
 for(const person of model.staff)row(byId("staff-list"),person.name,"Demo member");
 for(const [day,hours] of Object.entries(model.hours))row(byId("hours-list"),day,hours);
 const buttons=[...document.querySelectorAll(".nav button[data-target]")];
 const sections=[...document.querySelectorAll(".section")];
 for(const button of buttons)button.addEventListener("click",()=>{
  const target=button.dataset.target;
  for(const section of sections)section.hidden=section.id!==target;
  for(const item of buttons){
   if(item===button)item.setAttribute("aria-current","page");
   else item.removeAttribute("aria-current");
  }
 });
}
