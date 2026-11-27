const {createRecoveryController}=require("../sync/business-web-recovery-controller.cjs");
const {bindRecoveryUI}=require("../sync/business-web-recovery-ui.cjs");
if(location.hostname==="127.0.0.1"&&location.pathname==="/tests/fixtures/phase22_premium_dashboard.html"){
 let session=null,dispose=null,seq=0,observer=null;
 const key='boustio-isolated-pending';
 const pending=()=>{try{const raw=sessionStorage.getItem(key);if(raw===null)return null;const value=JSON.parse(raw);return value&&typeof value.uid==='string'&&typeof value.id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value.id)&&Object.keys(value).length===2?value:{invalid:true}}catch{return {invalid:true}}};
 const panel=document.createElement("section");panel.className="profile";panel.innerHTML='<h2>Isolated emulator booking test</h2><button id="move" disabled>Reschedule test booking</button><button id="cancel" disabled>Cancel test booking</button><button id="recover" disabled>Check status</button><p id="recovery-status" role="status">Signed out</p>';
 document.querySelector('[data-nav-panel="overview"]').append(panel);
 const move=panel.querySelector("#move"),cancel=panel.querySelector("#cancel"),recover=panel.querySelector("#recover"),status=panel.querySelector("#recovery-status");
 const request=async(path,token,body)=>{const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body)});if(!r.ok)throw Error("Unavailable");return r.json()};
 window.startIsolatedBookingTest=({uid,token,date})=>{
 if(dispose)dispose();observer?.disconnect();const saved=pending();if(saved&&(saved.invalid||saved.uid!==uid)){session=null;move.disabled=cancel.disabled=recover.disabled=true;status.textContent='Recovery blocked: original session required';return;}session={uid,businessId:uid,token,verified:true,epoch:++seq};const active=session;let revision=1,pendingAction="reschedule",lose=true;
 const restored=saved?.uid===uid&&/^[A-Za-z0-9_-]{1,128}$/.test(saved.id)?saved.id:null;if(restored)lose=false;
 const controller=createRecoveryController({pendingRequestId:restored,session:()=>session,transport:async(t,b)=>{const receipt=await request("/booking",t,b);if(session!==active)throw Error('Session changed');if(lose){lose=false;throw Error("Lost acknowledgement")}revision=receipt.revision;sessionStorage.removeItem(key);return receipt},lookup:async(t,b)=>{const receipt=await request("/receipt",t,b);if(session!==active)throw Error('Session changed');revision=receipt.revision;return receipt}});
 const proxy={state:()=>controller.state(),submit:async(d,id)=>{sessionStorage.setItem(key,JSON.stringify({uid,id}));return controller.submit(d,id)},reconcile:async()=>{const result=await controller.reconcile();if(result.state==="confirmed"&&session===active)sessionStorage.removeItem(key);return result}};
 const submit=document.createElement("button");
 dispose=bindRecoveryUI({controller:proxy,submitButton:submit,recoverButton:recover,status,readDraft:()=>({id:"browser-"+crypto.randomUUID(),draft:{appointmentId:"browser-booking",action:pendingAction,expectedRevision:revision,serviceId:"cut",staffId:"staff",date,startTime:"11:00"}})});
 const render=()=>{move.disabled=cancel.disabled=controller.state()!=="idle"||!session};
 const act=async action=>{if(!session||controller.state()!=="idle")return;pendingAction=action;const p=submit.click();render();await p};
 move.onclick=()=>act("reschedule");cancel.onclick=()=>act("cancel");observer=new MutationObserver(render);observer.observe(status,{childList:true,subtree:true,characterData:true});render();
 };
 window.stopIsolatedBookingTest=()=>{session=null;dispose?.();observer?.disconnect();sessionStorage.removeItem(key);move.disabled=cancel.disabled=recover.disabled=true;status.textContent="Signed out"};
}
