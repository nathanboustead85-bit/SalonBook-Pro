"use strict";
// Isolated dashboard binding; injected controller, no production transport.
function bindRecoveryUI({controller,submitButton,recoverButton,status,readDraft}){
 let busy=false,disposed=false;
 function render(){
 if(disposed)return;
 const state=controller.state();
 submitButton.disabled=busy||state!=="idle";
 recoverButton.disabled=busy||state!=="unresolved";
 status.textContent=busy?"Checking booking status…":state==="unresolved"?"Booking status unresolved. Check status before submitting again.":"Ready";
 }
 async function act(recover){
 if(disposed||busy||(recover?recoverButton.disabled:submitButton.disabled))return;
 busy=true;render();
 try{if(recover)await controller.reconcile();else{const {draft,id}=readDraft();await controller.submit(draft,id);}}
 catch{/* Never expose raw transport errors or customer data. */}
 finally{busy=false;render();}
 }
 const submit=()=>act(false),recover=()=>act(true);
 submitButton.addEventListener("click",submit);recoverButton.addEventListener("click",recover);render();
 return ()=>{disposed=true;submitButton.removeEventListener("click",submit);recoverButton.removeEventListener("click",recover);};
}
module.exports={bindRecoveryUI};
