const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 分配/添加成员到线索（支持多成员协作）
 * 负责人可以为本团队线索分配/添加/移除成员
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
    const { _id: userId, role, groupId } = user;

    // 2. 权限校验：只有负责人可以分配成员
    if (role !== 1) {
      return { success: false, message: '只有负责人可以分配成员' };
    }
    if (!Number.isSafeInteger(groupId) || groupId < 1) return { success: false, message: '请先分配有效团队' };

    // 3. 参数校验
    const { leadId, salesIds, action } = event; // action: 'add' | 'remove' | 'replace'
    if (!leadId) {
      return { success: false, message: '线索ID不能为空' };
    }
    if (!salesIds || !Array.isArray(salesIds) || salesIds.length === 0) {
      return { success: false, message: '成员ID列表不能为空' };
    }

    // 4. 查询线索
    const leadRes = await db.collection('leads').doc(leadId).get();
    const lead = leadRes.data;
    if (!lead) {
      return { success: false, message: '线索不存在' };
    }

    // 5. 权限校验：只能操作本团队线索
    if (lead.groupId !== groupId) {
      return { success: false, message: '只能操作本团队线索' };
    }

    // 6. 验证成员是否在本团队
    const salesRes = await db.collection('users')
      .where({
        _id: db.command.in(salesIds),
        role: 2,
        groupId: groupId
      })
      .get();
    
    if (salesRes.data.length !== salesIds.length) {
      return { success: false, message: '指定的成员不在本团队或不存在' };
    }

    // 7. 更新分配的成员列表
    let newAssignedSalesIds = lead.assignedSalesIds || [];
    
    if (action === 'replace') {
      // 替换：直接替换为新的成员列表
      newAssignedSalesIds = salesIds;
    } else if (action === 'add') {
      // 添加：追加新的成员（去重）
      salesIds.forEach(sid => {
        if (!newAssignedSalesIds.includes(sid)) {
          newAssignedSalesIds.push(sid);
        }
      });
    } else if (action === 'remove') {
      // 移除：从列表中移除指定的成员
      newAssignedSalesIds = newAssignedSalesIds.filter(sid => !salesIds.includes(sid));
      if (newAssignedSalesIds.length === 0) {
        return { success: false, message: '至少需要保留一个成员' };
      }
    } else {
      return { success: false, message: '无效的操作类型' };
    }

    // 8. 更新线索
    const updateData = {
      assignedSalesId: newAssignedSalesIds[0] || null, // 主负责人（向后兼容）
      assignedSalesIds: newAssignedSalesIds,
      updatedAt: new Date()
    };

    await db.collection('leads').doc(leadId).update({ data: updateData });

    return {
      success: true,
      data: {
        leadId,
        assignedSalesIds: newAssignedSalesIds
      }
    };
  } catch (error) {
    console.error('分配成员失败:', error);
    return { success: false, message: '分配成员失败：' + error.message };
  }
};
