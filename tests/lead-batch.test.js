const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, parsePhones, MAX_BATCH } = require('../cloudfunctions/leadCreateBatch/phones');
const mini = require('../miniprogram/utils/phone-input');

test('normalizePhone strips common separators and keeps the optional prefix', () => {
  assert.equal(normalizePhone('138 0000 0001'), '13800000001');
  assert.equal(normalizePhone('138-0000-0002'), '13800000002');
  assert.equal(normalizePhone('（138）0000-0003'), '13800000003');
  assert.equal(normalizePhone('+86 13800000004'), '+8613800000004');
  assert.equal(normalizePhone('１３８０００００００１'), '13800000001');
});

test('normalizePhone rejects text, short numbers and non-strings', () => {
  for (const value of ['', '   ', 'abc', '138abc', '1234', '1234567890123456', null, undefined, 13800000000]) {
    assert.equal(normalizePhone(value), '');
  }
});

test('parsePhones splits mixed separators, dedupes and reports problems', () => {
  const result = parsePhones('13800000001\n13800000002, 13800000001；\n  &#\n138-0000-0003、abc');
  assert.deepEqual(result.valid, ['13800000001', '13800000002', '13800000003']);
  assert.deepEqual(result.repeated, ['13800000001']);
  assert.ok(result.invalid.includes('&#'));
  assert.ok(result.invalid.includes('abc'));
});

test('parsePhones accepts arrays and ignores blanks', () => {
  const result = parsePhones([' 13800000001 ', '', '13800000001']);
  assert.deepEqual(result.valid, ['13800000001']);
  assert.deepEqual(result.repeated, ['13800000001']);
  assert.deepEqual(parsePhones(undefined).valid, []);
});

test('client preview matches the cloud parser for the same input', () => {
  const input = '13800000001\n138-0000-0002\n13800000001\nxyz';
  const server = parsePhones(input);
  const client = mini.parsePhones(input);
  assert.deepEqual(client.valid, server.valid);
  assert.deepEqual(client.invalid, server.invalid);
  assert.deepEqual(client.repeated, server.repeated);
});

test('summarizeBatch flags the batch size limit', () => {
  const phones = Array.from({ length: MAX_BATCH + 1 }, (_, i) => '1380000' + String(1000 + i));
  const summary = mini.summarizeBatch(phones.join('\n'));
  assert.equal(summary.validCount, MAX_BATCH + 1);
  assert.equal(summary.overLimit, true);
  assert.equal(summary.preview.length, 5);

  const small = mini.summarizeBatch('13800000001\n13800000002');
  assert.equal(small.validCount, 2);
  assert.equal(small.overLimit, false);
});
