"use strict";
// Opt-in read-only presentation projection; never renders HTML or touches the DOM.
const clean=s=>typeof s==="string"&&s.trim().length>0&&s.length<=150&&!/[<>\u0000-\u001f\u007f]/.test(s);
const unavailable=reason=>Object.freeze({state:"UNAVAILABLE",reason:String(reason||"unavailable").slice(0,80),business:null,services:Object.freeze([]),staff:Object.freeze([]),ariaBusy:false,liveMessage:"Business dashboard unavailable",canBook:false,canEdit:false,canPay:false,canMessage:false});
const loading=()=>Object.freeze({...unavailable("loading"),state:"LOADING",ariaBusy:true,liveMessage:"Loading business dashboard"});
function project(snapshot){
 if(!snapshot||snapshot.status!=="COMPATIBLE_READ_ONLY")return unavailable(snapshot?.reason);
 const b=snapshot.business,s=snapshot.services,t=snapshot.staff;
 if(!b||!clean(b.name)||!Array.isArray(s)||!Array.isArray(t)||s.length>500||t.length>500||snapshot.bookingEnabled!==false||snapshot.editingEnabled!==false||snapshot.canPay!==false||snapshot.canMessage!==false)return unavailable("invalid_dashboard_data");
 if(s.some(x=>!x||!clean(x.name)||!clean(x.id))||t.some(x=>!x||!clean(x.name)||!clean(x.id)))return unavailable("invalid_dashboard_data");
 return Object.freeze({state:"READY",reason:null,business:Object.freeze({name:b.name}),services:Object.freeze(s.map(x=>Object.freeze({id:x.id,name:x.name}))),staff:Object.freeze(t.map(x=>Object.freeze({id:x.id,name:x.name}))),ariaBusy:false,liveMessage:"Business dashboard loaded",canBook:false,canEdit:false,canPay:false,canMessage:false});
}
function createDashboardViewModel({session}){
 if(!session||typeof session.snapshot!=="function"||typeof session.subscribe!=="function"||typeof session.refresh!=="function")throw TypeError("read_only_session_required");
 let active=true,version=0,view=project(session.snapshot());const listeners=new Set();
 const emit=next=>{view=next;for(const fn of [...listeners]){try{fn(view)}catch{}}return view};
 const detach=session.subscribe(next=>{if(active&&next?.reason!=="auth_refreshing")emit(project(next))});
 async function refresh(){
  if(!active)return view;
  const seq=++version;emit(loading());
  try{const result=await session.refresh();if(active&&seq===version)return emit(project(result))}
  catch{if(active&&seq===version)return emit(unavailable("refresh_failed"))}
  return view;
 }
 function boundary(method,reason){version++;const next=emit(unavailable(reason));if(typeof session[method]==="function")session[method]();return next}
 return Object.freeze({
  snapshot:()=>view,refresh,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(view);return()=>listeners.delete(fn)},
  userChanged:user=>{version++;emit(unavailable("account_changed"));session.userChanged(user);return view},
  signOut:()=>boundary("signOut","signed_out"),
  networkUnavailable:()=>boundary("networkUnavailable","network_unavailable"),
  stop(){active=false;version++;detach();listeners.clear();if(typeof session.stop==="function")session.stop();view=unavailable("stopped");return view},
  canDeploy:false
 });
}
module.exports=Object.freeze({project,unavailable,loading,createDashboardViewModel});
