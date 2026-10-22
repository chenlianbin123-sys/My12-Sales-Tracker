const STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'];

function isValidDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** China calendar day, independent of the server timezone. */
function chinaToday(now) {
  const timestamp = now === undefined ? Date.now() : now;
  return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10);
}

/**
 * Validate a follow-up payload.
 * options.today lets tests pin "today" without depending on the clock.
 */
function validateInput(event, options = {}) {
  if (!event || typeof event.leadId !== 'string' || !event.leadId.trim()) return '线索ID不能为空';
  if (typeof event.followUpDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.followUpDate)) {
    return '跟进日期须为 YYYY-MM-DD';
  }
  if (!isValidDay(event.followUpDate)) return '跟进日期无效';
  const today = options.today === undefined ? chinaToday() : options.today;
  // A future follow-up date would corrupt lastFollowUpAt and the reminder.
  if (event.followUpDate > today) return '跟进日期不能晚于今天';
  if (!STATUSES.includes(event.status)) return '跟进状态无效';
  if (event.remarks !== undefined && typeof event.remarks !== 'string') return '备注须为文本';
  if (event.advanceToNext !== undefined && typeof event.advanceToNext !== 'boolean') return '推进选项须为布尔值';
  if (event.nextFollowUpDate !== undefined && event.nextFollowUpDate !== '') {
    if (!isValidDay(event.nextFollowUpDate)) return '下次跟进日期须为 YYYY-MM-DD';
    if (event.nextFollowUpDate < event.followUpDate) return '下次跟进日期不能早于本次跟进日期';
  }
  return null;
}

module.exports = { validateInput, isValidDay, chinaToday, STATUSES };
