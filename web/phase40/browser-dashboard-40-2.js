"use strict";
// Opt-in isolated browser adapter. No Firebase initialization, routes or writes.
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioIsolatedDashboard40_2=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
 function mountIsolatedDashboard({element,auth,onAuthStateChanged,viewModel}){
  if(!element||typeof element.replaceChildren!=="function"||!auth||typeof onAuthStateChanged!=="function"||!viewModel||typeof viewModel.subscribe!=="function")throw TypeError("isolated_browser_dependencies_required");
  let active=true,epoch=0,identity=null;
  const doc=element.ownerDocument;
  function render(view){
   if(!active)return;
   const wrapper=doc.createElement("section");wrapper.setAttribute("aria-label","Business dashboard");
   wrapper.setAttribute("aria-busy",view?.state==="LOADING"?"true":"false");
   const status=doc.createElement("p");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
   status.textContent=view?.state==="READY"?"Business dashboard loaded":view?.state==="LOADING"?"Loading business dashboard":"Business dashboard unavailable";
   wrapper.append(status);
   if(view?.state==="READY"&&view.business&&typeof view.business.name==="string"){
    const title=doc.createElement("h2");title.textContent=view.business.name;wrapper.append(title);
    for(const [heading,items] of [["Services",view.services],["Staff",view.staff]]){
     const h=doc.createElement("h3");h.textContent=heading;wrapper.append(h);
     const ul=doc.createElement("ul");
     for(const item of Array.isArray(items)?items:[]){const li=doc.createElement("li");li.textContent=String(item.name||"");ul.append(li)}
     wrapper.append(ul);
    }
   }
   element.replaceChildren(wrapper);
  }
  const empty=()=>render({state:"UNAVAILABLE"});
  empty();
  const unsubscribe=viewModel.subscribe(view=>render(view));
  const detach=onAuthStateChanged(auth,user=>{
   if(!active)return;
   const seq=++epoch;identity=user?.uid||null;
   // Clear synchronously before any asynchronous credential or data read.
   empty();
   if(!user){viewModel.signOut();return}
   viewModel.userChanged(user);
   Promise.resolve().then(()=>{if(active&&seq===epoch&&auth.currentUser===user)return viewModel.refresh()}).catch(()=>{if(active&&seq===epoch)empty()});
  },()=>{if(active){epoch++;identity=null;viewModel.signOut();empty()}});
  return Object.freeze({
   snapshot:()=>({mounted:active,identity:active?identity:null}),
   unmount(){if(!active)return;active=false;epoch++;identity=null;try{if(typeof detach==="function")detach()}finally{try{unsubscribe()}finally{viewModel.stop();element.replaceChildren()}}},
   canBook:false,canPay:false,canMessage:false,canDeploy:false
  });
 }
 return Object.freeze({mountIsolatedDashboard});
});
