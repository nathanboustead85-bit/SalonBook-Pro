const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const portfolio = source.slice(source.indexOf('private fun showLocalPortfolio()'),source.indexOf('private fun showFeaturePreview(id: String)'));
test('portfolio drafts use dedicated local storage and stale edit guard',()=>{
 assert.match(portfolio,/local_portfolio_drafts_v1/);
 assert.match(portfolio,/prefs.getString\(key, null\) != raw/);
 assert.match(portfolio,/putString\(key, updated.toString\(\)\)/);
 assert.doesNotMatch(portfolio,/Firebase|https:\/\/|putString\("bookings"/);
});
test('staff association and explicit delete confirmation',()=>{
 assert.match(portfolio,/readRecords\("staff"\)/);
 assert.match(portfolio,/item.put\("staffId"/);
 assert.match(portfolio,/Delete portfolio draft\?/);
 assert.match(portfolio,/updated.remove\(i\)/);
 assert.match(portfolio,/name.isBlank\(\)/);
});
