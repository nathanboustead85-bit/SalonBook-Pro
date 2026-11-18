// Phase 20.4: fail-closed dashboard session and reconnect controller.
// Requires explicit injection of SDK adapters; no production wiring or deployment.
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const LIVE_DASHBOARD_ENABLED=false;
export function createDashboardSessionController({onAuthStateChanged,onIdTokenChanged,onSnapshot,doc,getIdTokenResult,onView}){
 if(![onAuthStateChanged,onIdTokenChanged,onSnapshot,doc,getIdTokenResult,onView].every(f=>typeof f==="function"))
  throw Error("Explicit Firebase SDK adapters and view callback required");
 let generation=0,authStop=null,tokenStop=null,profileStop=null,closed=false;
 let current=null,view=Object.freeze({status:"signed-out",ownerUid:null,profile:null});
 const emit=(status,ownerUid=null,profile=null)=>{
  view=Object.freeze({status,ownerUid,profile});onView(view);
 };
 const clearProfile=()=>{generation++;if(profileStop){profileStop();profileStop=null;}current=null;emit("signed-out");};
 async function attach(user){
  clearProfile();
  if(closed||!user)return;
  const epoch=generation;
  const uid=user.uid;
  if(typeof uid!=="string"||!uid){emit("invalid");return;}
  emit("checking",uid);
  try{
   const token=await getIdTokenResult(user,true);
   if(closed||epoch!==generation)return;
   if(token?.claims?.email_verified!==true){emit("unverified");return;}
   current={uid,user,epoch};
   emit("connecting",uid);
   profileStop=onSnapshot(doc(uid),snapshot=>{
    if(closed||epoch!==generation||current?.uid!==uid)return;
    // Firestore may deliver cached data while offline; never present it as fresh.
    if(snapshot.metadata?.fromCache===true){emit("interrupted",uid);return;}
    const data=snapshot.exists()?snapshot.data():null;
    if(data&& (data.businessId!==uid||data.acceptingBookings!==false||data.published===true)){
     emit("invalid",uid);return;
    }
    emit(data?"ready":"empty",uid,data?Object.freeze({...data}):null);
   },()=>{
    if(closed||epoch!==generation)return;
    // Never display cached private data after a listener error.
    emit("interrupted",uid);
   });
  }catch{
   if(!closed&&epoch===generation)emit("invalid");
  }
 }
 function reconnect(){
  if(closed||!current)return false;
  const user=current.user;
  void attach(user);
  return true;
 }
 return {
  start(auth){
   if(closed||authStop||tokenStop)throw Error("Controller already started or closed");
   authStop=onAuthStateChanged(auth,user=>{void attach(user);});
   tokenStop=onIdTokenChanged(auth,user=>{
    // Revalidate when auth token refreshes or identity changes.
    if(!user){clearProfile();return;}
    if(current&&current.uid!==user.uid){void attach(user);}
   });
  },
  reconnect,
  resume(user){if(closed)return false;void attach(user??null);return Boolean(user);},
  clear:clearProfile,
  stop(){
   if(closed)return;
   closed=true;
   clearProfile();
   if(authStop){authStop();authStop=null;}
   if(tokenStop){tokenStop();tokenStop=null;}
  },
  get view(){return view;}
 };
}
