"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
test("12.1 premium teal and forest design tokens",()=>{assert.match(src,/private val orange = Color\.rgb\(17, 107, 104\)/);assert.match(src,/private val dark = Color\.rgb\(23, 51, 50\)/);assert.match(src,/private val premiumGold = Color\.rgb\(217, 173, 116\)/);});
test("12.1 ivory canvas and subtle borders",()=>{assert.match(src,/private val background = Color\.rgb\(247, 248, 246\)/);assert.match(src,/private val lightBorder = Color\.rgb\(223, 230, 225\)/);});
test("12.1 comfortable touch targets and navigation",()=>{assert.match(src,/button\.minHeight = dp\(48\)/);assert.match(src,/LayoutParams\(-1, dp\(74\)\)/);});
test("12.1 shared typography and corner radius",()=>{assert.match(src,/sans-serif-medium/);assert.match(src,/private fun rounded\(colour: Int, radius: Int = 20\)/);});
test("12.1 existing booking persistence and cloud safety functions preserved",()=>{assert.match(src,/private fun saveBookings\(/);assert.match(src,/private fun showSharedCloudAppointments\(/);assert.match(src,/private fun showCalendar\(/);});
