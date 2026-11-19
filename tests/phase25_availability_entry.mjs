import {createAvailabilityPreview} from "../website/customer/phase25-availability.mjs";
import {createProfileDemo} from "../website/business/onboarding/phase24-profile.mjs";
import {createServicesDemo} from "../website/business/onboarding/phase24-services.mjs";
import {createStaffScheduleDemo} from "../website/business/onboarding/phase24-staff.mjs";
import {createPoliciesDemo} from "../website/business/onboarding/phase24-policies.mjs";
const owner="demo-kody",q=s=>document.querySelector(s);
function seed(){if(sessionStorage.getItem("boustio-phase25-1:seeded"))return;const p=createProfileDemo(sessionStorage,owner);p.update({name:"Kody Blends",email:"demo@example.test",phone:"01803123456",address1:"1 Demo Street",town:"Torquay",postcode:"TQ1 1AA"});p.save();const s=createServicesDemo(sessionStorage,owner);s.addService({name:"Haircut",category:"Haircuts",pricePence:2000,durationMinutes:30,staffIds:[]});s.save();const st=createStaffScheduleDemo(sessionStorage,owner);st.addStaff({name:"Demo Barber",role:"Barber"});st.save();createPoliciesDemo(sessionStorage,owner).save();sessionStorage.setItem("boustio-phase25-1:seeded","1");}
seed();const demo=createAvailabilityPreview(sessionStorage,owner);window.__phase25preview=demo;
const services=demo.catalogue(),staff=createStaffScheduleDemo(sessionStorage,owner);staff.load();
function option(select,value,label){const o=document.createElement("option");o.value=value;o.textContent=label;select.append(o);}
for(const s of services)option(q("[data-service]"),s.id,s.name+" — £"+(s.pricePence/100).toFixed(2));
for(const s of staff.state.staff)option(q("[data-staff]"),s.id,s.name);
q("[data-check]").onclick=()=>{const area=q("[data-slots]");area.replaceChildren();try{const results=demo.slots(q("[data-date]").value,q("[data-service]").value,q("[data-staff]").value,"2026-11-19");for(const s of results){const tile=document.createElement("div");tile.className="slot";tile.textContent=s.time+"–"+s.end+" · "+s.staffName;area.append(tile);}q("[data-message]").textContent=results.length+" illustrative times; no bookings can be made";}catch(e){q("[data-message]").textContent=e.message;}};
