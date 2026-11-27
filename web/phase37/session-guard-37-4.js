"use strict";
// Isolated browser guard. Clears private UI synchronously on session boundaries.
// No writes, production SDK initialization or deployment.
const {auditView}=require("../phase36/final-integration-audit-36-5");
const {project}=require("../phase36/secure-dashboard-session-36-4");
const deny=reason=>project({status:"UNAVAILABLE",reason});
function createSessionGuard({session,auth,now=Date.now}){
 if(!session||!auth||typeof session.snapshot!=="function"||typeof session.subscribe!=="function")throw TypeError("audited_session_required");
 let generation=0,active=true,blocked=false,identity=null,view=deny("not_started");
 const listeners=new Set();
 function emit(next){view=auditView(next).passed?next:deny("audit_rejected");for(const fn of [...listeners]){try{fn(view)}catch{}}return view}
 function clear(reason){generation++;blocked=true;return emit(deny(reason))}
 function userChanged(user){const uid=user?.uid||null;if(uid!==identity){identity=uid;clear(user?"auth_refreshing":"signed_out")}return view}
 function accept(next){
  if(!active||blocked)return view;
  if(next?.view==="READY"&&(!identity||auth.currentUser?.uid!==identity))return clear("invalid_session");
  return emit(next);
 }
 const stop=session.subscribe(accept);
 return Object.freeze({
  snapshot:()=>view,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(view);return()=>listeners.delete(fn)},
  start(){session.start();return view},
  userChanged,
  async retry(){if(!active)return view;const token=++generation;blocked=true;emit(deny("auth_refreshing"));try{await session.retry()}catch{return clear("auth_refresh_failed")}if(token!==generation||!active)return view;blocked=false;return accept(session.snapshot())},
  async networkRestored(){if(!active)return view;const token=++generation;blocked=true;emit(deny("network_unavailable"));try{await session.networkRestored()}catch{return clear("network_unavailable")}if(token!==generation||!active)return view;blocked=false;return this.revalidate()},
  networkUnavailable(){clear("network_unavailable");session.networkUnavailable();return view},
  signOut(){clear("signed_out");session.networkUnavailable();return view},
  async completeSignOut(){if(!active)return view;identity=null;session.networkUnavailable();return emit(deny("signed_out"))},
  async revalidate(){if(!active)return view;const token=++generation;blocked=true;emit(deny("auth_refreshing"));try{const user=auth.currentUser;if(!user||user.uid!==identity)return clear("signed_out");const result=await user.getIdTokenResult(true);if(token!==generation||!active)return view;if(!result?.claims||result.claims.user_id!==identity||result.claims.email_verified!==true||user.emailVerified!==true||Date.parse(result.expirationTime)<=now())return clear("unverified_or_expired");await session.retry();if(token!==generation||!active||auth.currentUser!==user)return view;blocked=false;return accept(session.snapshot())}catch{return clear("token_refresh_failed")}},
  stop(){active=false;clear("stopped");stop();session.stop();listeners.clear();return view}
 });
}
module.exports={createSessionGuard};
