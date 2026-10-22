const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 删除线索（负责人/管理员）
 * - 负责人：只能删除本团队的线索
 * - 管理员：可以删除所有线索
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

    // 2. 权限校验：只有负责人或管理员可以删除线索
    if (role !== 1 && role !== 0) {
      return { success: false, message: '只有负责人或管理员可以删除线索' };
    }
    if (role === 1 && (!Number.isSafeInteger(groupId) || groupId < 1)) return { success: false, message: '请先分配有效团队' };

    // 3. 参数校验
    const { leadId } = event;
    if (!leadId) {
      return { success: false, message: '线索ID不能为空' };
    }

    // 4. 查询线索
    const leadRes = await db.collection('leads').doc(leadId).get();
    const lead = leadRes.data;
    if (!lead) {
      return { success: false, message: '线索不存在' };
    }

    // 5. 权限校验：负责人只能删除本团队线索
    if (role === 1 && lead.groupId !== groupId) {
      return { success: false, message: '只能删除本团队线索' };
    }

    // 6. 分批删除该线索的所有跟进记录
    // 单次 get() 有返回条数上限，一次性查询会漏删，留下孤儿记录
    let removed = 0;
    for (let round = 0; round < 100; round++) {
      const batch = await db.collection('followUps')
        .where({ leadId })
        .limit(100)
        .get();
      if (!batch.data || batch.data.length === 0) break;
      await Promise.all(batch.data.map(followUp =>
        db.collection('followUps').doc(followUp._id).remove()
      ));
      removed += batch.data.length;
      if (batch.data.length < 100) break;
    }

    // 7. 删除线索
    await db.collection('leads').doc(leadId).remove();

    return {
      success: true,
      message: '删除成功',
      data: { removedFollowUps: removed }
    };
  } catch (error) {
    console.error('删除线索失败:', error);
    return { success: false, message: '删除线索失败：' + error.message };
  }
};
