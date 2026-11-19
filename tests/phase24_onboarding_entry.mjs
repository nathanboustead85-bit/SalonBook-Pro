import {createDemoOnboarding} from "../website/business/onboarding/phase24-demo.mjs";
const demo=createDemoOnboarding();window.__phase24demo=demo;
const q=s=>document.querySelector(s);
function render(){const s=demo.state;q("[data-output]").replaceChildren();const p=document.createElement("p");p.textContent=s.business.name?s.business.name+" · "+s.business.category:"Business not configured";q("[data-output]").append(p);for(const [heading,items] of [["Services",s.services.map(x=>x.name+" · £"+(x.pricePence/100).toFixed(2)+" · "+x.durationMinutes+" min")],["Professionals",s.staff.map(x=>x.name)]]){const h=document.createElement("h3");h.textContent=heading;q("[data-output]").append(h);const ul=document.createElement("ul");for(const item of items){const li=document.createElement("li");li.textContent=item;ul.append(li);}q("[data-output]").append(ul);}q("[data-link]").textContent=demo.previewLink||"Set up a business to see an example link.";}
function action(fn){try{fn();q("[data-error]").textContent="";render();}catch(e){q("[data-error]").textContent=e.message;}}
q("[data-business]").addEventListener("click",()=>action(()=>demo.setBusiness(q("[data-name]").value,q("[data-category]").value)));
q("[data-add-service]").addEventListener("click",()=>action(()=>demo.addService(q("[data-service]").value,Math.round(Number(q("[data-price]").value)*100),Number(q("[data-duration]").value))));
q("[data-add-staff]").addEventListener("click",()=>action(()=>demo.addStaff(q("[data-staff]").value)));
render();
