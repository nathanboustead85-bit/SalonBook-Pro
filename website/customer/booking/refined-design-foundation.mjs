// Phase 23.4: isolated premium design demonstration; all data is synthetic.
export const BOOKINGS_ENABLED=false,REGISTRATION_ENABLED=false,PAYMENTS_ENABLED=false,LIVE_DASHBOARD_ENABLED=false;
const clean=(v,n=90)=>typeof v==="string"?v.slice(0,n):"";
export function mountAdvancedBookingPreview(root,fixture){
 if(!root?.querySelector||!fixture)throw Error("Preview fixture required");
 const q=s=>root.querySelector(s),boxes={service:q("[data-services]"),staff:q("[data-staff]"),day:q("[data-days]"),time:q("[data-times]")};
 const summary=q("[data-summary]"),notice=q("[data-preview-status]"),business=q("[data-business]"),month=q("[data-month]"),previous=q("[data-month-prev]"),next=q("[data-month-next]");
 if(Object.values(boxes).some(x=>!x)||[summary,notice,business,month,previous,next].some(x=>!x))throw Error("Incomplete advanced preview DOM");
 const services=fixture.services.slice(0,12).filter(x=>typeof x.name==="string"&&Number.isFinite(x.price)&&x.price>=0&&Number.isInteger(x.duration)&&x.duration>0);
 const staff=fixture.staff.slice(0,12).filter(x=>x&&typeof x.name==="string"&&typeof x.role==="string");
 const days=fixture.days.slice(0,14).filter(x=>x&&typeof x.label==="string"&&Number.isInteger(x.month)&&x.month>=0&&x.month<=1);
 const times=fixture.times.slice(0,16).filter(x=>typeof x==="string");
 let selected={service:null,staff:null,day:null,time:null},activeMonth=0;
 business.textContent=clean(fixture.business);
 function addButton(box,label,key,index,extraClass="",description=""){
  const button=root.createElement("button");button.type="button";button.className="choice choice-"+key+" "+extraClass;
  button.textContent=label;if(description){const detail=root.createElement("small");detail.className="choice-detail";detail.textContent=clean(description,180);button.append(detail);}button.setAttribute("aria-pressed",String(selected[key]===index));
  button.addEventListener("click",()=>{selected[key]=index;if(key==="service"||key==="staff"||key==="day")selected.time=null;render();});
  box.append(button);
 }
 function render(){
  boxes.service.replaceChildren();services.forEach((x,i)=>addButton(boxes.service,clean(x.name)+" · £"+x.price.toFixed(2)+" · "+x.duration+" min","service",i,"service-card",x.description));
  boxes.staff.replaceChildren();staff.forEach((x,i)=>addButton(boxes.staff,clean(x.name)+" · "+clean(x.role),"staff",i,"staff-card",x.bio));
  boxes.day.replaceChildren();days.forEach((x,i)=>{if(x.month===activeMonth)addButton(boxes.day,clean(x.label),"day",i,"date-card");});
  boxes.time.replaceChildren();times.forEach((x,i)=>addButton(boxes.time,clean(x),"time",i,"time-card"));
  month.textContent=activeMonth===0?"November 2026 · Example dates":"December 2026 · Example dates";
  previous.disabled=activeMonth===0;next.disabled=activeMonth===1;
  const svc=services[selected.service],person=staff[selected.staff],day=days[selected.day],time=times[selected.time];
  const lines=[svc?clean(svc.name)+" · £"+svc.price.toFixed(2)+" · "+svc.duration+" min":"Choose a service",person?clean(person.name)+" · "+clean(person.role):"Choose a professional",day?clean(day.label):"Choose a date",time?clean(time):"Choose a time"];
  summary.replaceChildren();for(const line of lines){const li=root.createElement("li");li.textContent=line;summary.append(li);}
  notice.textContent="Preview only — example dates and times are not live availability. No appointment can be booked.";
 }
 function changeMonth(delta){const target=activeMonth+delta;if(target<0||target>1)return;activeMonth=target;selected.day=null;selected.time=null;render();}
 previous.addEventListener("click",()=>changeMonth(-1));next.addEventListener("click",()=>changeMonth(1));
 render();
 return Object.freeze({get selection(){return {...selected};},get activeMonth(){return activeMonth;},get bookingsEnabled(){return false;},stop(){selected={service:null,staff:null,day:null,time:null};Object.values(boxes).forEach(x=>x.replaceChildren());summary.replaceChildren();business.textContent="";}});
}
