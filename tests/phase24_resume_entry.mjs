import {createResumableDemo} from "../website/business/onboarding/phase24-resume.mjs";
const q=s=>document.querySelector(s);let demo;
function render(){const s=demo.state,p=demo.progress;q("[data-progress]").textContent=["Business profile","Services","Staff"].map((n,i)=>n+": "+([p.profile,p.services,p.staff][i]?"complete":"pending")).join(" · ");q("[data-summary]").textContent=s.business.name+" · "+s.services.map(x=>x.name).join(", ")+" · "+s.staff.map(x=>x.name).join(", ");q("[data-link]").textContent=demo.previewLink||"No example link yet";}
function start(id){demo=createResumableDemo(sessionStorage,id);window.__phase24resume=demo;try{demo.load();q("[data-message]").textContent="Demo account loaded";}catch(e){q("[data-message]").textContent="Recovery rejected: "+e.message;}render();}
function action(fn){try{fn();q("[data-message]").textContent="Demonstration updated";render();}catch(e){q("[data-message]").textContent=e.message;}}
q("[data-switch]").onclick=()=>start(q("[data-owner]").value);
q("[data-business]").onclick=()=>action(()=>demo.setBusiness(q("[data-name]").value,q("[data-category]").value));
q("[data-service-add]").onclick=()=>action(()=>demo.addService(q("[data-service]").value,2000,30));
q("[data-staff-add]").onclick=()=>action(()=>demo.addStaff(q("[data-staff]").value));
q("[data-save]").onclick=()=>action(()=>demo.save());
q("[data-recover]").onclick=()=>action(()=>demo.load());
q("[data-clear]").onclick=()=>action(()=>demo.clear());
start("demo-kody");
