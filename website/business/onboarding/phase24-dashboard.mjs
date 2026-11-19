// Phase 24.8: read-only synthetic dashboard composed from independently validated phase 24 drafts.
import {createProfileDemo} from "./phase24-profile.mjs";
import {createServicesDemo} from "./phase24-services.mjs";
import {createStaffScheduleDemo} from "./phase24-staff.mjs";
import {createBrandingDemo} from "./phase24-branding.mjs";
import {createPoliciesDemo} from "./phase24-policies.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export const SECTIONS=Object.freeze(["profile","services","staff","branding","preferences"]);
export function createDashboardDemo(storage,owner){
 if(typeof owner!=="string"||!/^demo-[a-z0-9-]{3,40}$/.test(owner))throw Error("Synthetic demo owner required");
 const modules={profile:createProfileDemo(storage,owner),services:createServicesDemo(storage,owner),staff:createStaffScheduleDemo(storage,owner),branding:createBrandingDemo(storage,owner),preferences:createPoliciesDemo(storage,owner)};
 const status={};
 function recover(){for(const section of SECTIONS){try{status[section]=modules[section].load()?"saved":"not saved";}catch{status[section]="invalid draft";}}return {...status};}
 function snapshot(){
  const p=modules.profile.profile,s=modules.services.state,st=modules.staff.state,b=modules.branding.state,pol=modules.preferences.state;
  const cards={profile:{label:"Business profile",status:status.profile,summary:p.name||"Business details not yet completed",detail:p.town||p.category},services:{label:"Services and pricing",status:status.services,summary:s.services.length+" services",detail:s.services.map(x=>x.name+" — £"+(x.pricePence/100).toFixed(2)).join(" • ")||"Add services in the service editor"},staff:{label:"Staff and schedules",status:status.staff,summary:st.staff.length+" professionals",detail:st.staff.map(x=>x.name+" ("+x.role+")").join(" • ")||"Add professionals in staff management"},branding:{label:"Branding",status:status.branding,summary:b.name,detail:b.tagline},preferences:{label:"Booking preferences",status:status.preferences,summary:pol.cancellationHours+"h cancellation notice",detail:pol.minimumNoticeHours+"h booking notice • "+pol.maximumAdvanceDays+" days ahead"}};
  return {owner,live:{...LIVE},cards,profileCompleteness:modules.profile.completeness,serviceCount:s.services.length,professionalCount:st.staff.length,brandColour:b.colour,logo:b.logo,cover:b.cover,policyText:pol.policyText,readOnly:true};
 }
 recover();
 return Object.freeze({owner,recover,snapshot,get canRegister(){return false;},get canBook(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
