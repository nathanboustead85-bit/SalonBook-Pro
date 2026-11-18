// Phase 20.10: opt-in browser connectivity adapter, not enabled on live pages.
// navigator.onLine is a signal, not proof of Firebase server connectivity.
export const LIVE_BROWSER_CONNECTIVITY_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export function createBrowserConnectivitySubscription({windowObject,navigatorObject}){
 if(!windowObject||typeof windowObject.addEventListener!=="function"||
 typeof windowObject.removeEventListener!=="function"||!navigatorObject)
 throw Error("Explicit browser event and navigator adapters required");
 return function subscribeConnectivity(notify){
  if(typeof notify!=="function")throw Error("Connectivity callback required");
  let closed=false,last=null;
  const publish=()=>{
   if(closed)return;
   const value=navigatorObject.onLine;
   // Unknown state fails closed. Never infer that an unverified connection is online.
   const online=value===true;
   if(last===online)return;
   last=online;notify(online);
  };
  windowObject.addEventListener("online",publish);
  windowObject.addEventListener("offline",publish);
  publish();
  return ()=>{
   if(closed)return;
   closed=true;
   windowObject.removeEventListener("online",publish);
   windowObject.removeEventListener("offline",publish);
  };
 };
}
export function createBrowserRecoveryIntegration({
 windowObject,navigatorObject,dashboard,getCurrentUser,subscribeDashboard,
 onStatus,createMonitor,maxAttempts=4,baseDelayMs=250,maxDelayMs=4000
}){
 if(typeof createMonitor!=="function"||typeof windowObject?.setTimeout!=="function"||
 typeof windowObject?.clearTimeout!=="function")
 throw Error("Explicit monitor and browser timer adapters required");
 const subscribeConnectivity=createBrowserConnectivitySubscription({windowObject,navigatorObject});
 return createMonitor({
  dashboard,getCurrentUser,subscribeConnectivity,subscribeDashboard,onStatus,
  schedule:(callback,delay)=>windowObject.setTimeout(callback,delay),
  cancel:id=>windowObject.clearTimeout(id),
  maxAttempts,baseDelayMs,maxDelayMs
 });
}
