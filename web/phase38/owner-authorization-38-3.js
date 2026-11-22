"use strict";
// Read-only, fail-closed authorization boundary for synthetic dashboard reads.
const {paths}=require("../phase34/android-firestore-map-34-2");
const {validateBusinessCompatibility,deny}=require("./schema-compatibility-38-2");
const valid=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
function createOwnerAuthorizationGate({readAtomic,now=Date.now}){
 if(typeof readAtomic!=="function"||typeof now!=="function")throw TypeError("read_only_dependencies_required");
 let epoch=0,owner=null,state=deny("signed_out");
 function clear(reason="signed_out"){epoch++;owner=null;state=deny(reason);return state}
 async function load({user,token}={}){
  const sequence=++epoch;state=deny("auth_refreshing");owner=null;
  const time=now(),uid=user?.uid;
  if(!valid(uid)||user.emailVerified!==true||!token?.claims||token.claims.user_id!==uid||
     token.claims.email_verified!==true||!Number.isFinite(Date.parse(token.expirationTime))||
     Date.parse(token.expirationTime)<=time)return clear("unauthorized_or_expired");
  owner=uid;
  let result;
  try{result=await readAtomic(paths(uid),uid)}
  catch{if(sequence!==epoch)return state;return clear("atomic_read_failed")}
  if(sequence!==epoch||owner!==uid)return state;
  if(result?.atomic!==true||!result.documents)return clear("atomicity_not_proven");
  const next=validateBusinessCompatibility({uid,emailVerified:true,expiresAt:Date.parse(token.expirationTime)},result.documents,time);
  if(sequence!==epoch||owner!==uid)return state;
  state=next;return state;
 }
 return Object.freeze({load,snapshot:()=>state,signOut:()=>clear(),networkUnavailable:()=>clear("network_unavailable"),accountChanged:()=>clear("account_changed"),stop:()=>clear("stopped")});
}
module.exports=Object.freeze({createOwnerAuthorizationGate});
