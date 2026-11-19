// Phase 23.1: preview-only customer booking experience. No network writes or reservations.
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const LIVE_DASHBOARD_ENABLED=false;
export const BOOKING_PAYMENTS_ENABLED=false;
const safe=(value,max=120)=>typeof value==="string"?value.slice(0,max):"";
export function createCustomerBookingPreview({root,fixture}){
 if(!root?.querySelector||!fixture||typeof fixture!=="object")throw Error("Preview root and synthetic fixture required");
 const title=root.querySelector("[data-booking-business]"),services=root.querySelector("[data-booking-services]"),
  slots=root.querySelector("[data-booking-slots]"),status=root.querySelector("[data-booking-status]"),
  summary=root.querySelector("[data-booking-summary]");
 if(!title||!services||!slots||!status||!summary)throw Error("Missing preview DOM");
 let selected=null;
 title.textContent=safe(fixture.name);
 const catalog=Array.isArray(fixture.services)?fixture.services.filter(item=>item&&typeof item.name==="string"&&Number.isInteger(item.duration)&&item.duration>0&&typeof item.price==="number"&&Number.isFinite(item.price)&&item.price>=0).slice(0,20):[];
 function render(){
  services.replaceChildren();
  for(const [index,item] of catalog.entries()){
   const button=root.createElement("button");button.type="button";button.className="service-choice";
   button.textContent=safe(item.name)+" · £"+item.price.toFixed(2)+" · "+item.duration+" min";
   button.setAttribute("aria-pressed",String(selected===index));
   button.addEventListener("click",()=>{selected=index;render();});
   services.append(button);
  }
  summary.textContent=selected===null?"Select a service to preview its details":safe(catalog[selected].name)+" · £"+catalog[selected].price.toFixed(2)+" · "+catalog[selected].duration+" min";
 }
 slots.textContent="Available dates and times will appear when secure booking is enabled.";
 status.textContent="Preview only — appointments cannot be booked.";
 render();
 return Object.freeze({get selectedService(){return selected===null?null:safe(catalog[selected].name);},get bookingsEnabled(){return false;},stop(){selected=null;services.replaceChildren();title.textContent="";summary.textContent="";}});
}
