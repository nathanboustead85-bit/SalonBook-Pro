// Phase 37.1 browser entry: no Firebase config, credentials, or production initialization.
import {createDashboardRenderer} from "./dashboard-37-1-renderer.mjs";
const renderer=createDashboardRenderer(document);
renderer.render({view:"SIGNED_OUT",message:"Sign in through the isolated Firebase emulator test harness to view business data.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false});
// Only a test harness may inject a verified audited session; never trust URL/query/localStorage data.
export function connectIsolatedSession(session){
 if(!session||typeof session.snapshot!=="function"||typeof session.retry!=="function"||typeof session.start!=="function")throw Error("audited_session_required");
 renderer.connect(session);
 return renderer;
}
