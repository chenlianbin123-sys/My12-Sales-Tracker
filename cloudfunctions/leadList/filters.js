const SORTS = {
  newest: ['createdAt', 'desc'], oldest: ['createdAt', 'asc'],
  recent: ['lastFollowUpAt', 'desc'], mostFollowed: ['followUpCount', 'desc']
};
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期须为 YYYY-MM-DD');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('日期无效');
  // UI dates represent calendar days in China, independent of server timezone.
  return new Date(value + 'T00:00:00+08:00');
}
function buildFilters(db, scope, event) {
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
  return { query: conditions.length === 1 ? scope : db.command.and(conditions), order: SORTS[sortKey] };
}
module.exports = { buildFilters, SORTS, day };
