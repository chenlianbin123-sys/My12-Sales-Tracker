const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DAY_MS = 86400000;
const TERMINAL = ["WON", "LOST"];

/** 中国日历日零点，不依赖服务器时区 */
function chinaTodayStart() {
  const dayText = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  return new Date(dayText + "T00:00:00+08:00");
}

/** 未成交/未流失的线索才需要提醒 */
function pendingCondition() {
  return _.or([
    { lastStatus: _.nin(TERMINAL) },
    { lastStatus: _.exists(false), status: _.nin(TERMINAL) }
  ]);
}

/**
 * 统计当前账号可见范围内的待跟进数量。
 * scope 为空对象时统计全量（管理员）。
 */
async function countDue(scope, kind) {
  const start = chinaTodayStart();
  const conditions = [];
  if (Object.keys(scope).length > 0) conditions.push(scope);
  if (kind === "today") {
    conditions.push({ nextFollowUpAt: _.gte(start) });
    conditions.push({ nextFollowUpAt: _.lt(new Date(start.getTime() + DAY_MS)) });
  } else if (kind === "week") {
    conditions.push({ nextFollowUpAt: _.gte(start) });
    conditions.push({ nextFollowUpAt: _.lt(new Date(start.getTime() + 7 * DAY_MS)) });
  } else {
    conditions.push({ nextFollowUpAt: _.lt(start) });
  }
  conditions.push(pendingCondition());
  const query = conditions.length === 1 ? conditions[0] : _.and(conditions);
  const res = await db.collection("leads").where(query).count().catch(() => ({ total: 0 }));
  return res.total || 0;
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, message: "无法获取 openid" };

  const meRes = await db.collection("users").where({ openid }).limit(1).get();
  if (!meRes.data || meRes.data.length === 0) {
    return { success: false, message: "用户不存在，请先登录" };
  }
  const me = meRes.data[0];
  const userId = me._id;

  // 管理员：返回全量的总体统计（轻量）
  if (me.role === 0) {
    const leadsCount = await db.collection("leads").count().catch(() => ({ total: 0 }));
    const followUpsCount = await db.collection("followUps").count().catch(() => ({ total: 0 }));
    const [dueToday, overdue, dueWeek] = await Promise.all([
      countDue({}, "today"),
      countDue({}, "overdue"),
      countDue({}, "week")
    ]);
    return {
      success: true,
      data: {
        role: me.role,
        totalLeads: leadsCount.total || 0,
        totalFollowUps: followUpsCount.total || 0,
        dueToday,
        overdue,
        dueWeek
      }
    };
  }

  if (![1, 2].includes(me.role) || !Number.isSafeInteger(me.groupId) || me.groupId < 1) {
    return { success: false, message: '请先联系管理员分配有效团队' };
  }
  // 负责人：统计本团队线索数、已跟进线索数、本组待跟进
  if (me.role === 1) {
    const groupId = me.groupId;
    const totalLeadsRes = await db.collection("leads").where({ groupId }).count().catch(() => ({ total: 0 }));
    const followedLeadsRes = await db
      .collection("leads")
      .where({
        groupId,
        followUpCount: _.gt(0)
      })
      .count()
      .catch(() => ({ total: 0 }));
    const [dueToday, overdue, dueWeek] = await Promise.all([
      countDue({ groupId }, "today"),
      countDue({ groupId }, "overdue"),
      countDue({ groupId }, "week")
    ]);

    return {
      success: true,
      data: {
        role: me.role,
        groupId,
        totalLeads: totalLeadsRes.total || 0,
        followedLeads: followedLeadsRes.total || 0,
        dueToday,
        overdue,
        dueWeek
      }
    };
  }

  // 成员：统计分配给我的线索数、我写的跟进数、已跟进线索数（followUpCount>0）、我的待跟进
  const totalLeadsRes = await db
    .collection("leads")
    .where({ assignedSalesIds: userId, groupId: me.groupId })
    .count()
    .catch(() => ({ total: 0 }));

  const followedLeadsRes = await db
    .collection("leads")
    .where({
      assignedSalesIds: userId,
      groupId: me.groupId,
      followUpCount: _.gt(0)
    })
    .count()
    .catch(() => ({ total: 0 }));

  const myFollowUpsRes = await db
    .collection("followUps")
    .where({ salesId: userId, groupId: me.groupId })
    .count()
    .catch(() => ({ total: 0 }));

  const [dueToday, overdue, dueWeek] = await Promise.all([
    countDue({ assignedSalesIds: userId }, "today"),
    countDue({ assignedSalesIds: userId }, "overdue"),
    countDue({ assignedSalesIds: userId }, "week")
  ]);

  return {
    success: true,
    data: {
      role: me.role,
      groupId: me.groupId || 0,
      totalLeads: totalLeadsRes.total || 0,
      followedLeads: followedLeadsRes.total || 0,
      myFollowUps: myFollowUpsRes.total || 0,
      dueToday,
      overdue,
      dueWeek
    }
  };
};
