// Phase 22.3: secure, opt-in dashboard DOM renderer. No Firebase initialization or live wiring.
export const LIVE_DASHBOARD_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_INTERFACE_ENABLED=false;
const validStatuses=new Set(["signed-out","checking","connecting","unverified","ready","empty","invalid","interrupted"]);
export function createSecureBusinessDashboardInterface({root}){
 if(!root||typeof root.querySelector!=="function")throw Error("Explicit dashboard root required");
 const ids=["status","business-name","category","owner","booking","registration","private-panel"];
 const elements=Object.fromEntries(ids.map(id=>{
  const el=root.querySelector('[data-dashboard="'+id+'"]');
  if(!el)throw Error("Missing dashboard element: "+id);
  return [id,el];
 }));
 let closed=false,revision=0;
 function render(state){
  if(closed)return false;
  if(!state||!validStatuses.has(state.status))throw Error("Invalid dashboard state");
  const ready=state.status==="ready"&&state.profile&&
   typeof state.ownerUid==="string"&&state.ownerUid.length>0&&
   state.profile.businessId===state.ownerUid&&state.bookingsEnabled===false&&
   state.registrationEnabled===false;
  // Clear sensitive text and hide panel BEFORE applying any new state.
  elements["private-panel"].hidden=true;
  for(const key of ["business-name","category","owner"])elements[key].textContent="";
  elements.status.textContent=ready?"ready":state.status==="ready"?"invalid":state.status;
  elements.booking.textContent="Customer bookings disabled";
  elements.registration.textContent="Public registration disabled";
  if(ready){
   elements["business-name"].textContent=String(state.profile.name??"");
   elements.category.textContent=String(state.profile.category??"");
   elements.owner.textContent=state.ownerUid;
   elements["private-panel"].hidden=false;
  }
  revision++;
  return true;
 }
 render({status:"signed-out"});
 return Object.freeze({render,clear(){return render({status:"signed-out"});},
  stop(){if(closed)return;render({status:"signed-out"});closed=true;},
  get revision(){return revision;}});
}
