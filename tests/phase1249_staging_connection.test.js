"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const api=require("../web/phase1249/stagingConnection");
const now=Date.now();
const source={fields:{status:{stringValue:"PUBLIC_PREVIEW"},schemaVersion:{integerValue:"1"},businessId:{stringValue:"demo-owner"},slug:{stringValue:"demo-salon"},businessName:{stringValue:"Demo Salon"},date:{stringValue:"2026-11-20"},generatedAt:{integerValue:String(now)},expiresAt:{timestampValue:new Date(now+300000).toISOString()},bookingEnabled:{booleanValue:false},services:{arrayValue:{values:[{mapValue:{fields:{id:{stringValue:"cut"},name:{stringValue:"Haircut"},pricePence:{integerValue:"2000"},durationMinutes:{integerValue:"30"}}}}]}},availability:{arrayValue:{values:[{mapValue:{fields:{serviceId:{stringValue:"cut"},staffId:{stringValue:"alex"},times:{arrayValue:{values:[{stringValue:"09:00"}]}}}}}]}}}};
function check(name,condition){assert.ok(condition,name);console.log("PASS "+name)}
async function main(){
 let calls=0;const fetcher=async(url,options)=>{calls++;check("read-only GET with no credentials",options.method==="GET"&&options.credentials==="omit");check("local emulator endpoint only",url.startsWith("http://127.0.0.1:8080/"));return {ok:true,json:async()=>source}};
 const good=await api.load({fetcher,now});
 check("emulator snapshot appears as staging preview",good.status==="STAGING_PREVIEW");
 check("service and price preserved",good.services[0].name==="Haircut"&&good.services[0].pricePence===2000);
 check("stylist and times available",good.staff[0].id==="alex"&&good.availability[0].times[0]==="09:00");
 check("booking disabled",good.bookingEnabled===false);
 check("no private fields exposed",!JSON.stringify(good).includes("customer"));
 check("only one network read",calls===1);
 for(const [name,args] of [["production origin",{origin:"https://firestore.googleapis.com"}],["wrong slug",{slug:"real-salon"}],["missing fetcher",{fetcher:null}]]){
  const before=calls;const v=await api.load({fetcher,now,...args});check(name+" fails closed",v.status==="UNAVAILABLE"&&calls===before);
 }
 const old=await api.load({fetcher,now:now+300001});check("stale data fails closed",old.status==="UNAVAILABLE");
 const html=fs.readFileSync("web/phase1249/index.html","utf8");
 for(const [name,re] of [["mobile viewport",/name="viewport"/],["service selector",/id="service"/],["stylist selector",/id="stylist"/],["time slots",/id="times"/],["read-only warning",/Read-only preview/],["noindex",/noindex,nofollow/],["explicit local staging",/local Firestore emulator/]]){
 check(name,re.test(html))}
 check("no booking form",!/type="submit"|method="POST"|firebase\.initializeApp|https:\/\/firestore\.googleapis/.test(html));
 check("no production project in client files",!html.includes("salonbook-pro-ad5ff")&&!fs.readFileSync("web/phase1249/stagingConnection.js","utf8").includes("salonbook-pro-ad5ff"));
}
main().catch(e=>{console.error(e);process.exit(1)});
