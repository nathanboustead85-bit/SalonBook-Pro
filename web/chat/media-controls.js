'use strict';
/* Local-only media selection and microphone preview; never transmits data. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BoustioMediaControls=api;
})(typeof window!=='undefined'?window:null,function(){
 const PHOTO_TYPES=['image/jpeg','image/png','image/webp'];
 const AUDIO_TYPES=['audio/webm','audio/ogg','audio/mp4'];
 const MAX_PHOTO=5*1024*1024,MAX_AUDIO=10*1024*1024,MAX_SECONDS=60;
 function validatePhoto(file){
  if(!file||!PHOTO_TYPES.includes(file.type))return {ok:false,code:'PHOTO_TYPE'};
  if(!Number.isFinite(file.size)||file.size<=0||file.size>MAX_PHOTO)return {ok:false,code:'PHOTO_SIZE'};
  return {ok:true};
 }
 function validateVoice(blob,seconds){
  if(!blob||!AUDIO_TYPES.includes(blob.type))return {ok:false,code:'VOICE_TYPE'};
  if(!Number.isFinite(blob.size)||blob.size<=0||blob.size>MAX_AUDIO)return {ok:false,code:'VOICE_SIZE'};
  if(!Number.isFinite(seconds)||seconds<=0||seconds>MAX_SECONDS)return {ok:false,code:'VOICE_DURATION'};
  return {ok:true};
 }
 function mount({photoInput,recordButton,preview,status,disabled=()=>false}){
  if(!photoInput||!recordButton||!preview||!status)throw new Error('MEDIA_CONTROLS_REQUIRED');
  let photo=null,voice=null,recorder=null,stream=null,timer=null,started=0,chunks=[],url=null,disposed=false;
  const setStatus=text=>{status.textContent=text};
  function releaseUrl(){if(url){URL.revokeObjectURL(url);url=null}}
  function clear(){photo=null;voice=null;photoInput.value='';releaseUrl();preview.replaceChildren();preview.hidden=true;setStatus('No attachment selected')}
  function showPhoto(file){
   clear();photo=file;url=URL.createObjectURL(file);
   const label=document.createElement('span');label.textContent='Photo preview: '+file.name+' (not uploaded)';
   const img=document.createElement('img');img.src=url;img.alt='Selected photo preview';
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove photo';remove.addEventListener('click',clear);
   preview.replaceChildren(label,img,remove);preview.hidden=false;setStatus('Photo selected, preview only');
  }
  photoInput.addEventListener('change',()=>{
   const file=photoInput.files?.[0];if(!file)return;
   if(disabled()){clear();return}
   const check=validatePhoto(file);
   if(!check.ok){clear();setStatus('Invalid photo. Choose JPEG, PNG or WebP under 5 MB.');return}
   showPhoto(file);
  });
  function stop(){
   if(timer!==null){clearTimeout(timer);timer=null}
   if(recorder&&recorder.state==='recording')recorder.stop();
   recordButton.textContent='🎙';recordButton.setAttribute('aria-label','Record a voice note');
  }
  async function record(){
   if(disabled()||disposed)return;
   if(recorder?.state==='recording'){stop();return}
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setStatus('Voice recording unavailable in this browser');return}
   try{
    const acquired=await navigator.mediaDevices.getUserMedia({audio:true});
    if(disposed||disabled()){acquired.getTracks().forEach(t=>t.stop());return}
    clear();stream=acquired;chunks=[];recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onerror=()=>{setStatus('Recording failed');stop()};
    recorder.onstop=()=>{
     stream?.getTracks().forEach(t=>t.stop());stream=null;
     if(disposed)return;
     const seconds=Math.min(MAX_SECONDS,(Date.now()-started)/1000);
     const blob=new Blob(chunks,{type:recorder.mimeType});
     const result=validateVoice(blob,seconds);
     if(!result.ok){setStatus('Voice note unsupported or exceeds limits');return}
     voice={blob,seconds};
     const label=document.createElement('span');label.textContent='Voice note: '+Math.ceil(seconds)+' seconds (not uploaded)';
     const remove=document.createElement('button');remove.type='button';remove.textContent='Remove voice note';remove.addEventListener('click',clear);
     preview.replaceChildren(label,remove);preview.hidden=false;setStatus('Voice note ready, preview only');
    };
    recorder.start();started=Date.now();recordButton.textContent='■';recordButton.setAttribute('aria-label','Stop recording');
    setStatus('Recording voice note (maximum 60 seconds)');
    timer=setTimeout(stop,60000);
   }catch{stream?.getTracks().forEach(t=>t.stop());stream=null;setStatus('Microphone permission denied or recording unavailable')}
  }
  recordButton.addEventListener('click',record);
  return Object.freeze({
   snapshot:()=>({photo:photo?{name:photo.name,size:photo.size}:null,voice:voice?{size:voice.blob.size,seconds:voice.seconds}:null}),
   clear,
   stop,
   dispose:()=>{disposed=true;stop();stream?.getTracks().forEach(t=>t.stop());clear()}
  });
 }
 return Object.freeze({validatePhoto,validateVoice,mount,MAX_PHOTO,MAX_AUDIO,MAX_SECONDS});
});
