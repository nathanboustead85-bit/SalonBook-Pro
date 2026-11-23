'use strict';
(() => {
 const $=id=>document.getElementById(id);
 // Intentionally synthetic sample data: no production API, Firebase, storage or account access.
 const samples=[
  {id:'demo-amy',name:'Amy Parker',initials:'AP',service:'Haircut enquiry',time:'10:42',unread:true,messages:[{from:'customer',text:'Hi, do you have any appointments available on Friday?',time:'10:42'}]},
  {id:'demo-james',name:'James Wilson',initials:'JW',service:'Booking question',time:'Yesterday',unread:false,messages:[{from:'customer',text:'Can I book a beard trim with my haircut?',time:'16:20'},{from:'business',text:'Of course! You can choose both services when booking.',time:'16:25'}]},
  {id:'demo-sophie',name:'Sophie Taylor',initials:'ST',service:'Opening hours',time:'Monday',unread:false,messages:[{from:'customer',text:'Are you open on Saturday?',time:'09:10'}]}
 ];
 let selectedId=null,filter='all',search='';
 const workspace=document.querySelector('.workspace'),list=$('conversations'),messages=$('messages');
 const selected=()=>samples.find(s=>s.id===selectedId);
 function create(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e}
 function renderList(){
  list.replaceChildren();
  const filtered=samples.filter(s=>(filter!=='unread'||s.unread)&&(s.name+' '+s.service).toLowerCase().includes(search));
  if(!filtered.length)list.append(create('p','empty','No demo conversations match.'));
  for(const item of filtered){
   const button=create('button','conversation');button.type='button';button.setAttribute('aria-current',String(selectedId===item.id));
   const avatar=create('span','avatar',item.initials),body=create('div','conversation-body'),heading=create('div','conversation-title');
   heading.append(create('span','',item.name),create('time','',item.time));
   const summary=create('p','',item.messages.at(-1)?.text||item.service);
   if(item.unread)summary.append(create('span','unread-dot'));
   body.append(heading,summary);button.append(avatar,body);
   button.addEventListener('click',()=>{selectedId=item.id;item.unread=false;workspace.classList.add('show-detail');renderList();renderDetail()});
   list.append(button);
  }
  $('unreadCount').textContent=samples.filter(s=>s.unread).length+' unread';
 }
 function renderDetail(){
  const item=selected();
  $('customerName').textContent=item?item.name:'Select a conversation';
  $('customerMeta').textContent=item?item.service+' · Sample customer':'Demo customer information';
  $('replyText').disabled=!item;$('replyButton').disabled=!item;
  messages.replaceChildren();
  if(!item){messages.append(create('p','empty','Select a sample conversation to view its messages.'));return}
  for(const msg of item.messages){
   const bubble=create('article','bubble '+(msg.from==='customer'?'from-customer':'from-business'));
   bubble.append(create('p','',msg.text),create('time','',msg.time));messages.append(bubble);
  }
  messages.scrollTop=messages.scrollHeight;
 }
 $('search').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();renderList()});
 document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  renderList();
 }));
 $('backButton').addEventListener('click',()=>workspace.classList.remove('show-detail'));
 $('replyForm').addEventListener('submit',event=>{
  event.preventDefault();const item=selected(),value=$('replyText').value.trim();
  if(!item||!value)return;
  item.messages.push({from:'business',text:value.slice(0,4000),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  $('replyText').value='';renderDetail();renderList();
 });
 renderList();renderDetail();
})();
