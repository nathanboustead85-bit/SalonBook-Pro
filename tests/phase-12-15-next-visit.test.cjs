// Phase 12.15 — read-only next scheduled visit regression.
// Run: node tests/phase-12-15-next-visit.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/java/com/salonbook/pro/MainActivity.kt'), 'utf8');
const start = source.indexOf('// Phase 12.15: read-only next scheduled visit.');
const end = source.indexOf('// Phase 12.13:', start);
assert.ok(start !== -1 && end > start, 'Next scheduled visit panel exists');
const panel = source.slice(start, end);
assert.match(panel, /history\.filter\s*\{\s*it\.date\s*>=\s*today\(\)\s*\}/, 'Past dates excluded');
assert.match(panel, /sortedWith\(compareBy<Booking>\s*\{\s*it\.date\s*\}\.thenBy\s*\{\s*it\.time\s*\}\)/, 'Earliest date and time first');
assert.match(panel, /\.firstOrNull\(\)/, 'Handles no matching appointments');
assert.match(panel, /nextScheduledVisit\s*==\s*null/, 'Empty state');
assert.match(panel, /NEXT SCHEDULED VISIT/, 'Visible heading');
assert.match(panel, /View the calendar for full details/, 'Navigation guidance');
assert.doesNotMatch(panel, /(?:\.set\(|\.update\(|\.delete\(|\.add\(|prefs\.edit\(|saveBookings\(|\.commit\()/, 'No writes in panel');

function nextVisit(history, today) {
  return history.filter(b => b.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] ?? null;
}
const originals = [
  {id:'original-1', date:'2026-11-13', time:'14:00', service:'Cut'},
  {id:'original-2', date:'2026-11-13', time:'09:00', service:'Trim'}
];
const snapshot = JSON.stringify(originals);
assert.equal(nextVisit(originals, '2026-11-12').id, 'original-2', 'Earlier time wins on same date');
assert.equal(nextVisit([{id:'past',date:'2026-11-11',time:'17:00'}, ...originals], '2026-11-12').id, 'original-2', 'Past visit excluded');
assert.equal(nextVisit(originals, '2026-11-14'), null, 'Empty upcoming state');
assert.equal(nextVisit([{id:'today',date:'2026-11-12',time:'08:00'}, ...originals], '2026-11-12').id, 'today', 'Today included');
assert.equal(JSON.stringify(originals), snapshot, 'Original bookings unchanged');
console.log('Phase 12.15: all next-visit regression assertions passed.');
