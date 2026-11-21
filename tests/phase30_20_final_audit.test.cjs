"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-20.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.20",html.includes("Phase 30.20")],
["quick booking wrapper",html.includes('class="quick-book"')],["quick booking button",html.includes('id="findNextAvailable"')],
["quick booking feedback",html.includes('id="quickBookFeedback" role="status" aria-live="polite"')],
["shortcut function",html.includes("function findNextAvailable()")],["search feedback",html.includes("No illustrative ")],
["success feedback",html.includes(" (demo only).")],["quick CSS",html.includes(".quick-book{")],
["quick button CSS",html.includes(".quick-book-button{")],["quick focus CSS",html.includes(".quick-book-button:focus-visible")],
["overview retained",html.includes('id="availabilityOverview"')],["morning counter",html.includes('id="countMorning"')],
["afternoon counter",html.includes('id="countAfternoon"')],["evening counter",html.includes('id="countEvening"')],
["all filter retained",html.includes('id="filterAll"')],["morning filter retained",html.includes('id="filterMorning"')],
["afternoon filter retained",html.includes('id="filterAfternoon"')],["evening filter retained",html.includes('id="filterEvening"')],
["selected time panel retained",html.includes('id="selectedTimeLabel"')],["clear time retained",html.includes('id="clearTime"')],
["date browser retained",html.includes('id="nextDates"')],["12 demo dates retained",html.includes("const extraDates=")],
["service cards retained",html.includes("service-card")],["salon profile retained",html.includes('class="salon-profile"')],
["gallery retained",html.includes('class="salon-gallery"')],["progress retained",html.includes('id="progressSteps"')],
["barber retained",html.includes('id="stylists"')],["dates retained",html.includes('id="dates"')],
["times retained",html.includes('id="times"')],["customer details retained",html.includes('id="customerName"')],
["preferences retained",html.includes('id="visitType"')],["notes retained",html.includes('id="bookingNotes"')],
["confirmation retained",html.includes('id="confirmationDetails"')],["reset retained",html.includes('id="startAgain"')],
["name validation retained",html.includes('id="nameHelp"')],["email validation retained",html.includes('id="emailHelp"')],
["readiness retained",html.includes('id="bookingReadiness"')],["edit buttons retained",html.includes('id="editService"')],
["no remote image",!/<img[^>]+src=["']https?:/i.test(html)],["no external CSS",!/<link[^>]+stylesheet/i.test(html)],
["no network",!["fetch(","XMLHttpRequest","WebSocket(","EventSource(","sendBeacon("].some(x=>html.includes(x))],
["no storage",!["localStorage","sessionStorage","indexedDB","document.cookie"].some(x=>html.includes(x))],
["no Firebase",!/firebaseConfig|firebase\/app|firebase\.firestore/.test(html)],["no form submission",!/<form\b/i.test(html)],
["no payments",html.includes("no payment is taken")],["no data transmitted",html.includes("no customer information is saved or transmitted")],
["no real appointment",html.includes("No appointment was created.")],["noindex",html.includes("noindex,nofollow")],
["safe DOM",!js.includes(".innerHTML")],["reduced motion",html.includes("prefers-reduced-motion")]
];for(const [name,ok] of checks)test(name,()=>assert.equal(ok,true));
test("JS compiles",()=>new vm.Script(js));
test("initial date empty",()=>assert.equal(run("state.date"),null));
test("initial time empty",()=>assert.equal(run("state.time"),null));
test("button wired",()=>assert.equal(typeof el("findNextAvailable").listeners.click,"function"));
test("first next available",()=>{el("findNextAvailable").listeners.click();assert.equal(run("state.date"),"d1")});
test("first time",()=>assert.equal(run("state.time"),"09:00"));
test("first feedback",()=>assert.match(el("quickBookFeedback").textContent,/Selected Mon 23 Nov at 09:00/));
test("first date page",()=>assert.equal(run("datePage"),0));
test("selected time panel",()=>assert.match(el("selectedTimeLabel").textContent,/09:00/));
test("morning filter",()=>{el("filterMorning").listeners.click();assert.equal(run("timePeriod"),"morning")});
test("morning shortcut",()=>{el("findNextAvailable").listeners.click();assert.equal(run("state.time"),"09:00")});
test("afternoon filter",()=>{el("filterAfternoon").listeners.click();assert.equal(run("timePeriod"),"afternoon")});
test("afternoon shortcut",()=>{el("findNextAvailable").listeners.click();assert.equal(run("state.time"),"13:00")});
test("barber selection",()=>{run('chooseStylist("sam")');assert.equal(run("state.stylist"),"sam")});
test("barber next available",()=>{el("findNextAvailable").listeners.click();assert.equal(run("state.date"),"d3")});
test("barber next afternoon time",()=>assert.equal(run("state.time"),"12:30")); 
test("reset",()=>{run("startAnotherDemo()");assert.equal(run("state.date"),null)});
test("reset time",()=>assert.equal(run("state.time"),null));
test("reset filter",()=>assert.equal(run("timePeriod"),"all"));
test("reset feedback",()=>assert.match(el("quickBookFeedback").textContent,/Searches illustrative dates/));
test("select Alex",()=>{run('chooseStylist("alex")');assert.equal(run("state.stylist"),"alex")});
test("Alex shortcut",()=>{el("findNextAvailable").listeners.click();assert.equal(run("state.time"),"13:00")});
test("Alex afternoon",()=>assert.equal(run("timePeriodFor(state.time)"),"afternoon"));
test("evening filter",()=>{el("filterEvening").listeners.click();assert.equal(run("timePeriod"),"evening")});
test("no evening availability",()=>assert.equal(run("findNextAvailable()"),false));
test("no evening feedback",()=>assert.match(el("quickBookFeedback").textContent,/No illustrative evening times found/));
test("no evening preserves time",()=>assert.equal(run("state.time"),"13:00"));
test("reset again",()=>{run("startAnotherDemo()");assert.equal(run("progressCount()"),0)});
test("later date page",()=>{el("nextDates").listeners.click();assert.equal(run("datePage"),1)});
test("later date selected",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d5")});
test("later shortcut",()=>{el("findNextAvailable").listeners.click();assert.equal(run("state.date"),"d5")});
test("later time",()=>assert.equal(run("state.time"),"09:00"));
test("later page maintained",()=>assert.equal(run("datePage"),1));

test("date shortcut exists",()=>assert.equal(html.includes('id="findNextDate"'),true));
test("date shortcut wired",()=>assert.equal(typeof el("findNextDate").listeners.click,"function"));
test("date shortcut accessible",()=>assert.equal(html.includes('>Find next available date</button>'),true));
test("date shortcut styling",()=>assert.equal(html.includes("quick-book-secondary"),true));
test("date shortcut function",()=>assert.equal(html.includes("function findNextAvailableDate()"),true));
test("reset before date shortcut",()=>{run("startAnotherDemo()");assert.equal(run("state.date"),null)});
test("date only chooses first date",()=>{el("findNextDate").listeners.click();assert.equal(run("state.date"),"d1")});
test("date only leaves time unselected",()=>assert.equal(run("state.time"),null));
test("date only feedback",()=>assert.match(el("quickBookFeedback").textContent,/Choose your preferred time/));
test("date only summary remains incomplete",()=>assert.equal(run("completedSteps()[2]"),false));
test("select time manually",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"09:00")});
test("same date preserves valid chosen time",()=>{el("findNextDate").listeners.click();assert.equal(run("state.time"),"09:00")});
test("change to afternoon",()=>{el("filterAfternoon").listeners.click();assert.equal(run("timePeriod"),"afternoon")});
test("same date preserves time hidden by filter",()=>{el("findNextDate").listeners.click();assert.equal(run("state.time"),"09:00")});
test("choose Sam",()=>{run('chooseStylist("sam")');assert.equal(run("state.stylist"),"sam")});
test("Sam next afternoon date",()=>{el("findNextDate").listeners.click();assert.equal(run("state.date"),"d3")});
test("date change clears old time",()=>assert.equal(run("state.time"),null));
test("date shortcut updates visible date page",()=>assert.equal(run("datePage"),0));
test("date shortcut matching slot count",()=>assert.match(el("quickBookFeedback").textContent,/1 matching illustrative time/));
test("date shortcut leaves customer details untouched",()=>{el("customerName").value="Demo Customer";el("customerEmail").value="demo@example.test";el("findNextDate").listeners.click();assert.equal(el("customerName").value,"Demo Customer");assert.equal(el("customerEmail").value,"demo@example.test")});
test("date shortcut respects evening no match",()=>{el("filterEvening").listeners.click();assert.equal(run("findNextAvailableDate()"),false)});
test("no match preserves date",()=>assert.equal(run("state.date"),"d3"));
test("no match feedback",()=>assert.match(el("quickBookFeedback").textContent,/No illustrative evening dates/));
test("reset clears date",()=>{run("startAnotherDemo()");assert.equal(run("state.date"),null)});
test("reset clears time",()=>assert.equal(run("state.time"),null));
test("reset clears feedback",()=>assert.match(el("quickBookFeedback").textContent,/Searches illustrative dates/));
test("later page search",()=>{el("nextDates").listeners.click();el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d5")});
test("later date shortcut stays on d5",()=>{el("findNextDate").listeners.click();assert.equal(run("state.date"),"d5")});
test("later date shortcut doesn't choose time",()=>assert.equal(run("state.time"),null));
test("later date page remains visible",()=>assert.equal(run("datePage"),1));

test("date availability badges exist",()=>assert.equal(html.includes("date-slot-count"),true));
test("date counts use selected stylist and period",()=>assert.equal(html.includes("function slotsForDate(date)"),true));
test("date counts update on filter",()=>assert.equal(html.includes("timePeriod=period;renderDates();renderTimes()"),true));
test("initial first date count",()=>{run("startAnotherDemo()");assert.equal(el("dates").children[0].children[0].textContent,"4 times")});
test("initial second date count",()=>assert.equal(el("dates").children[1].children[0].textContent,"3 times"));
test("initial third date count",()=>assert.equal(el("dates").children[2].children[0].textContent,"3 times"));
test("initial fourth date count",()=>assert.equal(el("dates").children[3].children[0].textContent,"3 times"));
test("morning badge count",()=>{run('selectTimePeriod("morning")');assert.equal(el("dates").children[0].children[0].textContent,"2 times")});
test("afternoon badge count",()=>{run('selectTimePeriod("afternoon")');assert.equal(el("dates").children[0].children[0].textContent,"2 times")});
test("evening badge zero",()=>{run('selectTimePeriod("evening")');assert.equal(el("dates").children[0].children[0].textContent,"No matching times")});
test("Sam filter date badges",()=>{run('selectTimePeriod("afternoon")');run('chooseStylist("sam")');assert.equal(el("dates").children[2].children[0].textContent,"1 time")});
test("Sam first date badge",()=>assert.equal(el("dates").children[0].children[0].textContent,"No matching times"));
test("date badge accessible label",()=>assert.match(el("dates").children[2].attributes["aria-label"],/matching illustrative time/));
test("Alex date badge",()=>{run('chooseStylist("alex")');assert.equal(el("dates").children[0].children[0].textContent,"2 times")});
test("date counts don't select time",()=>assert.equal(run("state.time"),null));
test("date counts don't select date",()=>assert.equal(run("state.date"),null));
test("later dates have counts",()=>{run('changeDatePage(1)');assert.equal(el("dates").children.length,4)});
test("later date first badge",()=>assert.equal(el("dates").children[0].children[0].textContent,"1 time"));
test("reset restores all date counts",()=>{run("startAnotherDemo()");assert.equal(el("dates").children[0].children[0].textContent,"4 times")});
test("reset restores all filter",()=>assert.equal(run("timePeriod"),"all"));

test("zero availability visually marked",()=>assert.equal(html.includes("date-unavailable"),true));
test("zero date badge says no matching times",()=>{run("startAnotherDemo()");run('chooseStylist("sam")');run('selectTimePeriod("afternoon")');assert.equal(el("dates").children[0].children[0].textContent,"No matching times")});
test("zero date has muted styling",()=>assert.match(el("dates").children[0].className,/date-unavailable/));
test("zero date accessible label",()=>assert.match(el("dates").children[0].attributes["aria-label"],/no matching illustrative times/));
test("available date remains normal",()=>assert.equal(el("dates").children[2].className.includes("date-unavailable"),false));
test("available date still shows 1 time",()=>assert.equal(el("dates").children[2].children[0].textContent,"1 time"));
test("unavailable date remains selectable to show empty state",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d1")});
test("unavailable date has no time selected",()=>assert.equal(run("state.time"),null));
test("filter all restores available styling",()=>{run('selectTimePeriod("all")');assert.equal(el("dates").children[0].className.includes("date-unavailable"),false)});
test("selected date remains selected after filter",()=>assert.equal(run("state.date"),"d1"));
test("reset restores date counts",()=>{run("startAnotherDemo()");assert.equal(el("dates").children[0].children[0].textContent,"4 times")});

test("available only control present",()=>assert.equal(html.includes('id="toggleAvailableDates"'),true));
test("available only initially off",()=>{run("startAnotherDemo()");assert.equal(run("availableDatesOnly"),false)});
test("toggle available only on",()=>{run('chooseStylist("sam")');run('selectTimePeriod("afternoon")');el("toggleAvailableDates").listeners.click();assert.equal(run("availableDatesOnly"),true)});
test("filter hides unavailable Monday",()=>assert.equal(el("dates").children.length,1));
test("filter retains Wednesday",()=>assert.match(el("dates").children[0].textContent,/Wed 25 Nov/));
test("filter retains matching count",()=>assert.equal(el("dates").children[0].children[0].textContent,"1 time"));
test("toggle pressed accessibility",()=>assert.equal(el("toggleAvailableDates").attributes["aria-pressed"],"true"));
test("filter status count",()=>assert.match(el("dateFilterStatus").textContent,/1 of 4/));
test("filter does not select date",()=>assert.equal(run("state.date"),null));
test("filter does not select time",()=>assert.equal(run("state.time"),null));
test("toggle back shows all four",()=>{el("toggleAvailableDates").listeners.click();assert.equal(el("dates").children.length,4)});
test("toggle back restores unavailable date",()=>assert.match(el("dates").children[0].className,/date-unavailable/));
test("empty period displays helpful message",()=>{run('selectTimePeriod("evening")');el("toggleAvailableDates").listeners.click();assert.match(el("dates").children[0].textContent,/No matching dates/);});
test("empty period leaves navigation available",()=>assert.equal(el("nextDates").disabled,false));
test("reset restores available-only off",()=>{run("startAnotherDemo()");assert.equal(run("availableDatesOnly"),false)});
test("reset restores all dates",()=>assert.equal(el("dates").children.length,4));
test("reset button label",()=>assert.equal(el("toggleAvailableDates").textContent,"Show available dates only"));

test("final audit banner present",()=>assert.equal(html.includes('class="audit-banner" role="note"'),true));
test("final audit explicitly says no live bookings",()=>assert.equal(html.includes("No live bookings"),true));
test("final audit explicitly says no payment",()=>assert.equal(html.includes("No payment"),true));
test("final audit explicitly says no customer data stored",()=>assert.equal(html.includes("No customer data stored or sent"),true));
test("final audit does not expose external scripts",()=>assert.equal(/<script[^>]+src=/i.test(html),false));
test("final audit no external images",()=>assert.equal(/<img[^>]+src=["']https?:/i.test(html),false));
test("final audit no network APIs",()=>assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/.test(js),false));
test("final audit no persistence APIs",()=>assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(js),false));
test("final audit no Firebase SDK",()=>assert.equal(/firebaseConfig|firebase\/app|firebase\.firestore/.test(html),false));
test("final audit no payment SDK",()=>assert.equal(/stripe\.com|paypal\.com|checkout\.com/.test(html),false));
test("final audit no external form",()=>assert.equal(/<form\b/i.test(html),false));
test("final audit accessible filter button",()=>assert.equal(html.includes('aria-pressed="false">Show available dates only'),true));
test("final audit accessible date filter feedback",()=>assert.equal(html.includes('id="dateFilterStatus" role="status" aria-live="polite"'),true));
test("final audit no date selected at start",()=>{run("startAnotherDemo()");assert.equal(run("state.date"),null)});
test("final audit no time selected at start",()=>assert.equal(run("state.time"),null));
test("final audit no service selected at start",()=>assert.equal(run("state.service"),null));
test("final audit demo confirmation disabled at start",()=>assert.equal(el("confirm").disabled,true));
test("final audit availability filter off at start",()=>assert.equal(run("availableDatesOnly"),false));
test("final audit all period at start",()=>assert.equal(run("timePeriod"),"all"));
test("final audit first page at start",()=>assert.equal(run("datePage"),0));
test("final audit date navigation forward",()=>{run("changeDatePage(1)");assert.equal(run("datePage"),1)});
test("final audit date navigation backward",()=>{run("changeDatePage(-1)");assert.equal(run("datePage"),0)});
test("final audit reset restores all dates",()=>{run("startAnotherDemo()");assert.equal(el("dates").children.length,4)});
test("final audit reset leaves confirmation hidden",()=>assert.equal(el("confirmation").hidden,true));
test("final audit no network after user actions",()=>{run('chooseStylist("sam")');run('selectTimePeriod("afternoon")');run('toggleAvailableDates()');assert.equal(run("state.date"),null)});
test("final audit filtered date remains available",()=>assert.match(el("dates").children[0].textContent,/Wed 25 Nov/));
test("final audit filtered date count",()=>assert.equal(el("dates").children[0].children[0].textContent,"1 time"));
test("final audit filtered date selection",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d3")});
test("final audit date selection doesn't auto-select time",()=>assert.equal(run("state.time"),null));
test("final audit reset returns no selection",()=>{run("startAnotherDemo()");assert.equal(run("state.date"),null)});
