const STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'];

function validateInput(event) {
  if (!event || typeof event.leadId !== 'string' || !event.leadId.trim()) return '线索ID不能为空';
  if (typeof event.followUpDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.followUpDate)) {
    return '跟进日期须为 YYYY-MM-DD';
  }
  const date = new Date(event.followUpDate);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== event.followUpDate) return '跟进日期无效';
  if (!STATUSES.includes(event.status)) return '跟进状态无效';
  if (event.remarks !== undefined && typeof event.remarks !== 'string') return '备注须为文本';
  if (event.advanceToNext !== undefined && typeof event.advanceToNext !== 'boolean') return '推进选项须为布尔值';
  return null;
}

module.exports = { validateInput };
