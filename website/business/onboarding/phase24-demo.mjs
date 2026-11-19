// Boustio Phase 24.1 — strictly local, synthetic onboarding demonstration.
export const FLAGS=Object.freeze({registration:false,bookings:false,payments:false,deploy:false});
const safe=(v,max=80)=>typeof v==="string"?v.trim().slice(0,max):"";
export const slugify=v=>safe(v,80).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48);
export function createDemoOnboarding(){
 let state={business:{name:"",category:"",slug:""},services:[],staff:[]};
 const snapshot=()=>structuredClone(state);
 return Object.freeze({
  get state(){return snapshot();},
  setBusiness(name,category){const n=safe(name),c=safe(category,40);if(n.length<2||!["Barber","Hair salon","Nails","Beauty"].includes(c))throw Error("Invalid demonstration business");state.business={name:n,category:c,slug:slugify(n)};return snapshot();},
  addService(name,price,duration){const n=safe(name);if(n.length<2||!Number.isInteger(price)||price<0||price>100000||!Number.isInteger(duration)||duration<5||duration>480)throw Error("Invalid service");if(state.services.length>=20)throw Error("Demo service limit");state.services.push({name:n,pricePence:price,durationMinutes:duration});return snapshot();},
  addStaff(name){const n=safe(name);if(n.length<2||state.staff.length>=20)throw Error("Invalid staff");state.staff.push({name:n});return snapshot();},
  get previewLink(){return state.business.slug?"https://boustio.co.uk/b/"+encodeURIComponent(state.business.slug)+"?preview=1":null;},
  get canPublish(){return false;},
  get canRegister(){return false;},
  get canBook(){return false;},
  get canPay(){return false;},
  reset(){state={business:{name:"",category:"",slug:""},services:[],staff:[]};return snapshot();}
 });
}
