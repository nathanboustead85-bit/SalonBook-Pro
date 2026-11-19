import {createStaffScheduleDemo,DAYS} from "../website/business/onboarding/phase24-staff.mjs";
const q=s=>document.querySelector(s),demo=createStaffScheduleDemo(sessionStorage,"demo-kody");window.__phase24staff=demo;
function options(selector,items,placeholder){const sel=q(selector),old=sel.value;sel.replaceChildren();for(const item of items){const opt=document.createElement("option");opt.value=item.id;opt.textContent=item.name;sel.append(opt);}if([...sel.options].some(x=>x.value===old))sel.value=old;}
function render(){const s=demo.state;options("[data-staff-select]",s.staff);options("[data-service-select]",s.services);q("[data-preview]").replaceChildren();for(const staff of demo.preview){const h=document.createElement("h3");h.textContent=staff.name+" — "+staff.role;q("[data-preview]").append(h);const p=document.createElement("p");p.textContent="Services: "+(staff.services.join(", ")||"None assigned");q("[data-preview]").append(p);const ul=document.createElement("ul");for(const day of DAYS){const v=staff.hours[day],li=document.createElement("li");li.textContent=day+": "+(v.off?"Day off":v.start+"–"+v.end+" · breaks "+(v.breaks.map(b=>b.start+"–"+b.end).join(", ")||"none"));ul.append(li);}q("[data-preview]").append(ul);}}
function action(fn){try{fn();q("[data-message]").textContent="Demonstration updated";render();}catch(e){q("[data-message]").textContent=e.message;}}
q("[data-add-staff]").onclick=()=>action(()=>demo.addStaff({name:q("[data-name]").value,role:q("[data-role]").value}));
q("[data-add-service]").onclick=()=>action(()=>demo.addService(q("[data-service]").value));
q("[data-assign]").onclick=()=>action(()=>{const id=q("[data-staff-select]").value,service=q("[data-service-select]").value;demo.assign(id,[service]);});
q("[data-hours]").onclick=()=>action(()=>demo.setDay(q("[data-staff-select]").value,q("[data-day]").value,{off:q("[data-off]").checked,start:q("[data-start]").value,end:q("[data-end]").value}));
q("[data-break]").onclick=()=>action(()=>demo.addBreak(q("[data-staff-select]").value,q("[data-day]").value,q("[data-break-start]").value,q("[data-break-end]").value));
q("[data-save]").onclick=()=>action(()=>demo.save());q("[data-recover]").onclick=()=>action(()=>demo.load());q("[data-clear]").onclick=()=>action(()=>demo.clear());
try{demo.load();}catch(e){q("[data-message]").textContent="Recovery rejected: "+e.message;}render();
