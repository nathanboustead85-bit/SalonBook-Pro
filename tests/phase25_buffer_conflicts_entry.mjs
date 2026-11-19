import {createBufferedConflictPreview} from "../website/customer/phase25-buffer-conflicts.mjs";
import {createConflictPreview} from "../website/customer/phase25-conflicts.mjs";
import {createProfileDemo} from "../website/business/onboarding/phase24-profile.mjs";
import {createServicesDemo} from "../website/business/onboarding/phase24-services.mjs";
import {createStaffScheduleDemo} from "../website/business/onboarding/phase24-staff.mjs";
import {createPoliciesDemo} from "../website/business/onboarding/phase24-policies.mjs";
const owner="demo-kody",q=s=>document.querySelector(s);
function seed(){if(sessionStorage.getItem("boustio-phase25-4:seeded"))return;const p=createProfileDemo(sessionStorage,owner);p.update({name:"Kody Blends"});p.save();const s=createServicesDemo(sessionStorage,owner),service=s.addService({name:"Haircut",category:"Haircuts",pricePence:2000,durationMinutes:30,staffIds:[]});s.save();const st=createStaffScheduleDemo(sessionStorage,owner),barber=st.addStaff({name:"Demo Barber",role:"Barber"});st.save();const pol=createPoliciesDemo(sessionStorage,owner);pol.update({bufferBeforeMinutes:10,bufferAfterMinutes:15});pol.save();const c=createConflictPreview(sessionStorage,owner);c.matching.assign(service,barber);c.matching.save();c.add({id:"demo-appt-first",date:"2026-11-20",start:"10:00",end:"10:30",staffId:barber});c.save();sessionStorage.setItem("boustio-phase25-4:seeded","1");}
seed();const demo=createBufferedConflictPreview(sessionStorage,owner);demo.matching.recover();const conflicts=createConflictPreview(sessionStorage,owner);conflicts.recover();window.__phase25buffers=demo;
function option(select,value,label){const el=document.createElement("option");el.value=value;el.textContent=label;select.append(el);}
for(const s of demo.services)option(q("[data-service]"),s.id,s.name+" — £"+(s.pricePence/100).toFixed(2));
function renderStaff(){const el=q("[data-staff]");el.replaceChildren();for(const s of demo.matching.matches(q("[data-service]").value))option(el,s.id,s.name);}
q("[data-service]").onchange=renderStaff;renderStaff();
const b=demo.buffers;q("[data-buffer]").textContent=b?"Preparation: "+b.before+" min · Cleanup: "+b.after+" min":"Policies unavailable";
q("[data-check]").onclick=()=>{const area=q("[data-slots]");area.replaceChildren();try{const slots=demo.slots(q("[data-date]").value,q("[data-service]").value,q("[data-staff]").value);for(const s of slots){const el=document.createElement("div");el.className="slot";el.textContent=s.time+"–"+s.end;area.append(el);}q("[data-message]").textContent=slots.length+" illustrative times after buffer-aware conflict filtering";}catch(e){q("[data-message]").textContent=e.message;}};
