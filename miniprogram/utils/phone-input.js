/**
 * 批量录入用的号码解析（与云函数 leadCreateBatch/phones.js 保持一致）。
 * 放在小程序端只用于实时预览，最终校验仍以云函数为准。
 */

const MAX_BATCH = 100;
const MIN_DIGITS = 5;
const MAX_DIGITS = 15;

function normalizePhone(value) {
  if (typeof value !== 'string') return '';
  const halfWidth = value.replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const compact = halfWidth.replace(/[\s\-()（）.．·]/g, '');
  if (!compact) return '';
  if (!/^\+?\d+$/.test(compact)) return '';
  const digits = compact.replace(/\D/g, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return '';
  return compact;
}

function parsePhones(input) {
  let raw = [];
  if (typeof input === 'string') raw = input.split(/[\n\r,;、，；|]+/);
  else if (Array.isArray(input)) raw = input;
  else return { valid: [], invalid: [], repeated: [] };

  const valid = [];
  const invalid = [];
  const repeated = [];
  const seen = new Set();
  for (const item of raw) {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!text) continue;
    const phone = normalizePhone(text);
    if (!phone) { invalid.push(text.slice(0, 32)); continue; }
    if (seen.has(phone)) { repeated.push(phone); continue; }
    seen.add(phone);
    valid.push(phone);
  }
  return { valid, invalid, repeated };
}

/** 输入时的即时统计，用于界面提示 */
function summarizeBatch(input) {
  const parsed = parsePhones(input);
  return {
    validCount: parsed.valid.length,
    invalidCount: parsed.invalid.length,
    repeatedCount: parsed.repeated.length,
    overLimit: parsed.valid.length > MAX_BATCH,
    preview: parsed.valid.slice(0, 5)
  };
}

module.exports = { normalizePhone, parsePhones, summarizeBatch, MAX_BATCH };
