"use strict";
/**
 * Phase 17: pure, offline preparation of a MINIMAL public listing.
 * Does not access Firestore, deploy functions or enable bookings.
 * The eventual trusted private reader must validate Firebase identity and
 * ownership BEFORE invoking this projector. Never accept its output directly
 * from an untrusted client as proof of ownership.
 */
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function plain(value){return value!==null&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function text(value,max){return typeof value==="string"&&value.length<=max;}
function preparePublicListing(uid,profile){
  if(!UID.test(uid)||!plain(profile)||profile.businessId!==uid)throw new Error("INVALID_OWNER_PROFILE");
  if(!text(profile.name,100)||profile.name.trim().length<3||
     !text(profile.slug,50)||profile.slug.length<3||!SLUG.test(profile.slug)||
     !text(profile.category,100)||!text(profile.phone,50)||
     !text(profile.address,500)||!text(profile.description,2000))
    throw new Error("INVALID_PUBLIC_PROFILE");
  // Explicit allowlist. Never spread private profile fields.
  return Object.freeze({
    businessId:uid,
    name:profile.name.trim(),
    slug:profile.slug,
    category:profile.category,
    phone:profile.phone,
    address:profile.address,
    description:profile.description,
    published:true,
    acceptingBookings:false,
    schemaVersion:1
  });
}
module.exports=Object.freeze({preparePublicListing});
