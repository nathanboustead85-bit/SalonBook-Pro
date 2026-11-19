import {createCustomerBookingPreview} from "../website/customer/booking/preview-foundation.mjs";
const preview=createCustomerBookingPreview({root:document,fixture:{name:"Kody Blends — Demo",services:[{name:"Haircut",price:20,duration:30},{name:"Skin fade",price:25,duration:45},{name:"Beard trim",price:12,duration:20}]}});
window.__phase23=preview;
