const {test,after}=require("node:test");const a=require("node:assert/strict");const {initializeApp,deleteApp}=require("firebase-admin/app");const {getAuth}=require("firebase-admin/auth");const {getFirestore,FieldValue}=require("firebase-admin/firestore");const {listenBridge}=require("../backend/isolated-http-bridge.cjs");
const host=process.env.FIREBASE_AUTH_EMULATOR_HOST;if(!/^127\.0\.0\.1:\d+$/.test(host||"")||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||process.env.GCLOUD_PROJECT!=="demo-boustio")throw Error("Isolated emulators required");
const app=initializeApp({projectId:"demo-boustio"}),auth=getAuth(app),db=getFirestore(app);after(()=>deleteApp(app));
test("HTTP bridge verifies real emulator tokens and exact retry",async()=>{const password="TestOnly123!",login=async email=>{const u=await auth.createUser({email,password,emailVerified:true});const r=await fetch("http://"+host+"/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,returnSecureToken:true})});a.ok(r.ok);return {uid:u.uid,header:"Bearer "+(await r.json()).idToken};};const owner=await login("bridge-owner@example.test"),customer=await login("bridge-customer@example.test"),b=owner.uid,date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(date+"T12:00:00Z").getUTCDay()],root=db.collection("businesses").doc(b);
await root.collection("catalogue").doc("current").set({schemaVersion:1,business:{ownerUid:b,published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[{id:"staff",name:"Staff",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"09:00",close:"17:00"}}}]});
const server=await listenBridge({db,auth,serverTimestamp:FieldValue.serverTimestamp});
try{
 const url="http://127.0.0.1:"+server.address().port+"/booking";
 const send=(header,body)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:header},body:JSON.stringify(body)});
 const draft={action:"create",businessId:b,actorId:b,appointmentId:"bridge-booking",requestId:"bridge-create",expectedRevision:0,serviceId:"cut",staffId:"staff",date,startTime:"09:00"};
 a.equal((await send("Bearer invalid",draft)).status,401);
 const first=await send(owner.header,draft);a.equal(first.status,200);const receipt=await first.json();a.equal(receipt.actorId,b);a.equal(receipt.revision,1);
 const retry=await send(owner.header,draft);a.equal(retry.status,200);a.deepEqual(await retry.json(),receipt);
 a.equal((await send(customer.header,{...draft,action:"cancel",expectedRevision:1,requestId:"cancel"})).status,400);
 a.equal((await root.collection("appointments").get()).size,1);a.equal((await root.collection("bookingRequests").get()).size,1);
}finally{await new Promise(resolve=>server.close(resolve));}
});
