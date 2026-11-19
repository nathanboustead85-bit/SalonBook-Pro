// Phase 22.10: validation-only editing foundation. No Firestore writes or edit UI.
export const SERVICE_STAFF_EDITING_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const LIVE_DASHBOARD_ENABLED=false;
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const plain=v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const trimmed=(v,max)=>typeof v==="string"&&v.trim().length>0&&v.trim().length<=max?v.trim():null;
function check(type,input){
 if(type!=="service"&&type!=="staff")return Object.freeze({valid:false,errors:["Unsupported record type"]});
 if(!plain(input))return Object.freeze({valid:false,errors:["Record must be a plain object"]});
 const allowed=type==="service"?["name","price","duration"]:["name","role"];
 const errors=[];
 if(Object.keys(input).some(k=>!allowed.includes(k)))errors.push("Unexpected fields");
 if(!trimmed(input.name,180))errors.push("Invalid name");
 if(type==="service"){
  if(typeof input.price!=="number"||!Number.isFinite(input.price)||input.price<0||input.price>100000||Math.round(input.price*100)!==input.price*100)errors.push("Invalid price");
  if(!Number.isInteger(input.duration)||input.duration<1||input.duration>1440)errors.push("Invalid duration");
 }else if(own(input,"role")&&(typeof input.role!=="string"||input.role.length>100))errors.push("Invalid role");
 return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors)});
}
export function createServiceStaffEditingFoundation(){
 function validate(type,input){return check(type,input);}
 function submit(){return Object.freeze({ok:false,reason:"Editing disabled"});}
 return Object.freeze({enabled:false,validate,submit});
}
