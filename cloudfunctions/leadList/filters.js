const SORTS = {
  newest: ['createdAt', 'desc'], oldest: ['createdAt', 'asc'],
  recent: ['lastFollowUpAt', 'desc'], mostFollowed: ['followUpCount', 'desc']
};

// Closed deals no longer need a follow-up reminder.
const TERMINAL_STATUSES = ['WON', 'LOST'];
const DUE_OPTIONS = ['', 'today', 'overdue', 'week'];
const DAY_MS = 86400000;

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期须为 YYYY-MM-DD');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('日期无效');
  // UI dates represent calendar days in China, independent of server timezone.
  return new Date(value + 'T00:00:00+08:00');
}

/**
 * China calendar day for "now", independent of the server timezone.
 * Cloud functions may run in UTC, so local getDate() must not be used here.
 */
function chinaToday(now) {
  const timestamp = now === undefined ? Date.now() : now;
  const shifted = new Date(timestamp + 8 * 3600000);
  if (!Number.isFinite(shifted.getTime())) throw new Error('当前时间无效');
  return shifted.toISOString().slice(0, 10);
}

/**
 * Build the "pending follow-up" conditions.
 * today   : planned date is today
 * overdue : planned date is before today
 * week    : planned date is within the next 7 days (today included)
 */
function dueConditions(db, due, today) {
  if (due === undefined || due === '') return [];
  if (typeof due !== 'string' || !DUE_OPTIONS.includes(due)) throw new Error('待跟进筛选无效');
  const start = day(today);
  const conditions = [];
  if (due === 'today') {
    conditions.push({ nextFollowUpAt: db.command.gte(start) });
    conditions.push({ nextFollowUpAt: db.command.lt(new Date(start.getTime() + DAY_MS)) });
  } else if (due === 'week') {
    conditions.push({ nextFollowUpAt: db.command.gte(start) });
    conditions.push({ nextFollowUpAt: db.command.lt(new Date(start.getTime() + 7 * DAY_MS)) });
  } else {
    conditions.push({ nextFollowUpAt: db.command.lt(start) });
  }
  // Historic leads may carry status but no lastStatus.
  conditions.push(db.command.or([
    { lastStatus: db.command.nin(TERMINAL_STATUSES) },
    { lastStatus: db.command.exists(false), status: db.command.nin(TERMINAL_STATUSES) }
  ]));
  return conditions;
}

function buildFilters(db, scope, event, options = {}) {
  const conditions = [scope];
  const sortKey = event.sort === undefined ? 'newest' : event.sort;
  if (typeof sortKey !== 'string' || !Object.prototype.hasOwnProperty.call(SORTS, sortKey)) throw new Error('排序选项无效');
  if (event.leadId !== undefined) {
    if (typeof event.leadId !== 'string' || !event.leadId.trim()) throw new Error('线索ID无效');
    conditions.push({ _id: event.leadId });
  }
  if (event.keyword !== undefined && typeof event.keyword !== 'string') throw new Error('关键词须为文本');
  const keyword = (event.keyword || '').trim();
  if (keyword.length > 80) throw new Error('关键词最多80个字符');
  if (keyword) {
    const literal = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push(db.command.or([
      { phone: db.RegExp({ regexp: literal, options: 'i' }) },
      { customerName: db.RegExp({ regexp: literal, options: 'i' }) },
      { remarks: db.RegExp({ regexp: literal, options: 'i' }) }
    ]));
  }
  if (event.createdFrom) conditions.push({ createdAt: db.command.gte(day(event.createdFrom)) });
  if (event.createdTo) conditions.push({ createdAt: db.command.lt(new Date(day(event.createdTo).getTime() + 86400000)) });
  if (event.createdFrom && event.createdTo && event.createdFrom > event.createdTo) throw new Error('开始日期不能晚于结束日期');
  if (event.unfollowed !== undefined && typeof event.unfollowed !== 'boolean') throw new Error('未跟进选项须为布尔值');
  if (event.unfollowed) conditions.push(db.command.or([{ followUpCount: 0 }, { followUpCount: db.command.exists(false) }]));
  const today = options.today === undefined ? chinaToday() : options.today;
  const due = dueConditions(db, event.due, today);
  due.forEach(condition => conditions.push(condition));
  return { query: conditions.length === 1 ? scope : db.command.and(conditions), order: SORTS[sortKey] };
}
module.exports = { buildFilters, SORTS, day, dueConditions, chinaToday, TERMINAL_STATUSES, DUE_OPTIONS };
