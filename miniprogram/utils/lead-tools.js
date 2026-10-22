const SORT_OPTIONS = [
  { label: '最新录入', value: 'newest' }, { label: '最早录入', value: 'oldest' },
  { label: '最近跟进', value: 'recent' }, { label: '跟进次数最多', value: 'mostFollowed' }
];
function csvCell(value) {
  let text = String(value == null ? '' : value);
  // Spreadsheet formulas must stay text even after leading whitespace.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function toCsv(leads) {
  const rows = [['客户/事项名称', '联系电话', '状态', '跟进次数', '协作成员', '创建日期', '最近跟进', '备注']];
  leads.forEach(lead => rows.push([lead.customerName || '', lead.phone, lead.lastStatusText, lead.followUpCount || 0,
    lead.assignedSalesNames, lead.createdAtDate, lead.lastFollowUpAt || '', lead.remarks || '']));
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
function cleanPreferences(value) {
  const data = value && typeof value === 'object' ? value : {};
  const date = text => typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  return {
    statusIndex: Number.isInteger(data.statusIndex) && data.statusIndex >= 0 && data.statusIndex < 6 ? data.statusIndex : 0,
    sortIndex: Number.isInteger(data.sortIndex) && data.sortIndex >= 0 && data.sortIndex < SORT_OPTIONS.length ? data.sortIndex : 0,
    createdFrom: date(data.createdFrom), createdTo: date(data.createdTo), unfollowed: data.unfollowed === true
  };
}
module.exports = { SORT_OPTIONS, csvCell, toCsv, cleanPreferences };
