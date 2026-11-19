// Phase 22.8: owner-scoped, read-only emulator dashboard summaries; never enables writes.
export const LIVE_DASHBOARD_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_DATA_PRESENTATION_ENABLED=false;
export const DASHBOARD_MANAGEMENT_SCREENS_ENABLED=false;
export const DASHBOARD_SCHEDULE_EDITING_ENABLED=false;
export function createDashboardReadOnlySummaries({firestore,firestoreSdk,root}){
 if(!firestore||typeof firestoreSdk?.doc!=="function"||typeof firestoreSdk?.onSnapshot!=="function"||!root)throw Error("Explicit Firestore SDK and root required");
 const ids=["service-summary","staff-summary","service-items","staff-items","hours-summary","hours-items"];
 const els=Object.fromEntries(ids.map(id=>{const el=root.querySelector('[data-summary="'+id+'"]');if(!el)throw Error("Missing summary "+id);return [id,el];}));
 let uid=null,epoch=0,stops=[],closed=false;
 function clear(){epoch++;for(const stop of stops)stop();stops=[];uid=null;
  els["service-summary"].textContent="Sign in to view services";
  els["staff-summary"].textContent="Sign in to view staff";
  els["service-items"].replaceChildren();els["staff-items"].replaceChildren();
  els["hours-summary"].textContent="Sign in to view staff availability";els["hours-items"].replaceChildren();
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
  if(type==="staff")renderAvailability(result);
  if(result.status!=="ready")return;
  for(const item of result.items){
   const li=root.createElement?root.createElement("li"):root.ownerDocument.createElement("li");
   const name=String(item.name??item.displayName??"Unnamed "+label).slice(0,180);
   li.append(root.createTextNode?root.createTextNode(name):root.ownerDocument.createTextNode(name));
   if(type==="services"){
    const price=typeof item.price==="number"&&Number.isFinite(item.price)&&item.price>=0&&item.price<=100000?item.price:null;
    const duration=Number.isInteger(item.duration)&&item.duration>0&&item.duration<=1440?item.duration:null;
    if(price!==null||duration!==null){
     const meta=root.createElement?root.createElement("small"):root.ownerDocument.createElement("small");
     meta.className="management-meta";
     meta.textContent=[price===null?null:"£"+price.toFixed(2),duration===null?null:duration+" min"].filter(Boolean).join(" · ");
     li.append(meta);
    }
   }else{
    const role=typeof item.role==="string"?item.role.trim().slice(0,100):"";
    if(role){
     const meta=root.createElement?root.createElement("small"):root.ownerDocument.createElement("small");
     meta.className="management-meta";meta.textContent=role;li.append(meta);
    }
   }
   list.append(li);
  }
 }
 const weekdays=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
 function validTime(v){return typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);}
 function renderAvailability(result){
  const list=els["hours-items"];list.replaceChildren();
  els["hours-summary"].textContent=result.status==="ready"?"Staff availability preview":result.status==="empty"?"No staff availability found":"Staff availability unavailable";
  if(result.status!=="ready")return;
  for(const item of result.items){
   const name=String(item.name??item.displayName??"Unnamed staff member").slice(0,180);
   const schedule=item.workingHours;
   if(!schedule||typeof schedule!=="object"||Array.isArray(schedule))continue;
   for(const day of weekdays){
    const value=schedule[day]??schedule[day.toLowerCase()];
    if(value===undefined)continue;
    let display=null;
    if(value===null||value===false||value?.closed===true)display="Closed";
    else if(value&&typeof value==="object"&&validTime(value.start)&&validTime(value.end)&&value.start<value.end)display=value.start+"–"+value.end;
    if(display===null)continue;
    const li=root.createElement?root.createElement("li"):root.ownerDocument.createElement("li");
    li.textContent=name+" · "+day+" · "+display;list.append(li);
   }
  }
  if(!list.children.length)els["hours-summary"].textContent="No compatible staff schedules available";
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
