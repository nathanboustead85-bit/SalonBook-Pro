// Phase 21.2: opt-in adapter for the real modular Firebase browser SDK.
// Importing this module does not initialize Firebase or enable any public feature.
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const LIVE_DASHBOARD_ENABLED=false;
export const STAGING_SDK_ADAPTER_ENABLED=false;

export function createFirebaseBrowserSdkAdapter({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId}){
 if(!auth||!firestore||!authSdk||!firestoreSdk)throw Error("Explicit Firebase instances and SDK modules required");
 if(typeof projectId!=="string"||!projectId.startsWith("demo-boustio-phase21")||
    projectId!==expectedProjectId||auth.app?.options?.projectId!==projectId||
    firestore.app?.options?.projectId!==projectId)
  throw Error("Phase 21 adapter requires matching isolated demo Firebase project");
 const requiredAuth=["onAuthStateChanged","onIdTokenChanged","getIdTokenResult"];
 const requiredDb=["doc","onSnapshot"];
 if(!requiredAuth.every(name=>typeof authSdk[name]==="function")||
    !requiredDb.every(name=>typeof firestoreSdk[name]==="function"))
  throw Error("Modular Firebase SDK functions required");
 const profileRef=uid=>{
  if(typeof uid!=="string"||!uid||uid.includes("/"))throw Error("Invalid owner UID");
  return firestoreSdk.doc(firestore,"users",uid,"business","profile");
 };
 return Object.freeze({
  onAuthStateChanged:(instance,listener)=>authSdk.onAuthStateChanged(instance,listener),
  onIdTokenChanged:(instance,listener)=>authSdk.onIdTokenChanged(instance,listener),
  getIdTokenResult:(user,forceRefresh)=>authSdk.getIdTokenResult(user,forceRefresh),
  doc:profileRef,
  onSnapshot:(ref,success,error)=>firestoreSdk.onSnapshot(ref,{includeMetadataChanges:true},success,error),
  auth
 });
}

// Call explicitly from isolated tests; never automatically connect to an emulator.
// This guard rejects production IDs and requires both emulators to be configured.
export function configureIsolatedFirebaseEmulators({auth,firestore,authSdk,firestoreSdk,projectId,authUrl,firestoreHost,firestorePort}){
 if(typeof projectId!=="string"||!projectId.startsWith("demo-boustio-phase21")||
    auth?.app?.options?.projectId!==projectId||firestore?.app?.options?.projectId!==projectId)
  throw Error("Isolated project mismatch");
 if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(authUrl)||
    !["127.0.0.1","localhost"].includes(firestoreHost)||
    !Number.isInteger(firestorePort)||firestorePort<1||firestorePort>65535)
  throw Error("Loopback Firebase emulator endpoints required");
 if(typeof authSdk?.connectAuthEmulator!=="function"||typeof firestoreSdk?.connectFirestoreEmulator!=="function")
  throw Error("Firebase emulator SDK connectors required");
 authSdk.connectAuthEmulator(auth,authUrl,{disableWarnings:true});
 firestoreSdk.connectFirestoreEmulator(firestore,firestoreHost,firestorePort);
}
