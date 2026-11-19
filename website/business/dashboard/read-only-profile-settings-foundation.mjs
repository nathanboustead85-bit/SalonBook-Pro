// Phase 22.9: isolated read-only owner profile/settings renderer; no production wiring.
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const LIVE_DASHBOARD_ENABLED=false;
export const PROFILE_SETTINGS_EDITING_ENABLED=false;
export function createReadOnlyBusinessSettings({firestore,firestoreSdk,root}){
 if(!firestore||typeof firestoreSdk?.doc!=="function"||typeof firestoreSdk?.onSnapshot!=="function"||!root?.querySelector)throw Error("Explicit Firestore SDK and DOM required");
 const keys=["status","name","category","email","phone","address","description","booking-mode","publishing"];
 const els=Object.fromEntries(keys.map(key=>{const el=root.querySelector('[data-profile="'+key+'"]');if(!el)throw Error("Missing profile field "+key);return [key,el];}));
 let stopListener=null,owner=null,epoch=0,closed=false;
 function clear(){
  epoch++;if(stopListener){stopListener();stopListener=null;}owner=null;
  for(const key of keys)els[key].textContent="";
  els.status.textContent="Sign in to view business profile";
 }
 function attach(uid){
  if(closed)return false;
  clear();
  if(typeof uid!=="string"||!uid||uid.includes("/"))return false;
  owner=uid;const current=epoch;
  stopListener=firestoreSdk.onSnapshot(firestoreSdk.doc(firestore,"users",uid,"business","profile"),{includeMetadataChanges:true},snapshot=>{
   if(closed||current!==epoch||owner!==uid)return;
   for(const key of keys)els[key].textContent="";
   if(snapshot.metadata?.fromCache===true||!snapshot.exists()){els.status.textContent="Profile unavailable";return;}
   const data=snapshot.data();
   if(data?.businessId!==uid||data?.acceptingBookings!==false||data?.published===true){els.status.textContent="Profile unavailable";return;}
   els.status.textContent="Verified business profile · Read-only";
   for(const key of ["name","category","email","phone","address","description"]){
    const value=data[key];els[key].textContent=typeof value==="string"?value.slice(0,500):"Not provided";
   }
   els["booking-mode"].textContent="Customer bookings disabled";
   els.publishing.textContent="Publishing disabled";
  },()=>{
   if(closed||current!==epoch)return;
   for(const key of keys)els[key].textContent="";
   els.status.textContent="Profile unavailable";
  });
  return true;
 }
 clear();
 return Object.freeze({attach,clear,stop(){if(closed)return;clear();closed=true;}});
}
