"use strict";
// Phase 33.9: pure, offline display model. No HTML injection, I/O or write actions.
const {authorizeDashboardRead,READ}=require("./dashboard-permissions-33-8");
const empty=Object.freeze([]);
const safeText=x=>typeof x==="string"?x.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,150):"";
const blank=(status,message)=>Object.freeze({status,message,sections:empty,bookingEnabled:false,editingEnabled:false,actions:empty});
const section=(key,title,rows)=>Object.freeze({key,title,empty:rows.length===0,rows:Object.freeze(rows)});
function presentDashboard(session,principal,now){
 if(!session||session.status==="SIGNED_OUT")return blank("SIGNED_OUT","Sign in to view your business dashboard.");
 if(session.status==="SESSION_READY"||session.status==="DASHBOARD_LOADING")return blank("LOADING","Loading your business dashboard.");
 if(session.status!=="DASHBOARD_READY")return blank("UNAVAILABLE","Business information is unavailable. Try refreshing.");
 const checks=READ.map(action=>authorizeDashboardRead(session,principal,action,now));
 if(checks.some(x=>x.status!=="READ_ONLY_ALLOWED"))return blank("UNAVAILABLE","Business information is unavailable. Try refreshing.");
 const [business,services,staff,hours,summary]=checks.map(x=>x.data);
 if(!business||!Array.isArray(services)||!Array.isArray(staff)||!Array.isArray(hours)||!summary)return blank("UNAVAILABLE","Business information is unavailable. Try refreshing.");
 const sections=[
  section("business","Business",[{label:"Name",value:safeText(business.name)}]),
  section("services","Services",services.map(s=>({label:safeText(s.name),value:"£"+(s.pricePence/100).toFixed(2)+" · "+s.durationMinutes+" min",visibility:s.active===true?"Public":"Private"}))),
  section("staff","Staff",staff.map(s=>({label:safeText(s.name),value:safeText(s.role),visibility:s.publicVisible===true?"Public":"Private"}))),
  section("opening_hours","Opening hours",hours.map(d=>({label:safeText(d.day),value:d.closed?"Closed":d.intervals.map(i=>i.open+"–"+i.close).join(", ")}))),
  section("summary","Summary",[{label:"Services",value:String(summary.serviceCount)},{label:"Staff",value:String(summary.staffCount)},{label:"Closed days",value:String(summary.closedDays)}])
 ];
 return Object.freeze({status:"READ_ONLY_READY",message:null,sections:Object.freeze(sections),bookingEnabled:false,editingEnabled:false,actions:empty});
}
module.exports=Object.freeze({presentDashboard,safeText});
