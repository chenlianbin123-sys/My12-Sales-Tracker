const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInput } = require('../cloudfunctions/followUpCreate/validation');
const base = { leadId: 'example', followUpDate: '2024-02-29', status: 'CONTACTED' };

test('accepts real calendar dates and supported status values', () => {
  for (const status of ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']) {
    assert.equal(validateInput({ ...base, status, advanceToNext: false, remarks: '' }), null);
  }
});

test('rejects rolled-over dates, unknown states and malformed values', () => {
  for (const patch of [{ followUpDate: '2025-02-29' }, { followUpDate: '2026-04-31' },
    { followUpDate: '2026-1-1' }, { followUpDate: '2026-01-01T00:00:00Z' },
    { status: 'OTHER' }, { leadId: {} }, { remarks: [] }, { advanceToNext: 'false' }]) {
    assert.equal(typeof validateInput({ ...base, ...patch }), 'string');
  }
  assert.equal(typeof validateInput(null), 'string');
});

test('rejects future follow-up dates so the reminder cannot be corrupted', () => {
  const today = '2026-10-22';
  assert.equal(validateInput({ ...base, followUpDate: '2026-10-22' }, { today }), null);
  assert.equal(typeof validateInput({ ...base, followUpDate: '2026-10-23' }, { today }), 'string');
  assert.equal(typeof validateInput({ ...base, followUpDate: '2099-01-01' }, { today }), 'string');
  // 补录历史记录仍然允许
  assert.equal(validateInput({ ...base, followUpDate: '2026-10-01' }, { today }), null);
});

test('next follow-up date must be a real day and not earlier than this follow-up', () => {
  const today = '2026-10-22';
  const event = { ...base, followUpDate: '2026-10-20' };
  assert.equal(validateInput({ ...event, nextFollowUpDate: '2026-10-25' }, { today }), null);
  assert.equal(validateInput({ ...event, nextFollowUpDate: '' }, { today }), null);
  assert.equal(validateInput({ ...event, nextFollowUpDate: undefined }, { today }), null);
  assert.equal(typeof validateInput({ ...event, nextFollowUpDate: '2026-10-19' }, { today }), 'string');
  assert.equal(typeof validateInput({ ...event, nextFollowUpDate: '2025-02-29' }, { today }), 'string');
  assert.equal(typeof validateInput({ ...event, nextFollowUpDate: 20261025 }, { today }), 'string');
});
