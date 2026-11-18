import {DAYS,MAX_SERVICES,MAX_STAFF,defaultWeek,validateWeek,validateCollection,validateService,validateStaff,validateSetup,reviewLines} from "./enhanced-draft.mjs";
// Phase 18.4: memory-only business setup preview. No Firebase, storage, or network.
export const SETUP_PUBLISHING_ENABLED = false;
export const CUSTOMER_BOOKINGS_ENABLED = false;
export const STEPS = Object.freeze(["Business","Services","Hours","Staff","Review"]);
const categories=new Set(["salon","barber","nails","beauty","wellness"]);
export function validateStep(step,d) {
  const str=x=>typeof x==="string"?x.trim():"";
  switch(step){
    case 0: return str(d.name).length>=2 && str(d.name).length<=100 && categories.has(d.category) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(d.contact)) && str(d.contact).length<=254;
    case 1: return str(d.service).length>=2 && str(d.service).length<=100 && str(d.price)!=="" && Number.isFinite(Number(d.price)) && Number(d.price)>=0 && Number(d.price)<=10000 && [15,30,45,60,90,120].includes(Number(d.duration));
    case 2: return /^\d{2}:\d{2}$/.test(str(d.opening)) && /^\d{2}:\d{2}$/.test(str(d.closing)) && str(d.opening)<str(d.closing);
    case 3: return str(d.staff).length>=2 && str(d.staff).length<=100;
    case 4: return true;
    default: return false;
  }
}
export function safeReview(d){
  return [
    "Business: "+String(d.name||"").slice(0,100),
    "Type: "+String(d.category||""),
    "Contact: "+String(d.contact||"").slice(0,254),
    "Service: "+String(d.service||"").slice(0,100),
    "Price: £"+String(d.price||"0"),
    "Duration: "+String(d.duration||"")+" minutes",
    "Hours: "+String(d.opening||"")+"–"+String(d.closing||""),
    "Staff: "+String(d.staff||"").slice(0,100),
    "Bookings: Disabled"
  ].join("\n");
}
if(typeof document!=="undefined"){
 const form=document.getElementById("wizard");
 if(form){
  let current=0;
  const services=[];
  const staff=[];
  const week=defaultWeek();
  const servicesList=document.getElementById("services-list");
  const staffList=document.getElementById("staff-list");
  const weekly=document.getElementById("weekly-hours");
  function addItem(list,container,item){list.push(item);renderItems(list,container);}
  function renderItems(list,container){
   container.replaceChildren();
   list.forEach((item,index)=>{
    const row=document.createElement("div");row.className="item";
    const label=document.createElement("span");label.textContent=typeof item==="string"?item:item.name+" — £"+Number(item.price).toFixed(2)+" / "+item.duration+" min";
    const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.setAttribute("aria-label","Remove "+(typeof item==="string"?item:item.name));
    remove.addEventListener("click",()=>{list.splice(index,1);renderItems(list,container);});
    row.append(label,remove);container.append(row);
   });
  }
  for(const day of DAYS){
   const row=document.createElement("div");row.className="day";
   const label=document.createElement("strong");label.textContent=day;
   const closed=document.createElement("input");closed.type="checkbox";closed.checked=week[day].closed;closed.setAttribute("aria-label",day+" closed");
   const open=document.createElement("input");open.type="time";open.value=week[day].open;open.setAttribute("aria-label",day+" opening time");
   const close=document.createElement("input");close.type="time";close.value=week[day].close;close.setAttribute("aria-label",day+" closing time");
   function sync(){week[day]={closed:closed.checked,open:open.value,close:close.value};open.disabled=closed.checked;close.disabled=closed.checked;}
   for(const element of [closed,open,close])element.addEventListener("change",sync);
   row.append(label,closed,open,close);weekly.append(row);sync();
  }
  document.getElementById("add-service").addEventListener("click",()=>{
   const d=draft();const item={name:d.service,price:d.price,duration:d.duration};
   if(!validateService(item)||services.length>=MAX_SERVICES){error.textContent="Enter a valid service (maximum 30).";return;}
   addItem(services,servicesList,item);error.textContent="";
  });
  document.getElementById("add-staff").addEventListener("click",()=>{
   const item={name:draft().staff};
   if(!validateStaff(item)||staff.length>=MAX_STAFF){error.textContent="Enter a valid staff name (maximum 25).";return;}
   addItem(staff,staffList,item);error.textContent="";
  });
  const panes=[...form.querySelectorAll(".pane")];
  const labels=[...document.querySelectorAll(".step")];
  const back=document.getElementById("back");
  const next=document.getElementById("next");
  const error=document.getElementById("error");
  const draft=()=>Object.fromEntries(new FormData(form).entries());
  function render(){
   panes.forEach((pane,i)=>{pane.hidden=i!==current;});
   labels.forEach((label,i)=>{if(i===current)label.setAttribute("aria-current","step");else label.removeAttribute("aria-current");});
   back.disabled=current===0;
   next.disabled=current===4;
   next.textContent=current===4?"Preview complete":"Next";
   error.textContent="";
   if(current===4)document.getElementById("review").textContent=reviewLines({...draft(),services,staff,week}).join("\n");
  }
  form.addEventListener("submit",e=>e.preventDefault());
  back.addEventListener("click",()=>{if(current>0){current--;render();}});
  next.addEventListener("click",()=>{
   if(current>=4)return;
   const d=draft();
   const valid=current===0?validateStep(0,d):current===1?validateCollection(services,validateService,MAX_SERVICES):current===2?validateWeek(week):current===3?validateCollection(staff,validateStaff,MAX_STAFF):false;
   if(!valid){error.textContent="Please complete this step with valid details.";return;}
   if(current===3&&!validateSetup({...d,services,staff,week})){error.textContent="Please check your business details.";return;}
   current++;render();
  });
  render();
 }
}
