const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFilters, dueConditions, chinaToday, DUE_OPTIONS } = require('../cloudfunctions/leadList/filters');

const db = { command: {}, RegExp: value => ({ regex: value }) };
for (const key of ['and', 'or', 'gte', 'lt', 'nin', 'exists']) db.command[key] = value => ({ [key]: value });
const scope = { groupId: 1 };

test('chinaToday ignores the server timezone', () => {
  // 2026-10-21T16:30:00Z 在中国是 2026-10-22 00:30
  assert.equal(chinaToday(Date.parse('2026-10-21T16:30:00Z')), '2026-10-22');
  assert.equal(chinaToday(Date.parse('2026-10-21T15:30:00Z')), '2026-10-21');
});

test('overdue filter uses China midnight and excludes closed deals', () => {
  const conditions = dueConditions(db, 'overdue', '2026-10-22');
  assert.equal(conditions[0].nextFollowUpAt.lt.toISOString(), '2026-10-21T16:00:00.000Z');
  // 成交/流失的线索不再提醒
  assert.deepEqual(conditions[1].or[0].lastStatus.nin, ['WON', 'LOST']);
  assert.equal(conditions[1].or[1].lastStatus.exists, false);
});

test('today filter is a half-open range covering one China day', () => {
  const [start, end] = dueConditions(db, 'today', '2026-10-22');
  assert.equal(start.nextFollowUpAt.gte.toISOString(), '2026-10-21T16:00:00.000Z');
  assert.equal(end.nextFollowUpAt.lt.toISOString(), '2026-10-22T16:00:00.000Z');
});

test('week filter spans today plus six days', () => {
  const [start, end] = dueConditions(db, 'week', '2026-10-22');
  assert.equal(start.nextFollowUpAt.gte.toISOString(), '2026-10-21T16:00:00.000Z');
  assert.equal(end.nextFollowUpAt.lt.toISOString(), '2026-10-28T16:00:00.000Z');
});

test('empty due filter adds no conditions and keeps the scope intact', () => {
  for (const due of [undefined, '', ...DUE_OPTIONS.filter(option => option === '')]) {
    const result = buildFilters(db, scope, { due }, { today: '2026-10-22' });
    assert.deepEqual(result.query, scope);
  }
  assert.deepEqual(dueConditions(db, '', '2026-10-22'), []);
});

test('unknown due values are rejected before reaching the database', () => {
  for (const due of ['yesterday', 123, {}, 'TODAY']) {
    assert.throws(() => buildFilters(db, scope, { due }, { today: '2026-10-22' }), /待跟进筛选无效/);
  }
});

test('due filter keeps group scope outside the OR clause', () => {
  const { query } = buildFilters(db, { groupId: 2, assignedSalesIds: 'sales' },
    { due: 'overdue', keyword: '138' }, { today: '2026-10-22' });
  assert.deepEqual(query.and[0], { groupId: 2, assignedSalesIds: 'sales' });
  assert.equal(query.and.length, 4); // scope + keyword + overdue range + terminal exclusion
});
