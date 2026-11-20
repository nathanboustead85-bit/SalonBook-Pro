"use strict";
/* Phase 28.18: local in-memory preview only. Never persists or uploads. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioPhase2818Manager=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
const VALID_KINDS=new Set(["service","staff","cover"]);
const ID=/^[a-zA-Z0-9_-]{1,64}$/;
function valid(x){return x&&typeof x==="object"&&!Array.isArray(x)&&ID.test(x.id)&&VALID_KINDS.has(x.kind)&&typeof x.label==="string"&&x.label.length<=80&&x.label.length>0&&!/[<>\u0000-\u001f]/.test(x.label)&&typeof x.alt==="string"&&x.alt.length<=120&&x.alt.length>0&&!/[<>\u0000-\u001f]/.test(x.alt);}
function createManager(seed=[]){
if(!Array.isArray(seed)||seed.length>21||seed.some(x=>!valid(x))||new Set(seed.map(x=>x.id)).size!==seed.length)throw Error("INVALID_DEMO_GALLERY");
let items=seed.map(x=>({id:x.id,kind:x.kind,label:x.label,alt:x.alt,featured:!!x.featured}));
function list(kind){return items.filter(x=>!kind||x.kind===kind).map(x=>({...x}));}
function update(id,patch){if(!ID.test(id)||!patch||typeof patch!=="object")return false;const i=items.findIndex(x=>x.id===id);if(i<0)return false;const next={...items[i]};if(Object.hasOwn(patch,"alt")){if(typeof patch.alt!=="string"||!patch.alt.trim()||patch.alt.length>120||/[<>\u0000-\u001f]/.test(patch.alt))return false;next.alt=patch.alt;}
if(Object.hasOwn(patch,"label")){if(typeof patch.label!=="string"||!patch.label.trim()||patch.label.length>80||/[<>\u0000-\u001f]/.test(patch.label))return false;next.label=patch.label;}
if(Object.hasOwn(patch,"featured")){if(typeof patch.featured!=="boolean")return false;next.featured=patch.featured;if(next.featured)items=items.map(x=>x.kind===next.kind?{...x,featured:false}:x);}
items[i]=next;return true;}
function remove(id){const before=items.length;items=items.filter(x=>x.id!==id);return items.length!==before;}
function reorder(id,direction){if(!["up","down"].includes(direction))return false;const i=items.findIndex(x=>x.id===id);if(i<0)return false;const offset=direction==="up"?-1:1,j=i+offset;if(j<0||j>=items.length||items[j].kind!==items[i].kind)return false;[items[i],items[j]]=[items[j],items[i]];return true;}
function reset(){items=seed.map(x=>({id:x.id,kind:x.kind,label:x.label,alt:x.alt,featured:!!x.featured}));}
return Object.freeze({list,update,remove,reorder,reset});
}
return Object.freeze({createManager});
});
