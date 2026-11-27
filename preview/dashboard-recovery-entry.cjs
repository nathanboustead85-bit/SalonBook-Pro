const {createRecoveryController}=require("../sync/business-web-recovery-controller.cjs");
const {bindRecoveryUI}=require("../sync/business-web-recovery-ui.cjs");
if(location.pathname==="/tests/fixtures/phase22_premium_dashboard.html"){
 document.querySelector("#status").textContent="signed-out (offline demo)";
 for(const button of document.querySelectorAll("[data-nav-target]"))button.addEventListener("click",()=>{
 for(const panel of document.querySelectorAll("[data-nav-panel]"))panel.hidden=panel.dataset.navPanel!==button.dataset.navTarget;
 for(const b of document.querySelectorAll("[data-nav-target]"))b.removeAttribute("aria-current");
 button.setAttribute("aria-current","page");
 });
 const panel=document.createElement("section");panel.className="profile";
 panel.innerHTML='<h2>Booking recovery demonstration</h2><p>Fictional booking only. No live connection or saved customer data.</p><button type="button" id="demo-submit">Simulate cancellation</button> <button type="button" id="demo-recover">Check status</button><p role="status" id="demo-status" aria-live="polite"></p>';
 document.querySelector('[data-nav-panel="overview"]').append(panel);
 const session=Object.freeze({uid:"demo-owner",businessId:"demo-owner",verified:true,token:"fictional",epoch:1});
 let receipt=null,sequence=0,revision=2;
 const controller=createRecoveryController({session:()=>session,transport:async(t,r)=>{receipt={receiptVersion:1,accepted:true,status:"accepted",actorId:session.uid,businessId:session.businessId,appointmentId:r.appointmentId,requestId:r.requestId,revision:++revision};throw Error("Simulated lost acknowledgement");},lookup:async(t,r)=>receipt?.requestId===r.requestId?receipt:null});
 bindRecoveryUI({controller,submitButton:document.querySelector("#demo-submit"),recoverButton:document.querySelector("#demo-recover"),status:document.querySelector("#demo-status"),readDraft:()=>({draft:{appointmentId:"demo-booking",action:"cancel",expectedRevision:revision},id:"demo-"+(++sequence)})});
}
