const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function readAll(name) {
  const rows = [];
  for (let skip = 0; skip < 10000; skip += 100) {
    const page = await db.collection(name).orderBy('_id', 'asc').skip(skip).limit(100).get();
    rows.push(...page.data);
    if (page.data.length < 100) return { data: rows };
  }
  throw new Error('统计数据量过大，请改用聚合统计');
}

/**
 * 管理员数据看板统计
 * 统计各团队：线索总数、已跟进率、按状态分布
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 1. 获取用户信息
    const userRes = await db.collection('users').where({ openid }).get();
    if (userRes.data.length === 0) {
      return { success: false, message: '用户不存在，请先登录' };
    }
    const user = userRes.data[0];
    const { role } = user;

    // 2. 权限校验：只有管理员可以查看看板
    if (role !== 0) {
      return { success: false, message: '只有管理员可以查看数据看板' };
    }

    // 3. 查询所有用户（用于名称映射）
    const allUsersRes = await readAll('users');
    const userNameMap = {};
    allUsersRes.data.forEach(u => {
      userNameMap[u._id] = u.name || '未命名';
    });

    // 4. 查询所有线索（按组统计）
    const allLeadsRes = await readAll('leads');
    const allLeads = allLeadsRes.data;

    // 5. 查询所有跟进记录（用于计算已跟进率）
    const allFollowUpsRes = await readAll('followUps');
    const followUpsByLeadId = {};
    allFollowUpsRes.data.forEach(f => {
      if (!followUpsByLeadId[f.leadId]) {
        followUpsByLeadId[f.leadId] = [];
      }
      followUpsByLeadId[f.leadId].push(f);
    });

    // 6. 按组统计
    const groupStats = {};
    const teamIds = [...new Set([...allUsersRes.data, ...allLeads].map(row => row.groupId))]
      .filter(id => Number.isSafeInteger(id) && id > 0).sort((a, b) => a - b);
    for (const groupId of teamIds) {
      const groupLeads = allLeads.filter(l => l.groupId === groupId);
      const totalLeads = groupLeads.length;
      
      // 已跟进的线索（有至少1条跟进记录）
      const followedLeads = groupLeads.filter(l => followUpsByLeadId[l._id] && followUpsByLeadId[l._id].length > 0);
      const followUpRate = totalLeads > 0 ? (followedLeads.length / totalLeads * 100).toFixed(2) : 0;

      // 按状态统计
      const statusStats = {
        NEW: 0,
        CONTACTED: 0,
        QUOTED: 0,
        WON: 0,
        LOST: 0
      };
      groupLeads.forEach(lead => {
        const status = lead.lastStatus || lead.status || 'NEW';
        if (statusStats.hasOwnProperty(status)) {
          statusStats[status]++;
        }
      });

      // 查询本团队的成员和负责人数量
      const groupUsersRes = { data: allUsersRes.data.filter(user => user.groupId === groupId) };
      const anchors = groupUsersRes.data.filter(u => u.role === 1);
      const sales = groupUsersRes.data.filter(u => u.role === 2);

      groupStats[groupId] = {
        groupId,
        totalLeads,
        followedLeads: followedLeads.length,
        followUpRate: parseFloat(followUpRate),
        statusStats,
        anchors: anchors.length,
        sales: sales.length,
        anchorNames: anchors.map(a => a.name || '未命名'),
        salesNames: sales.map(s => s.name || '未命名'),
        leads: groupLeads
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // 按创建时间倒序
          .slice(0, 3) // 只取前3条
          .map(lead => ({
            _id: lead._id,
            phone: lead.phone,
            customerName: lead.customerName || '',
            lastStatus: lead.lastStatus || lead.status || 'NEW',
            followUpCount: lead.followUpCount || 0,
            lastFollowUpDate: lead.lastFollowUpAt ? new Date(lead.lastFollowUpAt).toISOString().slice(0, 10) : '',
            createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
            createdBy: userNameMap[lead.createdByAnchorId] || '未命名',
            createdById: lead.createdByAnchorId,
            assignedSalesNames: (lead.assignedSalesIds || []).map(id => userNameMap[id] || '未知').join('、') || '未分配',
            assignedSalesIds: lead.assignedSalesIds || []
          }))
      };
    }

    // 7. 总体统计
    const totalLeads = allLeads.length;
    const totalFollowedLeads = allLeads.filter(l => followUpsByLeadId[l._id] && followUpsByLeadId[l._id].length > 0).length;
    const totalFollowUpRate = totalLeads > 0 ? (totalFollowedLeads / totalLeads * 100).toFixed(2) : 0;

    const totalStatusStats = {
      NEW: 0,
      CONTACTED: 0,
      QUOTED: 0,
      WON: 0,
      LOST: 0
    };
    allLeads.forEach(lead => {
      const status = lead.lastStatus || lead.status || 'NEW';
      if (totalStatusStats.hasOwnProperty(status)) {
        totalStatusStats[status]++;
      }
    });

    return {
      success: true,
      data: {
        summary: {
          totalLeads,
          totalFollowedLeads,
          totalFollowUpRate: parseFloat(totalFollowUpRate),
          totalStatusStats
        },
        groupStats: Object.values(groupStats)
      }
    };
  } catch (error) {
    console.error('获取数据看板失败:', error);
    return { success: false, message: '获取数据看板失败：' + error.message };
  }
};
