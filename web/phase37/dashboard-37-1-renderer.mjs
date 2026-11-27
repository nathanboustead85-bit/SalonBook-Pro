// Phase 37.1 browser-only DOM renderer; textContent prevents markup injection.
const FLAGS=["canBook","canEdit","canMessage","canPay"];
export function safeView(state){
 const deny={view:"UNAVAILABLE",message:"Business dashboard unavailable. Please sign in again.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false};
 if(!state||!["READY","SIGNED_OUT","LOADING","RECOVERY","UNAVAILABLE"].includes(state.view)||FLAGS.some(k=>state[k]!==false))return deny;
 if(state.view==="READY"){
  if(!state.business||typeof state.business.name!=="string"||!Array.isArray(state.services)||!Array.isArray(state.staff))return deny;
  return {...deny,view:"READY",message:"Read-only business overview",business:{name:state.business.name},services:state.services.map(s=>({name:String(s?.name||"Unnamed service")})),staff:state.staff.map(s=>({name:String(s?.name||"Unnamed team member")}))};
 }
 return {...deny,view:state.view,message:typeof state.message==="string"?state.message:deny.message};
}
export function createDashboardRenderer(doc){
 const el=id=>{const e=doc.getElementById(id);if(!e)throw Error("missing_dashboard_element_"+id);return e};
 let session=null,unsubscribe=null;
 const retry=el("retry");
 const drawList=(id,items)=>{const root=el(id);root.replaceChildren();for(const item of items){const li=doc.createElement("li");li.textContent=item.name;root.appendChild(li)}};
 function render(raw){
  const s=safeView(raw),ready=s.view==="READY";
  el("business-name").textContent=ready?s.business.name:"Secure dashboard";
  el("status").textContent=s.message;
  el("private-content").hidden=!ready;
  el("service-count").textContent=String(ready?s.services.length:0);
  el("staff-count").textContent=String(ready?s.staff.length:0);
  drawList("services",ready?s.services:[]);
  drawList("staff",ready?s.staff:[]);
  retry.hidden=!session||!["RECOVERY","UNAVAILABLE"].includes(s.view);
  return s;
 }
 function sync(){return render(session?session.snapshot():null)}
 function connect(auditedSession){
  if(!auditedSession||typeof auditedSession.snapshot!=="function"||typeof auditedSession.start!=="function"||typeof auditedSession.retry!=="function")throw Error("audited_session_required");
  if(session)throw Error("session_already_connected");
  session=auditedSession;
  if(typeof session.subscribe==="function")unsubscribe=session.subscribe(render);
  session.start();return sync();
 }
 retry.addEventListener("click",async()=>{if(!session)return;retry.disabled=true;try{await session.retry()}catch{}finally{retry.disabled=false;sync()}});
 function disconnect(){if(unsubscribe){unsubscribe();unsubscribe=null}if(session&&typeof session.stop==="function")session.stop();session=null;return render(null)}
 return Object.freeze({render,connect,sync,disconnect});
}
