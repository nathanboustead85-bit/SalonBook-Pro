"use strict";
// Phase 26.14: prelaunch assessment only. This module never enables messaging.
const REQUIRED=["BOUSTIO_CHAT_ENABLED","BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED","BOUSTIO_CHAT_APP_CHECK_ENFORCED","BOUSTIO_CHAT_TRUSTED_ABUSE_SIGNAL","BOUSTIO_CHAT_OPERATIONAL_MONITORING"];
function assessChatLaunchReadiness(env={}){
 const blockers=[];
 for(const key of REQUIRED)if(env[key]!=="true")blockers.push(key);
 // Anonymous-account rotation cannot be stopped by UID limits alone.
 if(env.BOUSTIO_CHAT_TRUSTED_ABUSE_SIGNAL==="true"&&env.BOUSTIO_CHAT_APP_CHECK_ENFORCED!=="true")
   blockers.push("TRUSTED_SIGNAL_REQUIRES_APP_CHECK");
 return Object.freeze({ready:blockers.length===0,blockers:Object.freeze([...new Set(blockers)]),required:Object.freeze([...REQUIRED])});
}
module.exports={assessChatLaunchReadiness,REQUIRED};
