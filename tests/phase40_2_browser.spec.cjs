"use strict";
const {test,expect}=require("@playwright/test");
const path=require("node:path");
test.beforeEach(async({page})=>{
 await page.goto("about:blank");
 await page.setContent('<main id="root"></main>');
 await page.addScriptTag({path:path.resolve(__dirname,"../web/phase40/browser-dashboard-40-2.js")});
 await page.evaluate(()=>{
  window.mock={auth:{currentUser:null},observer:null,unsubscribeCount:0,stopCount:0,refreshes:[],view:{state:"UNAVAILABLE"},sub:null};
  const m=window.mock;
  m.vm={
   subscribe(fn){m.sub=fn;fn(m.view);return()=>{m.sub=null}},
   userChanged(user){m.view={state:"UNAVAILABLE"};m.sub?.(m.view)},
   signOut(){m.view={state:"UNAVAILABLE"};m.sub?.(m.view)},
   refresh(){let resolve;const promise=new Promise(r=>resolve=r);m.refreshes.push(resolve);return promise.then(view=>{m.view=view;m.sub?.(view);return view})},
   stop(){m.stopCount++}
  };
  m.adapter=BoustioIsolatedDashboard40_2.mountIsolatedDashboard({element:document.getElementById("root"),auth:m.auth,onAuthStateChanged:(_auth,callback,error)=>{m.observer=callback;m.error=error;return()=>m.unsubscribeCount++},viewModel:m.vm});
  m.ready=name=>({state:"READY",business:{name},services:[{name:"Cut"}],staff:[{name:"Alex"}]});
  m.login=id=>{const u={uid:id};m.auth.currentUser=u;m.observer(u)};
 });
});
test("mount starts private-data-free with accessible unavailable status",async({page})=>{await expect(page.getByRole("status")).toHaveText("Business dashboard unavailable");await expect(page.locator("[aria-busy=false]")).toHaveCount(1);await expect(page.locator("h2")).toHaveCount(0)});
test("verified synthetic account renders labels with textContent, never HTML",async({page})=>{await page.evaluate(()=>window.mock.login("owner"));await expect.poll(()=>page.evaluate(()=>window.mock.refreshes.length)).toBe(1);await page.evaluate(()=>window.mock.refreshes[0](window.mock.ready("<script>unsafe</script>")));await expect(page.getByRole("heading",{name:"<script>unsafe</script>"})).toBeVisible();await expect(page.locator("script")).toHaveCount(1);await expect(page.getByRole("status")).toHaveText("Business dashboard loaded")});
test("account switch immediately clears prior owner and fences late refresh",async({page})=>{await page.evaluate(()=>window.mock.login("owner"));await expect.poll(()=>page.evaluate(()=>window.mock.refreshes.length)).toBe(1);await page.evaluate(()=>window.mock.refreshes[0](window.mock.ready("Owner A")));await expect(page.getByRole("heading",{name:"Owner A"})).toBeVisible();await page.evaluate(()=>window.mock.login("other"));await expect(page.getByRole("heading",{name:"Owner A"})).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>window.mock.refreshes.length)).toBe(2);await page.evaluate(()=>window.mock.refreshes[1](window.mock.ready("Owner B")));await expect(page.getByRole("heading",{name:"Owner B"})).toBeVisible()});
test("sign out immediately removes business details",async({page})=>{await page.evaluate(()=>window.mock.login("owner"));await expect.poll(()=>page.evaluate(()=>window.mock.refreshes.length)).toBe(1);await page.evaluate(()=>window.mock.refreshes[0](window.mock.ready("Private Salon")));await expect(page.getByRole("heading",{name:"Private Salon"})).toBeVisible();await page.evaluate(()=>{window.mock.auth.currentUser=null;window.mock.observer(null)});await expect(page.getByRole("heading",{name:"Private Salon"})).toHaveCount(0)});
test("unmount detaches observers, clears DOM and blocks late updates",async({page})=>{await page.evaluate(()=>window.mock.login("owner"));await expect.poll(()=>page.evaluate(()=>window.mock.refreshes.length)).toBe(1);await page.evaluate(()=>{window.mock.adapter.unmount();window.mock.refreshes[0](window.mock.ready("Leaked Salon"))});await expect(page.locator("#root")).toBeEmpty();expect(await page.evaluate(()=>[window.mock.unsubscribeCount,window.mock.stopCount])).toEqual([1,1])});
test("observer error fails closed",async({page})=>{await page.evaluate(()=>window.mock.login("owner"));await expect.poll(()=>page.evaluate(()=>window.mock.refreshes.length)).toBe(1);await page.evaluate(()=>window.mock.error(new Error("auth_error")));await expect(page.getByRole("status")).toHaveText("Business dashboard unavailable");await expect(page.locator("h2")).toHaveCount(0)});
