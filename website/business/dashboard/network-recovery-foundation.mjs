// Phase 20.6 — opt-in, fail-closed network recovery coordinator.
// Injected connectivity events and dashboard controller: no browser globals,
// no production Firebase wiring, no persistence and no booking writes.
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const LIVE_NETWORK_RECOVERY_ENABLED=false;
export function createDashboardNetworkRecovery({dashboard,subscribeConnectivity,getCurrentUser,onStatus}){
 if(!dashboard||typeof dashboard.clear!=="function"||typeof dashboard.reconnect!=="function"||
    typeof subscribeConnectivity!=="function"||typeof getCurrentUser!=="function"||typeof dashboard.resume!=="function"||typeof onStatus!=="function")
  throw Error("Dashboard, connectivity subscription and status callback required");
 let online=null,closed=false,stop=null,epoch=0;
 const report=(status)=>onStatus(Object.freeze({status,online,epoch}));
 function handle(isOnline){
  if(closed||typeof isOnline!=="boolean")return;
  if(online===isOnline)return;
  online=isOnline;epoch++;
  // Immediately hide cached private data even if a queued listener delivers later.
  dashboard.clear();
  if(!isOnline){report("offline");return;}
  report("reconnecting");
  // Reconnect is deliberately opt-in and never performs writes.
  const accepted=dashboard.resume(getCurrentUser());
  report(accepted?"awaiting-fresh-snapshot":"awaiting-authentication");
 }
 return {
  start(){
   if(closed||stop)throw Error("Recovery coordinator already started or closed");
   stop=subscribeConnectivity(handle);
   if(typeof stop!=="function")throw Error("Connectivity subscription must return cleanup");
  },
  setConnectivity:handle,
  stop(){
   if(closed)return;
   closed=true;epoch++;
   if(stop){stop();stop=null;}
   dashboard.clear();report("stopped");
  },
  get online(){return online;},
  get epoch(){return epoch;}
 };
}
