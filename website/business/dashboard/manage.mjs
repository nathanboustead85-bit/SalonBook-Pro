import {createEditor} from "./editor.mjs";
import {DAYS} from "../setup/enhanced-draft.mjs";
if(typeof document!=="undefined"){
 const editor=createEditor();
 const el=id=>document.getElementById(id);
 let selectedService=-1,selectedStaff=-1;
 const message=text=>{el("message").textContent=text;};
 const run=fn=>{try{fn();message("Preview updated in memory only.");render();}catch(e){message(e.message);}};
 const input=(id)=>el(id).value;
 function row(container,label,index,onEdit,onRemove){
  const div=document.createElement("div");div.className="item";
  const name=document.createElement("span");name.textContent=label;
  const buttons=document.createElement("span");
  const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>onEdit(index));
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.className="secondary";remove.addEventListener("click",()=>onRemove(index));
  buttons.append(edit,remove);div.append(name,buttons);container.append(div);
 }
 function render(){
  const {draft,dirty}=editor.state();
  el("dirty").textContent=dirty?"Unsaved preview changes":"No unsaved changes";
  el("business-name").value=draft.profile.name;
  el("business-category").value=draft.profile.category;
  el("business-email").value=draft.profile.email;
  el("service-items").replaceChildren();el("staff-items").replaceChildren();
  draft.services.forEach((s,i)=>row(el("service-items"),s.name+" · £"+Number(s.price).toFixed(2)+" · "+s.duration+" min",i,index=>{
   selectedService=index;el("service-name").value=s.name;el("service-price").value=s.price;el("service-duration").value=String(s.duration);
   el("service-selection").textContent="Editing service "+(index+1);
  },index=>run(()=>{editor.removeService(index);selectedService=-1;})));
  draft.staff.forEach((s,i)=>row(el("staff-items"),s.name,i,index=>{
   selectedStaff=index;el("staff-name").value=s.name;el("staff-selection").textContent="Editing staff member "+(index+1);
  },index=>run(()=>{editor.removeStaff(index);selectedStaff=-1;})));
  el("days").replaceChildren();
  for(const day of DAYS){
   const hours=draft.week[day];const div=document.createElement("div");div.className="day";
   const label=document.createElement("strong");label.textContent=day;
   const closed=document.createElement("input");closed.type="checkbox";closed.checked=hours.closed;closed.setAttribute("aria-label",day+" closed");
   const open=document.createElement("input");open.type="time";open.value=hours.open;open.setAttribute("aria-label",day+" opening");
   const close=document.createElement("input");close.type="time";close.value=hours.close;close.setAttribute("aria-label",day+" closing");
   open.disabled=closed.checked;close.disabled=closed.checked;
   function change(){run(()=>editor.updateDay(day,{closed:closed.checked,open:open.value,close:close.value}));}
   for(const field of [closed,open,close])field.addEventListener("change",change);
   div.append(label,closed,open,close);el("days").append(div);
  }
 }
 const service=()=>({name:input("service-name"),price:input("service-price"),duration:Number(input("service-duration"))});
 el("add-service").addEventListener("click",()=>run(()=>editor.addService(service())));
 el("edit-service").addEventListener("click",()=>run(()=>editor.editService(selectedService,service())));
 el("add-staff").addEventListener("click",()=>run(()=>editor.addStaff({name:input("staff-name")})));
 el("edit-staff").addEventListener("click",()=>run(()=>editor.editStaff(selectedStaff,{name:input("staff-name")})));
 el("update-profile").addEventListener("click",()=>run(()=>editor.updateProfile({name:input("business-name"),category:input("business-category"),email:input("business-email")})));
 el("accept").addEventListener("click",()=>run(()=>editor.acceptPreview()));
 el("discard").addEventListener("click",()=>{editor.discard();selectedService=-1;selectedStaff=-1;render();message("Unaccepted changes discarded.");});
 window.addEventListener("beforeunload",event=>{if(editor.state().dirty){event.preventDefault();event.returnValue="";}});
 render();
}
