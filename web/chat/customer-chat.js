'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const form=$('composer'),input=$('message'),conversation=$('conversation'),photo=$('photoInput');
 const preview=$('attachmentPreview'),voice=$('voicePreview'),record=$('recordButton'),voiceStatus=$('voiceStatus');
 let selectedPhoto=null,recorder=null,chunks=[],recordTimeout=null,recordStart=0,recordedBlob=null,photoUrl=null;
 const escapeText=text=>String(text||'').slice(0,4000);
 function bubble(text,kind='outgoing'){
  const article=document.createElement('article');article.className='bubble '+kind;
  const sender=document.createElement('span');sender.className='sender';sender.textContent='You (preview)';
  const p=document.createElement('p');p.textContent=escapeText(text);
  const time=document.createElement('time');time.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  article.append(sender,p,time);conversation.append(article);conversation.scrollTop=conversation.scrollHeight;
 }
 function clearPhoto(){selectedPhoto=null;photo.value='';preview.hidden=true;preview.replaceChildren();if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null}}
 photo.addEventListener('change',()=>{
  clearPhoto();const file=photo.files[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){alert('Choose a JPEG, PNG or WebP image under 5 MB.');return}
  selectedPhoto=file;photoUrl=URL.createObjectURL(file);
  const title=document.createElement('span');title.textContent='Photo selected (preview only): '+file.name;
  const img=document.createElement('img');img.src=photoUrl;img.alt='Selected attachment preview';
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',clearPhoto);
  preview.replaceChildren(title,img,remove);preview.hidden=false;
 });
 function clearVoice(){recordedBlob=null;voice.hidden=true;voiceStatus.textContent='Voice note ready'}
 $('clearVoice').addEventListener('click',clearVoice);
 async function stopRecording(){
  if(recordTimeout){clearTimeout(recordTimeout);recordTimeout=null}
  if(recorder&&recorder.state==='recording')recorder.stop();
  record.textContent='🎙';record.setAttribute('aria-label','Record a voice note');
 }
 record.addEventListener('click',async()=>{
  if(recorder&&recorder.state==='recording'){await stopRecording();return}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){alert('Voice recording is not supported by this browser.');return}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   chunks=[];recordedBlob=null;recorder=new MediaRecorder(stream);
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   recorder.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());
    recordedBlob=new Blob(chunks,{type:recorder.mimeType});
    voice.hidden=false;voiceStatus.textContent='Voice note ready ('+Math.min(60,Math.ceil((Date.now()-recordStart)/1000))+'s, preview only)';
   };
   recorder.start();recordStart=Date.now();record.textContent='■';record.setAttribute('aria-label','Stop recording');
   recordTimeout=setTimeout(stopRecording,60000);
  }catch{alert('Microphone access was not granted.')}
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();const text=input.value.trim();
  if(!text&&!selectedPhoto&&!recordedBlob)return;
  if(text)bubble(text);
  if(selectedPhoto)bubble('📷 Photo selected: '+selectedPhoto.name+' (not uploaded)');
  if(recordedBlob)bubble('🎙 Voice note preview ('+recordedBlob.size+' bytes, not uploaded)');
  input.value='';clearPhoto();clearVoice();
 });
 window.addEventListener('pagehide',()=>{if(photoUrl)URL.revokeObjectURL(photoUrl);if(recorder&&recorder.state==='recording')stopRecording()});
})();
