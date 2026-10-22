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
