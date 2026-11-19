// Phase 24.6: local synthetic branding preview, never production or publishing.
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export const PALETTE=Object.freeze(["#087d7b","#125c53","#1e6091","#6d4c91","#bd5d38"]);
const MAX_IMAGE_BYTES=350000;
const defaults=()=>({name:"Kody Blends",tagline:"Your next great look starts here",colour:"#087d7b",logo:null,cover:null});
function validateImage(value){if(value===null)return null;if(typeof value!=="string"||value.length>MAX_IMAGE_BYTES*1.5||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error("Only small PNG, JPEG or WebP images are allowed");const raw=value.split(",")[1];if(raw.length*3/4>MAX_IMAGE_BYTES+3)throw Error("Image exceeds demo limit");const binary=atob(raw);const bytes=[...binary.slice(0,12)].map(c=>c.charCodeAt(0));const png=bytes.slice(0,8).join(",")==="137,80,78,71,13,10,26,10",jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=binary.slice(0,4)==="RIFF"&&binary.slice(8,12)==="WEBP";const kind=value.slice(11,value.indexOf(";"));if(!(kind==="png"&&png||kind==="jpeg"&&jpeg||kind==="webp"&&webp))throw Error("Invalid image signature");return value;}
export function createBrandingDemo(storage,owner){
 if(typeof owner!=="string"||!/^demo-[a-z0-9-]{3,40}$/.test(owner))throw Error("Synthetic demo owner required");
 const key="boustio-phase24-6:"+owner;let state=defaults();
 const read=()=>storage.getItem?storage.getItem(key):storage.get(key),write=v=>storage.setItem?storage.setItem(key,v):storage.set(key,v),remove=()=>storage.removeItem?storage.removeItem(key):storage.delete(key);
 function validate(v){if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!=="colour,cover,logo,name,tagline"||typeof v.name!=="string"||v.name.trim().length<2||v.name.trim().length>80||typeof v.tagline!=="string"||v.tagline.length>120||!PALETTE.includes(v.colour))throw Error("Invalid brand");return {name:v.name.trim(),tagline:v.tagline.trim(),colour:v.colour,logo:validateImage(v.logo),cover:validateImage(v.cover)};}
 function update(fields){if(!fields||typeof fields!=="object"||Array.isArray(fields)||Object.keys(fields).some(k=>!["name","tagline","colour","logo","cover"].includes(k)))throw Error("Invalid fields");state=validate({...state,...fields});}
 function save(){write(JSON.stringify({version:1,owner,brand:state}));}
 function load(){const raw=read();if(!raw)return false;const data=JSON.parse(raw);if(data.version!==1||data.owner!==owner)throw Error("Owner mismatch");const next=validate(data.brand);state=next;return true;}
 return Object.freeze({owner,get state(){return structuredClone(state);},update,save,load,clear(){remove();state=defaults();},get canPublish(){return false;}});
}
export async function readDemoImage(file){if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>MAX_IMAGE_BYTES||file.size===0)throw Error("Select PNG, JPEG or WebP under 350 KB");const bytes=new Uint8Array(await file.arrayBuffer());const chars=Array.from(bytes,b=>String.fromCharCode(b)).join("");const encoded=btoa(chars);return validateImage("data:"+file.type+";base64,"+encoded);}
