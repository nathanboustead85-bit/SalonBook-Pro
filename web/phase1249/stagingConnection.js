"use strict";
// Phase 12.49: browser-safe, read-only staging adapter. Never production.
(function(root,factory){const api=factory(typeof module==="object"&&module.exports?require("../phase1246/publicAvailabilityReader"):root.BoustioPhase1246);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BoustioPhase1249=api;})(typeof window!=="undefined"?window:null,function(reader){
 const ORIGIN="http://127.0.0.1:8080",SLUG="demo-salon";
 const unavailable=()=>({status:"UNAVAILABLE",bookingEnabled:false,services:[],staff:[],availability:[]});
 async function load({slug=SLUG,origin=ORIGIN,now=Date.now(),fetcher}={}){
  if(slug!==SLUG||origin!==ORIGIN||typeof fetcher!=="function"||!Number.isSafeInteger(now))return unavailable();
  const data=await reader.load({slug,origin,now,fetcher});
  if(data.status!=="READ_ONLY"||data.bookingEnabled!==false)return unavailable();
  const staff=[...new Set(data.availability.map(x=>x.staffId))].sort().map(id=>({id,name:id}));
  return {status:"STAGING_PREVIEW",bookingEnabled:false,businessName:data.businessName,
   date:data.date,services:data.services,staff,availability:data.availability};
 }
 return {load,unavailable};
});
