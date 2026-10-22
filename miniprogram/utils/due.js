/**
 * 「下次跟进」相关的纯函数：日期换算与展示文案。
 * 中国日历日换算不依赖设备时区。
 */

const DUE_OPTIONS = [
  { label: '全部待跟进', value: '' },
  { label: '今日待跟进', value: 'today' },
  { label: '已逾期', value: 'overdue' },
  { label: '未来7天', value: 'week' }
];

const DAY_MS = 86400000;

/** 把任意时间值转成中国日历日 YYYY-MM-DD */
function chinaDay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

function today(now) {
  return chinaDay(now === undefined ? Date.now() : now);
}

/** 两个 YYYY-MM-DD 之间相差的自然日数（后者减前者） */
function diffDays(fromDay, toDay) {
  const toNumber = text => {
    const parts = String(text || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return NaN;
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  };
  const from = toNumber(fromDay);
  const to = toNumber(toDay);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return NaN;
  return Math.round((to - from) / DAY_MS);
}

/**
 * 待跟进展示信息
 * level: none | overdue | today | soon | future
 */
function dueMeta(nextFollowUpAt, todayDay) {
  const day = chinaDay(nextFollowUpAt);
  if (!day) return { level: 'none', text: '', day: '' };
  const base = todayDay || today();
  const gap = diffDays(base, day);
  if (!Number.isFinite(gap)) return { level: 'future', text: day.slice(5) + ' 待跟进', day };
  if (gap < 0) return { level: 'overdue', text: '逾期 ' + (-gap) + ' 天', day };
  if (gap === 0) return { level: 'today', text: '今日待跟进', day };
  if (gap === 1) return { level: 'soon', text: '明日待跟进', day };
  return { level: 'future', text: day.slice(5) + ' 待跟进', day };
}

module.exports = { DUE_OPTIONS, chinaDay, today, diffDays, dueMeta };
