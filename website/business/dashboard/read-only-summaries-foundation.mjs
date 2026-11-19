// Phase 22.6: owner-scoped, read-only emulator dashboard summaries; never enables writes.
export const LIVE_DASHBOARD_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_DATA_PRESENTATION_ENABLED=false;
export function createDashboardReadOnlySummaries({firestore,firestoreSdk,root}){
 if(!firestore||typeof firestoreSdk?.doc!=="function"||typeof firestoreSdk?.onSnapshot!=="function"||!root)throw Error("Explicit Firestore SDK and root required");
 const ids=["service-summary","staff-summary","service-items","staff-items"];
 const els=Object.fromEntries(ids.map(id=>{const el=root.querySelector('[data-summary="'+id+'"]');if(!el)throw Error("Missing summary "+id);return [id,el];}));
 let uid=null,epoch=0,stops=[],closed=false;
 function clear(){epoch++;for(const stop of stops)stop();stops=[];uid=null;
  els["service-summary"].textContent="Sign in to view services";
  els["staff-summary"].textContent="Sign in to view staff";
  els["service-items"].replaceChildren();els["staff-items"].replaceChildren();
 }
 function parse(snapshot){
  if(snapshot.metadata?.fromCache===true)return {status:"unavailable",items:[]};
  if(!snapshot.exists())return {status:"empty",items:[]};
  const data=snapshot.data();
  if(data?.schemaVersion!==1||typeof data.json!=="string"||data.json.length>500000)return {status:"invalid",items:[]};
  try{
   const value=JSON.parse(data.json);
   const items=Array.isArray(value)?value:Array.isArray(value?.items)?value.items:null;
   if(!items||items.length>500||items.some(item=>!item||typeof item!=="object"||Array.isArray(item)))return {status:"invalid",items:[]};
   return {status:"ready",items};
  }catch{return {status:"invalid",items:[]};}
 }
 function render(type,result){
  const label=type==="services"?"service":"staff member",count=result.items.length;
  els[type==="services"?"service-summary":"staff-summary"].textContent=result.status==="ready"?count+" "+label+(count===1?"":"s"):result.status==="empty"?"No "+type+" found":type+" unavailable";
  const list=els[type==="services"?"service-items":"staff-items"];list.replaceChildren();
  if(result.status!=="ready")return;
  for(const item of result.items){
   const li=root.createElement?root.createElement("li"):root.ownerDocument.createElement("li");
   li.textContent=String(item.name??item.displayName??"Unnamed "+label).slice(0,180);
   list.append(li);
  }
 }
 function attach(ownerUid){
  if(closed)return false;
  clear();
  if(typeof ownerUid!=="string"||!ownerUid||ownerUid.includes("/"))return false;
  uid=ownerUid;const current=epoch;
  for(const type of ["services","staff"]){
   const ref=firestoreSdk.doc(firestore,"users",uid,"liveData",type);
   const stop=firestoreSdk.onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{
    if(closed||current!==epoch||uid!==ownerUid)return;
    render(type,parse(snapshot));
   },()=>{if(!closed&&current===epoch)render(type,{status:"unavailable",items:[]});});
   stops.push(stop);
  }
  return true;
 }
 clear();
 return Object.freeze({attach,clear,stop(){if(closed)return;clear();closed=true;}});
}
