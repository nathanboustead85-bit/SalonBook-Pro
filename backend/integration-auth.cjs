"use strict";
// Internal boundary; verifier must be supplied by trusted server code.
async function authenticate(authorization,verifyIdToken){
 if(typeof authorization!=="string"||authorization.length>8192||typeof verifyIdToken!=="function")throw Error("Unauthenticated");
 const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);
 if(!match)throw Error("Unauthenticated");
 let decoded;try{decoded=await verifyIdToken(match[1],true);}catch{throw Error("Unauthenticated");}
 if(!decoded||typeof decoded.uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(decoded.uid)||decoded.email_verified!==true)throw Error("Unauthenticated");
 return Object.freeze({uid:decoded.uid,verified:true});
}
module.exports={authenticate};
