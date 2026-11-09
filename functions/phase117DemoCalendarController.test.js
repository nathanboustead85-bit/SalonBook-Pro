"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createDemoCalendarController}=require("./phase117DemoCalendarController");
const PROJECT="demo-boustio-legacy-init";
process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099";
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("No production credentials permitted");
const params={businessId:"demo_owner",ownerToken:"synthetic",date:"2026-11-10"};
const a={id:"booking1",source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",endAt:"2026-11-10T10:30:00.000Z",status:"confirmed"};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test("11.7 initial snapshot displays exactly one appointment",async()=>{
 let listener,rendered=[],states=[];
 const bridge={subscribe:async args=>{listener=args;return ()=>{};}};
 const c=createDemoCalendarController({bridge,onRender:v=>rendered=v,onState:s=>states.push(s)});
 c.start(params);await wait(5);listener.onChange({appointments:[a]});
 assert.equal(rendered.length,1);assert.deepEqual(states,["connecting","connected"]);c.stop();
});
test("11.7 same appointment updated without duplicate row",async()=>{
 let listener,rendered=[];
 const c=createDemoCalendarController({bridge:{subscribe:async args=>{listener=args;return ()=>{};}},onRender:v=>rendered=v,onState:()=>{}});
 c.start(params);await wait(5);listener.onChange({appointments:[a]});listener.onChange({appointments:[{...a,status:"cancelled"}]});
 assert.equal(rendered.length,1);assert.equal(rendered[0].status,"cancelled");c.stop();
});
test("11.7 out-of-order server snapshot sorted deterministically",async()=>{
 let listener,rendered=[];
 const c=createDemoCalendarController({bridge:{subscribe:async args=>{listener=args;return ()=>{};}},onRender:v=>rendered=v,onState:()=>{}});
 c.start(params);await wait(5);listener.onChange({appointments:[{...a,id:"booking2",startAt:"2026-11-10T11:00:00.000Z"},a]});
 assert.deepEqual(rendered.map(x=>x.id),["booking1","booking2"]);c.stop();
});
test("11.7 rejects duplicate IDs rather than rendering duplicate appointments",async()=>{
 let listener,states=[];
 const c=createDemoCalendarController({bridge:{subscribe:async args=>{listener=args;return ()=>{};}},onRender:()=>{},onState:s=>states.push(s),retryDelayMs:100});
 c.start(params);await wait(5);listener.onChange({appointments:[a,a]});
 assert.ok(states.includes("reconnecting"));c.stop();
});
test("11.7 reconnects after listener error and restores full snapshot",async()=>{
 let count=0,listener,rendered=[],states=[];
 const c=createDemoCalendarController({bridge:{subscribe:async args=>{count++;listener=args;return ()=>{};}},onRender:v=>rendered=v,onState:s=>states.push(s),retryDelayMs:15});
 c.start(params);await wait(5);listener.onError(Error("offline"));await wait(50);
 assert.ok(count>=2);listener.onChange({appointments:[a]});assert.equal(rendered.length,1);assert.equal(states.at(-1),"connected");c.stop();
});
test("11.7 stopping prevents reconnect and stale listener rendering",async()=>{
 let count=0,listener,rendered=[];
 const c=createDemoCalendarController({bridge:{subscribe:async args=>{count++;listener=args;return ()=>{};}},onRender:v=>rendered=v,onState:()=>{},retryDelayMs:15});
 c.start(params);await wait(5);listener.onError(Error("offline"));c.stop();await wait(45);
 assert.equal(count,1);listener.onChange({appointments:[a]});assert.equal(rendered.length,0);
});
test("11.7 business switching ignores stale events",async()=>{
 const listeners=[],renders=[];
 const c=createDemoCalendarController({bridge:{subscribe:async args=>{listeners.push(args);return ()=>{};}},onRender:v=>renders.push(v),onState:()=>{}});
 c.start(params);await wait(5);c.start({...params,businessId:"demo_other"});await wait(5);
 listeners[0].onChange({appointments:[a]});assert.equal(c.getSnapshot().length,0);
 listeners[1].onChange({appointments:[a]});assert.equal(c.getSnapshot().length,1);c.stop();
});
test("11.7 production Android source remains untouched and demo not exported",()=>{
 const root=path.join(__dirname,".."),index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 assert.equal(index.includes("phase117DemoCalendarController"),false);
 const demo=fs.readFileSync(path.join(root,"demo/phase117/DemoOwnerCalendarActivity.kt"),"utf8");
 assert.match(demo,/EMULATOR DEMO ONLY/);assert.match(demo,/Europe\/London/);
 const website=fs.readFileSync(path.join(root,"website/book/index.html"),"utf8");
 assert.match(website,/Booking unavailable — preview only/);
});
