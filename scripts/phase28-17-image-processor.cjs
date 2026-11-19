"use strict";
/* Phase 28.17: isolated, injectable Sharp-based image processor. No cloud storage or deployment. */
const MAX_INPUT_BYTES=8*1024*1024,MAX_OUTPUT_BYTES=2*1024*1024,MAX_PIXELS=24_000_000;
const TARGETS=Object.freeze({service:{width:1200,height:900},staff:{width:800,height:800},cover:{width:1600,height:900}});
const INPUT_TYPES=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const MAGIC=Object.freeze({
 "image/jpeg":b=>b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff,
 "image/png":b=>b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
 "image/webp":b=>b.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP",
 "image/avif":b=>b.length>=16&&b.toString("ascii",4,8)==="ftyp"&&["avif","avis"].includes(b.toString("ascii",8,12))
});
class ImageProcessingError extends Error{constructor(code){super(code);this.name="ImageProcessingError";this.code=code;}}
const reject=code=>{throw new ImageProcessingError(code)};
async function optimisePhoto({buffer,mimeType,kind,sharp,enabled=false,environment="production"}={}){
 if(enabled!==true||environment!=="isolated-test")reject("PROCESSING_DISABLED");
 if(!Buffer.isBuffer(buffer)||buffer.length<12||buffer.length>MAX_INPUT_BYTES)reject("INVALID_INPUT_SIZE");
 if(!INPUT_TYPES.has(mimeType)||!MAGIC[mimeType](buffer))reject("SIGNATURE_MISMATCH");
 if(!Object.hasOwn(TARGETS,kind))reject("INVALID_PHOTO_KIND");
 if(typeof sharp!=="function")reject("PROCESSOR_UNAVAILABLE");
 const target=TARGETS[kind];
 let metadata;
 try{metadata=await sharp(buffer,{failOn:"error",limitInputPixels:MAX_PIXELS,animated:false}).metadata();}catch{reject("INVALID_IMAGE_DATA");}
 if(!metadata||!Number.isInteger(metadata.width)||!Number.isInteger(metadata.height)||metadata.width<320||metadata.height<240||metadata.width>8192||metadata.height>8192||metadata.width*metadata.height>MAX_PIXELS)reject("INVALID_DIMENSIONS");
 if(metadata.pages&&metadata.pages>1)reject("ANIMATED_IMAGES_BLOCKED");
 if(metadata.format!==mimeType.split("/")[1]&&(mimeType!=="image/jpeg"||metadata.format!=="jpeg"))reject("DECODED_FORMAT_MISMATCH");
 // Re-encode from decoded pixels, do not call withMetadata/keepMetadata; strips EXIF, GPS, XMP, ICC by default.
 let output;
 try{output=await sharp(buffer,{failOn:"error",limitInputPixels:MAX_PIXELS,animated:false}).rotate().resize(target.width,target.height,{fit:"cover",position:"attention",withoutEnlargement:true}).webp({quality:76,effort:4}).toBuffer();}catch{reject("ENCODE_FAILED");}
 if(!Buffer.isBuffer(output)||output.length<1||output.length>MAX_OUTPUT_BYTES||!MAGIC["image/webp"](output))reject("INVALID_OUTPUT");
 let info;
 try{info=await sharp(output,{failOn:"error",limitInputPixels:MAX_PIXELS}).metadata();}catch{reject("INVALID_OUTPUT");}
 if(info.width>target.width||info.height>target.height||info.format!=="webp")reject("INVALID_OUTPUT");
 if(info.exif||info.xmp||info.iptc||info.icc)reject("METADATA_NOT_STRIPPED");
 return Object.freeze({buffer:output,mimeType:"image/webp",bytes:output.length,width:info.width,height:info.height,kind,metadataStripped:true});
}
module.exports=Object.freeze({optimisePhoto,ImageProcessingError,MAX_INPUT_BYTES,MAX_OUTPUT_BYTES,TARGETS,MAGIC});
