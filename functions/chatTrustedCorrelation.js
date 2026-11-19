"use strict";
// Phase 27.3: staging-only trusted correlation preparation.
// NEVER accept a signal, IP address, fingerprint or hash from a customer request.
const {createHmac}=require("node:crypto");
const {LIMITS,WINDOW_MS}=require("./chatAbuseBudget");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
function deriveTrustedCorrelation({businessId,attestedAppId,serverEvidence,secret}={}){
 if(typeof businessId!=="string"||!ID.test(businessId))throw Error("Invalid business");
 if(typeof attestedAppId!=="string"||attestedAppId.length<8||attestedAppId.length>256)throw Error("Missing verified App Check identity");
 if(typeof serverEvidence!=="string"||serverEvidence.length<12||serverEvidence.length>256)throw Error("Missing trusted server evidence");
 if(typeof secret!=="string"||secret.length<32)throw Error("Missing server-only secret");
 // Evidence MUST come from a reviewed trusted server integration, not request.data.
 // The attested app ID alone is shared by many users and is NOT a safe rate-limit key.
 return createHmac("sha256",secret).update(JSON.stringify([businessId,attestedAppId,serverEvidence])).digest("hex");
}
async function consumeCorrelatedBudgetWithinTransaction(tx,db,{businessId,correlation,now}={}){
 if(typeof businessId!=="string"||!ID.test(businessId)||typeof correlation!=="string"||!/^[a-f0-9]{64}$/.test(correlation)||!Number.isSafeInteger(now)||now<0)throw Error("Invalid correlated budget input");
 const window=Math.floor(now/WINDOW_MS);
 const bucket=db.collection("chatTrustedCorrelationBudgets").doc(createHmac("sha256","bucket").update(businessId+":"+window).digest("hex"));
 const ref=bucket.collection("signals").doc(correlation);
 const snap=await tx.get(ref);
 const count=snap.exists?snap.get("count"):0;
 if(!Number.isSafeInteger(count)||count<0)throw Error("Invalid budget state");
 if(count>=LIMITS.signal)return Object.freeze({allowed:false,reason:"correlated-limit"});
 tx.set(ref,{count:count+1,window,expiresAtMs:(window+2)*WINDOW_MS});
 return Object.freeze({allowed:true});
}
module.exports={deriveTrustedCorrelation,consumeCorrelatedBudgetWithinTransaction};
