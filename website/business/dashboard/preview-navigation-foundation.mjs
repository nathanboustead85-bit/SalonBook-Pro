// Phase 22.5 isolated dashboard navigation. No Firebase writes, public routes or activation.
export const LIVE_DASHBOARD_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const DASHBOARD_NAVIGATION_ENABLED=false;
const sections=["overview","services","staff","settings"];
export function createDashboardPreviewNavigation({root}){
 if(!root||typeof root.querySelectorAll!=="function")throw Error("Explicit dashboard root required");
 const buttons=[...root.querySelectorAll("[data-nav-target]")],panels=[...root.querySelectorAll("[data-nav-panel]")];
 if(buttons.length!==4||panels.length!==4||sections.some(id=>buttons.filter(b=>b.dataset.navTarget===id).length!==1||panels.filter(p=>p.dataset.navPanel===id).length!==1))throw Error("Four unique preview sections required");
 let closed=false,active="overview";
 const update=id=>{
  if(closed||!sections.includes(id))return false;
  active=id;
  for(const b of buttons){
   const selected=b.dataset.navTarget===id;
   if(selected)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  }
  for(const p of panels)p.hidden=p.dataset.navPanel!==id;
  return true;
 };
 const handlers=buttons.map(b=>{
  const fn=()=>update(b.dataset.navTarget);
  b.addEventListener("click",fn);
  return fn;
 });
 update("overview");
 return Object.freeze({
  navigate:update,
  reset:()=>update("overview"),
  stop(){if(closed)return;update("overview");closed=true;buttons.forEach((b,i)=>b.removeEventListener("click",handlers[i]));},
  get active(){return active;}
 });
}
