/**
 * 状态映射工具
 */

// 状态映射：英文 -> 中文
const STATUS_MAP = {
  'NEW': '待处理',
  'CONTACTED': '沟通中',
  'QUOTED': '方案确认',
  'WON': '已完成',
  'LOST': '已关闭'
};

/**
 * 将英文状态转换为中文
 * @param {string} status 英文状态
 * @returns {string} 中文状态
 */
function getStatusText(status) {
  if (!status) return '';
  return STATUS_MAP[status] || status;
}

/**
 * 获取所有状态选项（用于下拉选择）
 */
function getStatusOptions() {
  return [
    { label: '待处理', value: 'NEW' },
    { label: '沟通中', value: 'CONTACTED' },
    { label: '方案确认', value: 'QUOTED' },
    { label: '已完成', value: 'WON' },
    { label: '已关闭', value: 'LOST' }
  ];
}

/**
 * 获取筛选状态选项（包含"全部状态"）
 */
function getFilterStatusOptions() {
  return [
    { label: '全部状态', value: '' },
    ...getStatusOptions()
  ];
}

module.exports = {
  getStatusText,
  getStatusOptions,
  getFilterStatusOptions,
  STATUS_MAP
};
