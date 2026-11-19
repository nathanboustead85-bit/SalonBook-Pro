// Phase 23.2: isolated synthetic design preview; never makes a booking or contacts a server.
export const REAL_BOOKINGS_ENABLED=false,REGISTRATION_ENABLED=false,PAYMENTS_ENABLED=false,LIVE_DASHBOARD_ENABLED=false;
const clean=(v,n=100)=>typeof v==="string"?v.slice(0,n):"";
export function mountPremiumBookingPreview(root,fixture){
 if(!root?.querySelector||!fixture)throw Error("Preview root and fixture required");
 const q=s=>root.querySelector(s), serviceBox=q("[data-services]"),staffBox=q("[data-staff]"),dayBox=q("[data-days]"),timeBox=q("[data-times]");
 const summary=q("[data-summary]"),notice=q("[data-preview-status]"),business=q("[data-business]");
 if([serviceBox,staffBox,dayBox,timeBox,summary,notice,business].some(x=>!x))throw Error("Incomplete preview");
 const services=fixture.services.slice(0,12).filter(x=>typeof x.name==="string"&&Number.isFinite(x.price)&&x.price>=0&&Number.isInteger(x.duration)&&x.duration>0);
 const staff=fixture.staff.slice(0,12).filter(x=>typeof x==="string");
 const days=fixture.days.slice(0,7).filter(x=>typeof x==="string");
 const times=fixture.times.slice(0,12).filter(x=>typeof x==="string");
 let selection={service:null,staff:null,day:null,time:null};
 business.textContent=clean(fixture.business);
 const groups=[["service",serviceBox,services,x=>clean(x.name)+" · £"+x.price.toFixed(2)+" · "+x.duration+" min"],["staff",staffBox,staff,x=>clean(x)],["day",dayBox,days,x=>clean(x)],["time",timeBox,times,x=>clean(x)]];
 function render(){
  for(const [key,box,items,label] of groups){
   box.replaceChildren();
   items.forEach((item,i)=>{
    const btn=root.createElement("button");btn.type="button";btn.className="choice choice-"+key;btn.textContent=label(item);
    btn.setAttribute("aria-pressed",String(selection[key]===i));
    btn.addEventListener("click",()=>{selection[key]=i;if(key==="service"){selection.time=null;}render();});
    box.append(btn);
   });
  }
  const picked=services[selection.service];
  const parts=[picked?clean(picked.name)+" · £"+picked.price.toFixed(2)+" · "+picked.duration+" min":"Choose a service",
   selection.staff===null?"Choose a professional":clean(staff[selection.staff]),
   selection.day===null?"Choose a date":clean(days[selection.day]),
   selection.time===null?"Choose a time":clean(times[selection.time])];
  summary.replaceChildren();
  for(const part of parts){const li=root.createElement("li");li.textContent=part;summary.append(li);}
  notice.textContent="Preview only — dates and times are examples, not live availability. No appointment can be booked.";
 }
 render();
 return Object.freeze({get selection(){return {...selection};},get bookingsEnabled(){return false;},stop(){selection={service:null,staff:null,day:null,time:null};for(const [,box] of groups)box.replaceChildren();summary.replaceChildren();business.textContent="";}});
}
