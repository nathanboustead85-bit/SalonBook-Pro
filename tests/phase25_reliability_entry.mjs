import {createReliabilityPreview} from "../website/customer/phase25-reliability.mjs";
import {createConflictPreview} from "../website/customer/phase25-conflicts.mjs";
import {createProfileDemo} from "../website/business/onboarding/phase24-profile.mjs";
import {createServicesDemo} from "../website/business/onboarding/phase24-services.mjs";
import {createStaffScheduleDemo} from "../website/business/onboarding/phase24-staff.mjs";
import {createPoliciesDemo} from "../website/business/onboarding/phase24-policies.mjs";
const owner="demo-kody",q=s=>document.querySelector(s);
function seed(){if(sessionStorage.getItem("boustio-phase25-5:seeded"))return;const p=createProfileDemo(sessionStorage,owner);p.update({name:"Kody Blends"});p.save();const s=createServicesDemo(sessionStorage,owner),service=s.addService({name:"Haircut",category:"Haircuts",pricePence:2000,durationMinutes:30,staffIds:[]});s.save();const st=createStaffScheduleDemo(sessionStorage,owner),barber=st.addStaff({name:"Demo Barber",role:"Barber"});st.addBreak(barber,"Friday","12:00","13:00");st.save();const pol=createPoliciesDemo(sessionStorage,owner);pol.update({bufferBeforeMinutes:10,bufferAfterMinutes:15});pol.save();const c=createConflictPreview(sessionStorage,owner);c.matching.assign(service,barber);c.matching.save();c.add({id:"demo-appt-first",date:"2026-11-20",start:"10:00",end:"10:30",staffId:barber});c.add({id:"demo-appt-second",date:"2026-11-20",start:"14:00",end:"14:30",staffId:barber});c.save();sessionStorage.setItem("boustio-phase25-5:seeded","1");}
seed();const demo=createReliabilityPreview(sessionStorage,owner);window.__phase25reliability=demo;
const conflicts=createConflictPreview(sessionStorage,owner);conflicts.matching.recover();
function option(el,id,label){const o=document.createElement("option");o.value=id;o.textContent=label;el.append(o);}
for(const s of conflicts.services)option(q("[data-service]"),s.id,s.name);
for(const s of conflicts.matching.matches(conflicts.services[0].id))option(q("[data-staff]"),s.id,s.name);
q("[data-check]").onclick=()=>{const area=q("[data-slots]");area.replaceChildren();try{const result=demo.inspect(q("[data-date]").value,q("[data-service]").value,q("[data-staff]").value);for(const s of result.slots){const el=document.createElement("div");el.className="slot";el.textContent=s.time+"–"+s.end;area.append(el);}q("[data-message]").textContent=result.count+" illustrative times; "+result.reason;}catch(e){q("[data-message]").textContent=e.message;}};
