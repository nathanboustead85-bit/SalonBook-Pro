// Phase 20.12: isolated browser-session recovery harness; NOT wired to production.
// A persisted identity hint is never authentication. Each load must revalidate.
export const LIVE_SESSION_RECOVERY_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export function createSessionRecoveryCoordinator({
 dashboard,restoreAuthenticatedUser,subscribeAuth,subscribeConnectivity,onState
}){
 if(!dashboard||typeof dashboard.clear!=="function"||typeof dashboard.resume!=="function"||
 ![restoreAuthenticatedUser,subscribeAuth,subscribeConnectivity,onState].every(f=>typeof f==="function"))
 throw Error("Explicit recovery adapters required");
 let generation=0,closed=false,started=false,online=null,user=null,unsubAuth=null,unsubNetwork=null;
 const emit=(status)=>onState(Object.freeze({status,ownerUid:user?.uid??null}));
 const clear=()=>{generation++;dashboard.clear();};
 async function restore(){
  if(closed||online!==true)return;
  const epoch=++generation;
  dashboard.clear();emit("restoring");
  try{
   const restored=await restoreAuthenticatedUser();
   if(closed||epoch!==generation||online!==true)return;
   if(!restored?.uid||restored.emailVerified!==true){user=null;clear();emit("signed-out");return;}
   user=restored;dashboard.resume(restored);emit("awaiting-server");
  }catch{
   if(closed||epoch!==generation)return;
   user=null;clear();emit("signed-out");
  }
 }
 function auth(next){
  if(closed)return;
  clear();
  user=next?.uid&&next.emailVerified===true?next:null;
  if(!user){emit("signed-out");return;}
  if(online!==true){emit("offline");return;}
  dashboard.resume(user);emit("awaiting-server");
 }
 function network(next){
  if(closed||typeof next!=="boolean"||online===next)return;
  online=next;clear();
  if(!next){emit("offline");return;}
  // Revalidate auth on every reconnection, never trust a stored profile.
  void restore();
 }
 return {
  start(){
   if(started||closed)throw Error("Coordinator already started or stopped");
   started=true;
   unsubAuth=subscribeAuth(auth);
   unsubNetwork=subscribeConnectivity(network);
   if(typeof unsubAuth!=="function"||typeof unsubNetwork!=="function")throw Error("Cleanup required");
   if(online===null)void restore();
  },
  restore,
  stop(){
   if(closed)return;closed=true;clear();user=null;
   unsubAuth?.();unsubNetwork?.();emit("stopped");
  }
 };
}
