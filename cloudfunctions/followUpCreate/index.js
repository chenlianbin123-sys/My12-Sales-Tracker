const cloud = require('wx-server-sdk');
const { validateInput } = require('./validation');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 创建跟进记录（成员/负责人）
 * 多成员协作：成员需在 assignedSalesIds 中；负责人可对自己创建且同组的线索添加
 */
exports.main = async (event = {}, context) => {
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

    // 2. 权限校验：成员/负责人可创建跟进
    const isSales = role === 2;
    const isAnchor = role === 1;
    if (!isSales && !isAnchor) {
      return { success: false, message: '只有成员或负责人可以创建跟进记录' };
    }

    // 3. 参数校验
    const inputError = validateInput(event);
    if (inputError) return { success: false, message: inputError };
    const { leadId, followUpDate, status, remarks, advanceToNext, nextFollowUpDate } = event;
    if (!leadId) {
      return { success: false, message: '线索ID不能为空' };
    }
    if (!followUpDate) {
      return { success: false, message: '跟进日期不能为空' };
    }
    if (!status) {
      return { success: false, message: '跟进状态不能为空' };
    }

    // 4. 查询线索
    const leadRes = await db.collection('leads').doc(leadId).get();
    const lead = leadRes.data;
    if (!lead) {
      return { success: false, message: '线索不存在' };
    }

    // 5. 权限校验
    const assignedSalesIds = Array.isArray(lead.assignedSalesIds) ? lead.assignedSalesIds : [];
    const isSameGroup = (Number.isSafeInteger(groupId) && groupId > 0) && lead.groupId === groupId;
    const isAssignedSales = isSales && isSameGroup && assignedSalesIds.includes(userId);
    const isGroupAnchor = isAnchor && isSameGroup;

    if (!isAssignedSales && !isGroupAnchor) {
      return { success: false, message: '无权限添加该线索的跟进记录' };
    }

    // 7. 查询该线索的上一条跟进记录（用于计算间隔天数）
    const lastFollowUpRes = await db.collection('followUps')
      .where({ leadId })
      .orderBy('followUpDate', 'desc')
      .limit(1)
      .get();

    let durationFromLast = 0;
    if (lastFollowUpRes.data.length > 0) {
      const lastDate = new Date(lastFollowUpRes.data[0].followUpDate);
      const currentDate = new Date(followUpDate);
      // Backdated records must not produce a negative interval.
      durationFromLast = Math.max(0, Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24)));
    }

    // 8. 如果选择推进到下一个进程，自动设置下一个状态
    let finalStatus = status;
    if (advanceToNext) {
      const currentStatus = lead.lastStatus || lead.status || 'NEW';
      const statusFlow = {
        'NEW': 'CONTACTED',
        'CONTACTED': 'QUOTED',
        'QUOTED': status // 方案确认后需要手动选择已完成或已关闭
      };
      
      // 如果当前状态在流程中，且新状态不是已完成或已关闭，则使用流程中的下一个状态
      if (statusFlow[currentStatus] && status !== 'WON' && status !== 'LOST') {
        finalStatus = statusFlow[currentStatus];
      }
    }

    // 9. 创建跟进记录
    const now = new Date();
    const isTerminal = finalStatus === 'WON' || finalStatus === 'LOST';
    const followUpData = {
      leadId,
      groupId: lead.groupId,
      salesId: userId, // 兼容旧字段，表示操作人ID
      operatorRole: role,
      followUpDate: new Date(followUpDate),
      status: finalStatus,
      remarks: remarks || '',
      nextFollowUpDate: nextFollowUpDate || '', // 计划的下次跟进日（YYYY-MM-DD）
      durationFromLast,
      createdAt: now
    };

    const addRes = await db.collection('followUps').add({ data: followUpData });

    // 10. 更新线索摘要：只跟随「最新一次跟进」，补录历史记录不回退摘要
    const previousLast = lead.lastFollowUpAt ? new Date(lead.lastFollowUpAt) : null;
    const isLatest = !previousLast || !Number.isFinite(previousLast.getTime()) ||
      new Date(followUpDate).getTime() >= previousLast.getTime();

    const updateData = {
      followUpCount: (lead.followUpCount || 0) + 1,
      updatedAt: now
    };

    if (isLatest) {
      updateData.lastFollowUpAt = new Date(followUpDate);
      updateData.lastStatus = finalStatus;

      // 如果是首次跟进
      if (!lead.firstFollowUpAt) {
        updateData.firstFollowUpAt = new Date(followUpDate);
      }

      // 下次跟进提醒：成交/流失后不再提醒，其余情况以本次跟进填写为准
      if (nextFollowUpDate && !isTerminal) {
        updateData.nextFollowUpAt = new Date(nextFollowUpDate + 'T00:00:00+08:00');
      } else {
        updateData.nextFollowUpAt = db.command.remove();
      }

      // 如果状态是成交
      if (finalStatus === 'WON') {
        updateData.wonAt = new Date(followUpDate);
        updateData.status = 'WON';
      }

      // 如果状态是流失
      if (finalStatus === 'LOST') {
        updateData.lostAt = new Date(followUpDate);
        updateData.status = 'LOST';
      }
    }

    await db.collection('leads').doc(leadId).update({ data: updateData });

    return {
      success: true,
      data: {
        _id: addRes._id,
        ...followUpData
      }
    };
  } catch (error) {
    console.error('创建跟进记录失败:', error);
    return { success: false, message: '创建跟进记录失败：' + error.message };
  }
};
