const test = require('node:test');
const assert = require('node:assert/strict');
const { dueMeta, chinaDay, diffDays, DUE_OPTIONS } = require('../miniprogram/utils/due');

test('chinaDay converts stored timestamps to China calendar days', () => {
  assert.equal(chinaDay('2026-10-21T16:00:00.000Z'), '2026-10-22');
  assert.equal(chinaDay('2026-10-22T15:59:59.000Z'), '2026-10-22');
  assert.equal(chinaDay(''), '');
  assert.equal(chinaDay('not-a-date'), '');
});

test('diffDays counts natural days across month and year boundaries', () => {
  assert.equal(diffDays('2026-10-22', '2026-10-22'), 0);
  assert.equal(diffDays('2026-10-22', '2026-10-25'), 3);
  assert.equal(diffDays('2026-10-25', '2026-10-22'), -3);
  assert.equal(diffDays('2026-12-31', '2027-01-01'), 1);
});

test('dueMeta labels overdue, today, tomorrow and later plans', () => {
  assert.equal(dueMeta(null, '2026-10-22').level, 'none');
  assert.deepEqual(dueMeta('2026-10-18T16:00:00.000Z', '2026-10-22'),
    { level: 'overdue', text: '逾期 3 天', day: '2026-10-19' });
  assert.equal(dueMeta('2026-10-21T16:00:00.000Z', '2026-10-22').text, '今日待跟进');
  assert.equal(dueMeta('2026-10-22T16:00:00.000Z', '2026-10-22').text, '明日待跟进');
  assert.equal(dueMeta('2026-10-25T16:00:00.000Z', '2026-10-22').text, '10-26 待跟进');
});

test('due filter options keep the empty value first', () => {
  assert.equal(DUE_OPTIONS[0].value, '');
  assert.deepEqual(DUE_OPTIONS.map(option => option.value), ['', 'today', 'overdue', 'week']);
});
