/**
 * 号码解析：批量录入时把主播粘贴的文本整理成可入库的电话号码。
 * 纯函数，便于本地测试，不依赖云 SDK。
 */

const MAX_BATCH = 100;
const MIN_DIGITS = 5;
const MAX_DIGITS = 15;

/**
 * 归一化单个号码：去掉空格、连字符、括号等常见分隔符，保留可选前导 +。
 * 无法识别时返回空字符串。
 */
function normalizePhone(value) {
  if (typeof value !== 'string') return '';
  // 全角数字/符号先转半角
  const halfWidth = value.replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const compact = halfWidth.replace(/[\s\-()（）.．·]/g, '');
  if (!compact) return '';
  if (!/^\+?\d+$/.test(compact)) return '';
  const digits = compact.replace(/\D/g, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return '';
  return compact;
}

/**
 * 解析批量输入（字符串或数组），按出现顺序去重。
 * @returns {{valid: string[], invalid: string[], repeated: string[]}}
 */
function parsePhones(input) {
  let raw = [];
  if (typeof input === 'string') {
    raw = input.split(/[\n\r,;、，；|]+/);
  } else if (Array.isArray(input)) {
    raw = input;
  } else {
    return { valid: [], invalid: [], repeated: [] };
  }

  const valid = [];
  const invalid = [];
  const repeated = [];
  const seen = new Set();
  for (const item of raw) {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!text) continue;
    const phone = normalizePhone(text);
    if (!phone) {
      invalid.push(text.slice(0, 32));
      continue;
    }
    if (seen.has(phone)) {
      repeated.push(phone);
      continue;
    }
    seen.add(phone);
    valid.push(phone);
  }
  return { valid, invalid, repeated };
}

module.exports = { normalizePhone, parsePhones, MAX_BATCH, MIN_DIGITS, MAX_DIGITS };
