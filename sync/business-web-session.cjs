"use strict";
const {createSessionQueue}=require("./android-session.cjs");
function createWebSession(){
 const q=createSessionQueue();
 return {...q,start(s){if(!s||s.verified!==true||s.uid!==s.businessId)throw Error("Owner required");return q.start(s);}};
}
module.exports={createWebSession};
