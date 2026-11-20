"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioPhase29Onboarding=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
const ID=/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const TEXT=/^[^<>\u0000-\u001f]*$/;
const DEFAULT=Object.freeze({bookings:false,payments:false,messaging:false,uploads:false,publishing:false,deploy:false});
function clean(value,max){return typeof value==="string"&&value.trim().length>0&&value.trim().length<=max&&TEXT.test(value)?value.trim():null;}
function validateDraft(draft){if(!draft||typeof draft!=="object"||Array.isArray(draft))return {ok:false,errors:["INVALID_DRAFT"]};
const errors=[];const name=clean(draft.businessName,80);if(!name)errors.push("BUSINESS_NAME_REQUIRED");
const slug=typeof draft.slug==="string"?draft.slug.trim():null;if(!slug||!ID.test(slug))errors.push("INVALID_SLUG");
const type=draft.businessType;if(!["salon","barber","nails","beauty","other"].includes(type))errors.push("INVALID_BUSINESS_TYPE");
const description=draft.description==null?"":draft.description;if(typeof description!=="string"||description.length>300||!TEXT.test(description))errors.push("INVALID_DESCRIPTION");
const services=Array.isArray(draft.services)?draft.services:null;if(!services||services.length>20)errors.push("INVALID_SERVICES");
else {const ids=new Set();for(const s of services){if(!s||typeof s!=="object"||!clean(s.name,80)||!ID.test(s.id||"")||!Number.isInteger(s.pricePence)||s.pricePence<0||s.pricePence>1000000||!Number.isInteger(s.durationMinutes)||s.durationMinutes<5||s.durationMinutes>480||ids.has(s.id)){errors.push("INVALID_SERVICE");break;}ids.add(s.id);}}
const staff=Array.isArray(draft.staff)?draft.staff:null;if(!staff||staff.length>20)errors.push("INVALID_STAFF");
else {const ids=new Set();for(const s of staff){if(!s||!ID.test(s.id||"")||!clean(s.name,80)||ids.has(s.id)||!Array.isArray(s.serviceIds)||s.serviceIds.some(id=>!services||!services.some(x=>x&&x.id===id))){errors.push("INVALID_STAFF_MEMBER");break;}ids.add(s.id);}}
return {ok:errors.length===0,errors};}
function createPreview(draft){const result=validateDraft(draft);if(!result.ok)return {status:"INVALID_DRAFT",errors:result.errors};const snapshot=JSON.parse(JSON.stringify({businessName:draft.businessName.trim(),slug:draft.slug.trim(),businessType:draft.businessType,description:draft.description||"",services:draft.services,staff:draft.staff}));return {status:"LOCAL_DEMO_ONLY",draft:snapshot,featureFlags:{...DEFAULT},canPublish:false,canBook:false};}
function steps(draft){const d=draft||{};return [{id:"business",done:!!(clean(d.businessName,80)&&ID.test(d.slug||"")&&["salon","barber","nails","beauty","other"].includes(d.businessType))},{id:"services",done:Array.isArray(d.services)&&d.services.length>0},{id:"staff",done:Array.isArray(d.staff)&&d.staff.length>0},{id:"review",done:validateDraft(d).ok}];}
return Object.freeze({validateDraft,createPreview,steps,DEFAULT});});
