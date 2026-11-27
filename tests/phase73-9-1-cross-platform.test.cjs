const {test,after}=require("node:test");const {spawn}=require("node:child_process");const a=require("node:assert/strict");const {initializeApp,deleteApp}=require("firebase-admin/app");const {getAuth}=require("firebase-admin/auth");const {getFirestore,FieldValue}=require("firebase-admin/firestore");const {listenBridge}=require("../backend/isolated-http-bridge.cjs");
const {createWebConnector}=require("../sync/business-web-connector.cjs");
const host=process.env.FIREBASE_AUTH_EMULATOR_HOST;if(!/^127\.0\.0\.1:\d+$/.test(host||"")||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||process.env.GCLOUD_PROJECT!=="demo-boustio")throw Error("Isolated emulators required");
const app=initializeApp({projectId:"demo-boustio"}),auth=getAuth(app),db=getFirestore(app);after(()=>deleteApp(app));
test("Native JVM booking is reconciled and updated by web connector on shared emulator",async()=>{const password="TestOnly123!",login=async email=>{const u=await auth.createUser({email,password,emailVerified:true});const r=await fetch("http://"+host+"/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,returnSecureToken:true})});a.ok(r.ok);return {uid:u.uid,header:"Bearer "+(await r.json()).idToken};};const owner=await login("cross-owner@example.test"),customer=await login("cross-customer@example.test"),b=owner.uid,date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(date+"T12:00:00Z").getUTCDay()],root=db.collection("businesses").doc(b);
await root.collection("catalogue").doc("current").set({schemaVersion:1,business:{ownerUid:b,published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[{id:"staff",name:"Staff",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"09:00",close:"17:00"}}}]});
const server=await listenBridge({db,auth,serverTimestamp:FieldValue.serverTimestamp});
try{
 await new Promise((resolve,reject)=>{
 const child=spawn("gradle",["--no-daemon",":app:testIsolatedDebugUnitTest","--rerun","--tests","*NativeBackendIntegrationTest"],{stdio:"inherit",env:{...process.env,BOUSTIO_TEST_PORT:String(server.address().port),BOUSTIO_TEST_UID:b,BOUSTIO_TEST_TOKEN:owner.header.slice(7),BOUSTIO_TEST_DATE:date,BOUSTIO_TEST_OTHER_TOKEN:customer.header.slice(7)}});
 child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(Error("Native integration failed")));
 });
 a.equal((await root.collection("appointments").get()).size,1);
 a.equal((await root.collection("bookingRequests").get()).size,1);
 const initial=(await root.collection("appointments").get()).docs[0];
 a.equal(initial.data().revision,1);
 const session={uid:b,businessId:b,verified:true,token:owner.header.slice(7),epoch:1};
 const connector=createWebConnector({session:()=>session,transport:async(token,body)=>{const r=await fetch("http://127.0.0.1:"+server.address().port+"/booking",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body)});if(!r.ok)throw Error("Rejected");return r.json();}});
 const move={action:"reschedule",businessId:b,actorId:b,appointmentId:initial.id,expectedRevision:1,serviceId:"cut",staffId:"staff",date,startTime:"13:00"};
 const receipt=await connector(move,"cross-web-move");a.equal(receipt.revision,2);
 a.deepEqual(await connector(move,"cross-web-move"),receipt);
 await a.rejects(connector({...move,startTime:"14:00"},"cross-stale"));
 const cancel=await connector({...move,action:"cancel",expectedRevision:2},"cross-web-cancel");a.equal(cancel.revision,3);
 const saved=await initial.ref.get();a.equal(saved.data().status,"cancelled");a.equal(saved.data().revision,3);
 a.equal((await root.collection("appointments").get()).size,1);
 a.equal((await root.collection("bookingRequests").get()).size,3);
 a.equal((await root.collection("bookingLocks").get()).size,0);
}finally{await new Promise(resolve=>server.close(resolve));}
});
