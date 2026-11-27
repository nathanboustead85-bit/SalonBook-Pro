// Phase 18.8: offline dashboard presentation only. No authentication, storage or API calls.
export const DASHBOARD_PREVIEW_ONLY=true;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_SECTIONS=Object.freeze(["Overview","Services","Staff","Working hours","Account","Booking settings"]);
export const DEMO=Object.freeze({
 business:"Kody Blends (demo)",category:"Barber",owner:"demo@example.invalid",
 services:[{name:"Haircut",price:20,duration:30},{name:"Beard trim",price:8,duration:15}],
 staff:[{name:"Kody (demo)"},{name:"Alex (demo)"}],
 hours:{Monday:"09:00–17:00",Tuesday:"09:00–17:00",Wednesday:"09:00–17:00",Thursday:"09:00–17:00",Friday:"09:00–17:00",Saturday:"Closed",Sunday:"Closed"}
});
export function dashboardModel(data=DEMO){
 const services=Array.isArray(data.services)?data.services:[];
 const staff=Array.isArray(data.staff)?data.staff:[];
 const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
 const validBusiness=typeof data.business==="string"&&data.business.trim().length>1;
 const validServices=services.length>0&&services.every(s=>typeof s.name==="string"&&s.name.trim().length>1&&Number.isFinite(s.price)&&s.price>=0&&Number.isFinite(s.duration)&&s.duration>0);
 const validStaff=staff.length>0&&staff.every(s=>typeof s.name==="string"&&s.name.trim().length>1);
 const validHours=days.every(day=>typeof data.hours?.[day]==="string"&&data.hours[day].length>0);
 const complete=[validBusiness,validServices,validStaff,validHours].filter(Boolean).length;
 return {business:validBusiness?data.business:"Business setup",category:data.category||"Not set",
  owner:data.owner||"Not set",services,staff,hours:data.hours||{},
  progress:complete*25,checks:[validBusiness,validServices,validStaff,validHours],
  bookingStatus:"Disabled",registrationStatus:"Disabled",publishingStatus:"Disabled",isDemo:true};
}
