// Phase 20.8 — opt-in connection monitor with bounded retry/backoff.
// No production wiring, persistence, booking writes or implicit global timers.
export const LIVE_CONNECTION_MONITOR_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export function createDashboardConnectionMonitor({
 dashboard,getCurrentUser,subscribeConnectivity,subscribeDashboard,
 schedule,cancel,onStatus,maxAttempts=4,baseDelayMs=250,maxDelayMs=4000
}){
 if(!dashboard||typeof dashboard.clear!=="function"||typeof dashboard.resume!=="function"||
 ![getCurrentUser,subscribeConnectivity,subscribeDashboard,schedule,cancel,onStatus].every(f=>typeof f==="function"))
 throw Error("Explicit dashboard, subscriptions, clock and callbacks required");
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||baseDelayMs<1||maxDelayMs<baseDelayMs)
 throw Error("Invalid bounded retry configuration");
 let closed=false,started=false,online=null,epoch=0,attempt=0,pending=null,offNetwork=null,offDashboard=null,status="idle";
 const emit=s=>{status=s;onStatus(Object.freeze({status:s,online,attempt,epoch}));};
 const clearTimer=()=>{if(pending!==null){cancel(pending);pending=null;}};
 function retry(){
  if(closed||online!==true)return;
  const user=getCurrentUser();
  if(!user?.uid){clearTimer();dashboard.clear();emit("awaiting-authentication");return;}
  if(attempt>=maxAttempts){clearTimer();dashboard.clear();emit("retry-exhausted");return;}
  attempt++;const thisEpoch=epoch;
  // Always discard cached data before a new listener or token validation.
  dashboard.clear();emit("reconnecting");
  dashboard.resume(user);
  if(attempt<maxAttempts){
   const delay=Math.min(maxDelayMs,baseDelayMs*2**(attempt-1));
   pending=schedule(()=>{
    pending=null;
    if(closed||thisEpoch!==epoch||online!==true)return;
    retry();
   },delay);
  }else{
   // Wait for a fresh confirmed snapshot; otherwise fail closed.
   pending=schedule(()=>{
    pending=null;
    if(closed||thisEpoch!==epoch||online!==true)return;
    dashboard.clear();emit("retry-exhausted");
   },maxDelayMs);
  }
 }
 function network(value){
  if(closed||typeof value!=="boolean"||value===online)return;
  online=value;epoch++;attempt=0;clearTimer();dashboard.clear();
  if(!value){emit("offline");return;}
  retry();
 }
 function dashboardState(view){
  if(closed||online!==true||!view)return;
  if(view.status==="ready"||view.status==="empty"){
   clearTimer();attempt=0;emit("connected");
  }else if(view.status==="interrupted"||view.status==="invalid"){
   clearTimer();epoch++;attempt=0;dashboard.clear();
   retry();
  }else if(view.status==="unverified"){
   clearTimer();epoch++;dashboard.clear();emit("awaiting-authentication");
  }
 }
 return {
  start(){
   if(started||closed)throw Error("Monitor already started or closed");
   started=true;
   offNetwork=subscribeConnectivity(network);
   offDashboard=subscribeDashboard(dashboardState);
   if(typeof offNetwork!=="function"||typeof offDashboard!=="function")throw Error("Subscriptions require cleanup");
  },
  setConnectivity:network,
  observeDashboard:dashboardState,
  stop(){
   if(closed)return;
   closed=true;epoch++;clearTimer();
   offNetwork?.();offDashboard?.();dashboard.clear();emit("stopped");
  },
  get status(){return status;},get attempt(){return attempt;}
 };
}
