"use strict";
// Phase 13.17: mapping changes inside the EXISTING publishBusiness transaction.
// All reads must happen before any transaction writes. Existing businessSlugs
// remains the canonical reservation index; this mapping is for public lookups.
function preparePublicSlugMapping(db,tx,{uid,slug,previousSlug}){
 const mappingRef=db.collection("publicSlugMappings").doc(slug);
 const previousRef=previousSlug&&previousSlug!==slug?db.collection("publicSlugMappings").doc(previousSlug):null;
 return Promise.all([tx.get(mappingRef),previousRef?tx.get(previousRef):Promise.resolve(null)]).then(([current,previous])=>{
  if(current.exists){
   const value=current.data();
   if(!value||value.businessId!==uid||value.slug!==slug)return {status:"SLUG_TAKEN"};
  }
  return {status:"READY",apply(){
   tx.set(mappingRef,{slug,businessId:uid,published:true});
   if(previousRef&&previous&&previous.exists){
    const value=previous.data();
    if(value&&value.businessId===uid&&value.slug===previousSlug)tx.delete(previousRef);
   }
  }};
 });
}
function prepareUnpublishMapping(db,tx,{uid,slug}){
 if(typeof slug!=="string"||!slug)return Promise.resolve(()=>{});
 const ref=db.collection("publicSlugMappings").doc(slug);
 return tx.get(ref).then(snap=>()=>{
  if(!snap.exists)return ()=>{};
  const data=snap.data();
  if(!data||data.businessId!==uid||data.slug!==slug)return ()=>{};
  return ()=>tx.set(ref,{slug,businessId:uid,published:false});
 });
}
module.exports=Object.freeze({preparePublicSlugMapping,prepareUnpublishMapping});
