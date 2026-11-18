// Phase 18.4: memory-only business setup preview. No Firebase, storage, or network.
export const SETUP_PUBLISHING_ENABLED = false;
export const CUSTOMER_BOOKINGS_ENABLED = false;
export const STEPS = Object.freeze(["Business","Services","Hours","Staff","Review"]);
const categories=new Set(["salon","barber","nails","beauty","wellness"]);
export function validateStep(step,d) {
  const str=x=>typeof x==="string"?x.trim():"";
  switch(step){
    case 0: return str(d.name).length>=2 && str(d.name).length<=100 && categories.has(d.category) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(d.contact)) && str(d.contact).length<=254;
    case 1: return str(d.service).length>=2 && str(d.service).length<=100 && str(d.price)!=="" && Number.isFinite(Number(d.price)) && Number(d.price)>=0 && Number(d.price)<=10000 && [15,30,45,60,90,120].includes(Number(d.duration));
    case 2: return /^\d{2}:\d{2}$/.test(str(d.opening)) && /^\d{2}:\d{2}$/.test(str(d.closing)) && str(d.opening)<str(d.closing);
    case 3: return str(d.staff).length>=2 && str(d.staff).length<=100;
    case 4: return true;
    default: return false;
  }
}
export function safeReview(d){
  return [
    "Business: "+String(d.name||"").slice(0,100),
    "Type: "+String(d.category||""),
    "Contact: "+String(d.contact||"").slice(0,254),
    "Service: "+String(d.service||"").slice(0,100),
    "Price: £"+String(d.price||"0"),
    "Duration: "+String(d.duration||"")+" minutes",
    "Hours: "+String(d.opening||"")+"–"+String(d.closing||""),
    "Staff: "+String(d.staff||"").slice(0,100),
    "Bookings: Disabled"
  ].join("\n");
}
if(typeof document!=="undefined"){
 const form=document.getElementById("wizard");
 if(form){
  let current=0;
  const panes=[...form.querySelectorAll(".pane")];
  const labels=[...document.querySelectorAll(".step")];
  const back=document.getElementById("back");
  const next=document.getElementById("next");
  const error=document.getElementById("error");
  const draft=()=>Object.fromEntries(new FormData(form).entries());
  function render(){
   panes.forEach((pane,i)=>{pane.hidden=i!==current;});
   labels.forEach((label,i)=>{if(i===current)label.setAttribute("aria-current","step");else label.removeAttribute("aria-current");});
   back.disabled=current===0;
   next.disabled=current===4;
   next.textContent=current===4?"Preview complete":"Next";
   error.textContent="";
   if(current===4)document.getElementById("review").textContent=safeReview(draft());
  }
  form.addEventListener("submit",e=>e.preventDefault());
  back.addEventListener("click",()=>{if(current>0){current--;render();}});
  next.addEventListener("click",()=>{
   if(current>=4)return;
   if(!validateStep(current,draft())){error.textContent="Please complete this step with valid details.";return;}
   current++;render();
  });
  render();
 }
}
