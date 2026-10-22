const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFilters, day } = require('../cloudfunctions/leadList/filters');
const { toCsv, cleanPreferences } = require('../miniprogram/utils/lead-tools');
const db = { command: {}, RegExp: value => ({ regex: value }) };
for (const key of ['and', 'or', 'gte', 'lt', 'exists']) db.command[key] = value => ({ [key]: value });
const scope = { groupId: 2, assignedSalesIds: 'sales' };

test('keyword search is literal and keeps group scope outside OR clauses', () => {
  const { query } = buildFilters(db, scope, { keyword: 'a.*[x]' });
  assert.deepEqual(query.and[0], scope);
  assert.equal(query.and[1].or[0].phone.regex.regexp, 'a\\.\\*\\[x\\]');
  assert.equal(query.and[1].or[1].customerName.regex.options, 'i');
  assert.equal(query.and[1].or[2].remarks.regex.options, 'i');
});
test('sort whitelist rejects arbitrary fields and prototype keys', () => {
  assert.deepEqual(buildFilters(db, scope, { sort: 'mostFollowed' }).order, ['followUpCount', 'desc']);
  for (const sort of ['phone', 'constructor', '__proto__']) assert.throws(() => buildFilters(db, scope, { sort }));
});
test('China calendar date range includes whole end day', () => {
  const { query } = buildFilters(db, scope, { createdFrom: '2026-10-01', createdTo: '2026-10-22' });
  assert.equal(query.and[1].createdAt.gte.toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(query.and[2].createdAt.lt.toISOString(), '2026-10-22T16:00:00.000Z');
  assert.throws(() => day('2025-02-29'));
  assert.throws(() => buildFilters(db, scope, { createdFrom: '2026-10-22', createdTo: '2026-10-01' }));
});
test('unfollowed supports zero and missing historical counts', () => {
  assert.deepEqual(buildFilters(db, scope, { unfollowed: true }).query.and[1],
    { or: [{ followUpCount: 0 }, { followUpCount: { exists: false } }] });
});
test('detail ID narrows permissions instead of bypassing them', () => {
  assert.deepEqual(buildFilters(db, scope, { leadId: 'beyond-first-page' }).query.and,
    [scope, { _id: 'beyond-first-page' }]);
});
test('invalid search and filter values fail early', () => {
  for (const params of [{ keyword: {} }, { keyword: 'a'.repeat(81) }, { unfollowed: 'true' }, { leadId: '' }]) {
    assert.throws(() => buildFilters(db, scope, params));
  }
});
test('CSV preserves quotes, Chinese and newlines and blocks formula cells', () => {
  const csv = toCsv([{ phone: '+861234', remarks: ' =1+1', assignedSalesNames: '小明,"测试"\n换行' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'+861234"'));
  assert.ok(csv.includes('"\' =1+1"'));
  assert.ok(csv.includes('"小明,""测试""\n换行"'));
});
test('preferences do not persist keywords, customer data or invalid indexes', () => {
  const value = cleanPreferences({ keyword: 'private phone', leads: ['secret'], statusIndex: 100, sortIndex: -1, unfollowed: true });
  assert.equal(value.statusIndex, 0);
  assert.equal(value.sortIndex, 0);
  assert.equal(value.unfollowed, true);
  assert.equal(value.keyword, undefined);
  assert.equal(value.leads, undefined);
});
