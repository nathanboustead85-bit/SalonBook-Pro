"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioPhase29Premium=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
function priceToPence(value){const raw=String(value).trim();if(!/^(?:0|[1-9][0-9]{0,4})(?:\.[0-9]{1,2})?$/.test(raw))return null;const [whole,fraction=""]=raw.split(".");const pence=Number(whole)*100+Number(fraction.padEnd(2,"0"));return pence<=1000000?pence:null;}
function formatPrice(pence){return Number.isInteger(pence)&&pence>=0&&pence<=1000000?"£"+(pence/100).toFixed(2):"Check price";}
function duration(value){const n=Number(value);return Number.isInteger(n)&&n>=5&&n<=480?n:null;}
function toggleService(ids,id,checked){const list=Array.isArray(ids)?ids:[];return checked?[...new Set([...list,id])]:list.filter(v=>v!==id);}
function removeService(services,staff,id){return {services:services.filter(s=>s.id!==id),staff:staff.map(p=>({...p,serviceIds:p.serviceIds.filter(x=>x!==id)}))};}
function summary(d){const services=Array.isArray(d.services)?d.services:[],staff=Array.isArray(d.staff)?d.staff:[];return {business:d.businessName||"",address:"boustio.co.uk/"+(d.slug||""),serviceCount:services.length,teamCount:staff.length,services:services.map(s=>({name:s.name,price:formatPrice(s.pricePence),minutes:s.durationMinutes})),team:staff.map(p=>({name:p.name,services:services.filter(s=>p.serviceIds.includes(s.id)).map(s=>s.name)})),published:false};}
return Object.freeze({priceToPence,formatPrice,duration,toggleService,removeService,summary});});