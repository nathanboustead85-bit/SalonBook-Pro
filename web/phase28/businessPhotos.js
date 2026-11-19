"use strict";
/* Phase 28.14: pure, offline photo metadata validation. NO uploads, Firebase or network. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioPhase2814Photos=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
const MAX_SERVICE_IMAGES=12,MAX_STAFF_IMAGES=8,MAX_IMAGE_BYTES=2*1024*1024;
const idOk=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(x);
const safeText=(x,max)=>typeof x==="string"&&x.length<=max&&!/[<>\u0000-\u001f]/.test(x);
const urlOk=x=>typeof x==="string"&&/^\/media\/businesses\/[a-zA-Z0-9_-]{1,64}\/[a-zA-Z0-9_-]{1,64}\/([a-zA-Z0-9_-]{1,64})\.(webp|avif)$/.test(x)&&x.length<=260;
function validatePhoto(photo,businessId,kind,ownerId){
if(!photo||typeof photo!=="object"||Array.isArray(photo)||!idOk(businessId)||!idOk(ownerId))return null;
if(!["service","staff","cover"].includes(kind))return null;
if(!idOk(photo.id)||!idOk(photo.businessId)||photo.businessId!==businessId||photo.kind!==kind||photo.ownerId!==ownerId)return null;
if(photo.status!=="approved"||photo.visibility!=="public")return null;
if(!["image/webp","image/avif"].includes(photo.mimeType)||!Number.isInteger(photo.bytes)||photo.bytes<1||photo.bytes>MAX_IMAGE_BYTES)return null;
if(!Number.isInteger(photo.width)||!Number.isInteger(photo.height)||photo.width<320||photo.height<240||photo.width>4096||photo.height>4096)return null;
if(!safeText(photo.alt,120)||!photo.alt.trim()||!urlOk(photo.url))return null;
if(!photo.url.startsWith("/media/businesses/"+businessId+"/"+ownerId+"/"))return null;
if(kind!=="cover"&&!idOk(photo.subjectId))return null;
if(kind==="cover"&&photo.subjectId!==null)return null;
return Object.freeze({id:photo.id,kind,subjectId:photo.subjectId,url:photo.url,alt:photo.alt,width:photo.width,height:photo.height});
}
function prepareGallery({businessId,ownerId,services=[],staff=[],photos=[]}={}){
if(!idOk(businessId)||!idOk(ownerId)||!Array.isArray(services)||!Array.isArray(staff)||!Array.isArray(photos)||photos.length>100)return Object.freeze({status:"BLOCKED",cover:null,services:{},staff:{}});
const serviceIds=new Set(services.map(x=>x&&x.id).filter(idOk)),staffIds=new Set(staff.map(x=>x&&x.id).filter(idOk));
const out={status:"READY",cover:null,services:Object.create(null),staff:Object.create(null)};
let sCount=0,tCount=0;
for(const photo of photos){if(!photo||!["cover","service","staff"].includes(photo.kind))continue;const p=validatePhoto(photo,businessId,photo.kind,ownerId);if(!p)continue;
if(p.kind==="cover"){if(!out.cover)out.cover=p;}
else if(p.kind==="service"&&serviceIds.has(p.subjectId)&&sCount<MAX_SERVICE_IMAGES&&!out.services[p.subjectId]){out.services[p.subjectId]=p;sCount++;}
else if(p.kind==="staff"&&staffIds.has(p.subjectId)&&tCount<MAX_STAFF_IMAGES&&!out.staff[p.subjectId]){out.staff[p.subjectId]=p;tCount++;}
}
return Object.freeze(out);
}
return Object.freeze({validatePhoto,prepareGallery,MAX_SERVICE_IMAGES,MAX_STAFF_IMAGES,MAX_IMAGE_BYTES});
});
