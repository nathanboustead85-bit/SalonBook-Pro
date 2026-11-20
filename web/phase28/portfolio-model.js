"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioPhase2819Gallery=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
const ID=/^[a-zA-Z0-9_-]{1,64}$/;const safe=s=>typeof s==="string"&&s.trim().length>0&&s.length<=120&&!/[<>\u0000-\u001f]/.test(s);
function validateEntry(x){return !!(x&&typeof x==="object"&&!Array.isArray(x)&&ID.test(x.id)&&["staff","service","salon"].includes(x.kind)&&safe(x.title)&&safe(x.alt)&&ID.test(x.ownerId)&&(!x.staffId||ID.test(x.staffId))&&(!x.serviceId||ID.test(x.serviceId))&&x.approved===true&&x.visibility==="public"&&x.demo===true);}
function createGallery(entries,ownerId){if(!ID.test(ownerId)||!Array.isArray(entries)||entries.length>40||entries.some(x=>!validateEntry(x))||new Set(entries.map(x=>x.id)).size!==entries.length)throw Error("INVALID_DEMO_GALLERY");const allowed=entries.filter(x=>x.ownerId===ownerId).map(x=>Object.freeze({id:x.id,kind:x.kind,title:x.title,alt:x.alt,ownerId:x.ownerId,staffId:x.staffId||null,serviceId:x.serviceId||null,approved:true,demo:true}));
function list({kind,staffId,serviceId}={}){if(kind&&!["staff","service","salon"].includes(kind))return [];if(staffId&&!ID.test(staffId))return [];if(serviceId&&!ID.test(serviceId))return [];return allowed.filter(x=>(!kind||x.kind===kind)&&(!staffId||x.staffId===staffId)&&(!serviceId||x.serviceId===serviceId)).map(x=>({...x}));}
function staff(){const result=new Map();for(const x of allowed)if(x.staffId){const a=result.get(x.staffId)||[];a.push({...x});result.set(x.staffId,a);}return [...result].map(([id,photos])=>({id,photos}));}
return Object.freeze({list,staff});}
return Object.freeze({createGallery,validateEntry});
});
