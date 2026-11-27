const {test,after}=require("node:test");const a=require("node:assert/strict");const {initializeApp,deleteApp}=require("firebase-admin/app");const {getFirestore,FieldValue}=require("firebase-admin/firestore");const {createStore}=require("../backend/firestore-booking-store.cjs");const {executeBooking}=require("../backend/booking-transaction.cjs");
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))throw Error("Local emulator required");
const app=initializeApp({projectId:"demo-boustio"});const db=getFirestore(app);const store=createStore(db,()=>FieldValue.serverTimestamp());after(async()=>{await db.terminate();await deleteApp(app);});
const args=(b,key,id,actor="owner")=>({store,businessId:b,actorId:actor,key,fingerprint:"a".repeat(64),prepare:async()=>({authorized:true,available:true,revisionValid:true,appointmentId:id,oldLocks:[],newLocks:["staff_2027-01-01_0900"],record:{id,status:"confirmed"}})});
test("real emulator competing bookings and atomic receipt", {timeout:120000},async()=>{const b="race_"+Date.now();const results=await Promise.allSettled([executeBooking(args(b,"one","a")),executeBooking(args(b,"two","b","customer"))]);a.equal(results.filter(x=>x.status==="fulfilled").length,1);const root=db.collection("businesses").doc(b);for(const c of ["appointments","bookingLocks","bookingRequests"])a.equal((await root.collection(c).get()).size,1);});
test("real emulator duplicate retries and tenant isolation",{timeout:120000},async()=>{const b="replay_"+Date.now(),x=args(b,"one","a");a.deepEqual(await executeBooking(x),await executeBooking(x));await a.rejects(executeBooking({...x,fingerprint:"b".repeat(64)}));const root=db.collection("businesses").doc(b);a.equal((await root.collection("appointments").get()).size,1);await executeBooking(args(b+"_other","one","a"));a.equal((await db.collection("businesses").doc(b+"_other").collection("appointments").get()).size,1);});

test("reschedule and cancel preserve atomic occupancy and reject stale edits",{timeout:120000},async()=>{
 const b="edit_"+Date.now();await executeBooking(args(b,"initial","a"));
 const root=db.collection("businesses").doc(b);
 const old="staff_2027-01-01_0900",next="staff_2027-01-01_0930";
 const edit=(key,expected,newLocks,status)=>({...args(b,key,"a"),prepare:async tx=>{
 const current=await tx.readAppointment(b,"a");
 return {authorized:true,available:true,revisionValid:(current.revision||0)===expected,appointmentId:"a",oldLocks:current.status==="cancelled"?[]:current.locks||[old],newLocks,record:{id:"a",status,revision:expected+1,locks:newLocks}};
 }});
 await executeBooking({...args(b,"block","block"),prepare:async()=>({authorized:true,available:true,revisionValid:true,appointmentId:"block",oldLocks:[],newLocks:["blocked"],record:{status:"confirmed"}})});
 await a.rejects(executeBooking(edit("failed",0,["blocked"],"confirmed")),/Occupied/);
 a.equal((await root.collection("bookingLocks").doc(old).get()).data().appointmentId,"a");
 await executeBooking(edit("move",0,[next],"confirmed"));
 a.equal((await root.collection("bookingLocks").doc(old).get()).exists,false);
 a.equal((await root.collection("bookingLocks").doc(next).get()).data().appointmentId,"a");
 await a.rejects(executeBooking(edit("stale",0,[],"cancelled")),/stale/);
 await executeBooking(edit("cancel",1,[],"cancelled"));
 a.equal((await root.collection("bookingLocks").doc(next).get()).exists,false);
 a.equal((await root.collection("appointments").doc("a").get()).data().status,"cancelled");
 a.equal((await root.collection("bookingLocks").doc("blocked").get()).data().appointmentId,"block");
});

const {prepareCancellation}=require("../backend/trusted-owner-command.cjs");
test("trusted cancellation releases only authoritative locks in real emulator",{timeout:120000},async()=>{
 const b="trusted_"+Date.now(),slot="staff_2027-01-01_0900";
 await executeBooking({...args(b,"seed","a",b),prepare:async()=>({authorized:true,available:true,revisionValid:true,appointmentId:"a",oldLocks:[],newLocks:[slot],record:{id:"a",businessId:b,status:"confirmed",revision:1,historical:false,staffId:"staff",date:"2027-01-01",startMinute:540,endMinute:555}})});
 const command={action:"cancel",appointmentId:"a",expectedRevision:1,oldLocks:["spoof"]};
 const input={...args(b,"cancel","a",b),prepare:prepareCancellation({verified:true,uid:b},command)};
 const root=db.collection("businesses").doc(b);
 await a.rejects(executeBooking({...input,prepare:prepareCancellation({verified:true,uid:"other"},command)}));
 a.equal((await root.collection("bookingLocks").doc(slot).get()).exists,true);
 await executeBooking(input);
 a.deepEqual(await executeBooking(input),{appointmentId:"a",accepted:true});
 a.equal((await root.collection("bookingLocks").doc(slot).get()).exists,false);
 const record=(await root.collection("appointments").doc("a").get()).data();
 a.equal(record.status,"cancelled");a.equal(record.revision,2);
});

const {prepareCreation}=require("../backend/trusted-owner-create.cjs");
test("trusted catalogue creation ignores spoofed price and rejects breaks",{timeout:120000},async()=>{
 const b="create_"+Date.now(),date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 const day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(date+"T12:00:00Z").getUTCDay()];
 const root=db.collection("businesses").doc(b);
 await root.collection("catalogue").doc("current").set({schemaVersion:1,business:{ownerUid:b,published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[{id:"staff",name:"Staff",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"09:00",close:"17:00"}},weeklyBreaks:[{day,start:"12:00",end:"13:00"}]}]});
 const cmd={action:"create",appointmentId:"a",serviceId:"cut",staffId:"staff",date,startTime:"09:00",price:1};
 const run=(c,key)=>executeBooking({...args(b,key,c.appointmentId,b),prepare:prepareCreation({verified:true,uid:b},c)});
 await run(cmd,"create");a.deepEqual(await run(cmd,"create"),{appointmentId:"a",accepted:true});const record=(await root.collection("appointments").doc("a").get()).data();a.equal(record.price,20);a.equal(record.durationMinutes,30);
 await a.rejects(run({...cmd,appointmentId:"b",startTime:"12:00"},"break"),/break/);
 a.equal((await root.collection("appointments").get()).size,1);
});

test("holiday and closing boundaries deny creation",async()=>{
 const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10),day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(date+"T12:00:00Z").getUTCDay()];
 const b="owner",catalogue={schemaVersion:1,business:{ownerUid:b,published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[{id:"staff",name:"Staff",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"09:00",close:"17:00"}},timeOff:[{date,start:"10:00",end:"11:00"}]}]};
 const tx={readAppointment:async()=>null,readCatalogue:async()=>catalogue};
 for(const startTime of ["10:00","16:45","08:45"])await a.rejects(prepareCreation({verified:true,uid:b},{action:"create",appointmentId:"a",serviceId:"cut",staffId:"staff",date,startTime})(tx,{businessId:b,actorId:b}));
});

const {createSessionQueue}=require("../sync/android-session.cjs");
const {createDrain}=require("../sync/android-transport.cjs");
const {createHash}=require("node:crypto");
test("queue to emulator transaction: lost acknowledgement and retry",{timeout:120000},async()=>{
 const b="queue_"+Date.now(),date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 const day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(date+"T12:00:00Z").getUTCDay()];
 const root=db.collection("businesses").doc(b);
 await root.collection("catalogue").doc("current").set({schemaVersion:1,business:{ownerUid:b,published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[{id:"staff",name:"Staff",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"09:00",close:"17:00"}}}]});
 const q=createSessionQueue(),t=q.start({verified:true,uid:b,businessId:b});
 q.enqueue(t,{action:"create",appointmentId:"a",expectedRevision:0,serviceId:"cut",staffId:"staff",date,startTime:"09:00"},"request");
 let lost=true;
 const drain=createDrain(q,async request=>{
 const result=await executeBooking({store,businessId:b,actorId:b,key:request.requestId,fingerprint:createHash("sha256").update(JSON.stringify(request)).digest("hex"),prepare:prepareCreation({verified:true,uid:b},request)});
 if(lost){lost=false;throw Error("Lost acknowledgement");}
 return {businessId:b,actorId:b,requestId:request.requestId,appointmentId:result.appointmentId,status:"accepted",revision:1};
 });
 a.equal(await drain(t,true),"retry");a.equal(q.pending(t,true).length,1);
 a.equal(await drain(t,true),"done");a.equal(q.pending(t,true).length,0);
 a.equal((await root.collection("appointments").get()).size,1);
 a.equal((await root.collection("bookingRequests").get()).size,1);
 a.equal((await root.collection("bookingLocks").get()).size,2);
});

test("two simulated devices compete for identical appointment slots",{timeout:120000},async()=>{
 const b="devices_"+Date.now(),date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 const day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(date+"T12:00:00Z").getUTCDay()];
 const root=db.collection("businesses").doc(b);
 await root.collection("catalogue").doc("current").set({schemaVersion:1,business:{ownerUid:b,published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[{id:"staff",name:"Staff",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"09:00",close:"17:00"}}}]});
 const clients=["a","b"].map(id=>{const q=createSessionQueue(),t=q.start({verified:true,uid:b,businessId:b});q.enqueue(t,{action:"create",appointmentId:id,expectedRevision:0,serviceId:"cut",staffId:"staff",date,startTime:"09:00"},"request_"+id);return {q,t};});
 const send=async request=>{const receipt={businessId:b,actorId:b,requestId:request.requestId,appointmentId:request.appointmentId};try{await executeBooking({store,businessId:b,actorId:b,key:request.requestId,fingerprint:createHash("sha256").update(JSON.stringify(request)).digest("hex"),prepare:prepareCreation({verified:true,uid:b},request)});return {...receipt,status:"accepted",revision:1};}catch(e){if(!/Occupied/.test(e.message))throw e;return {...receipt,status:"conflict"};}};
 const states=await Promise.all(clients.map(({q,t})=>createDrain(q,send)(t,true)));
 a.deepEqual(states,["done","done"]);for(const {q,t} of clients)a.equal(q.pending(t,true).length,0);
 a.equal((await root.collection("appointments").get()).size,1);
 a.equal((await root.collection("bookingRequests").get()).size,1);
 a.equal((await root.collection("bookingLocks").get()).size,2);
});
