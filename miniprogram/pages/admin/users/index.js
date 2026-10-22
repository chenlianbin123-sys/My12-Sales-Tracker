const { login } = require("../../../utils/auth");

const ROLE_OPTIONS = [
  { label: "全部角色", value: null },
  { label: "管理员(0)", value: 0 },
  { label: "负责人(1)", value: 1 },
  { label: "成员(2)", value: 2 }
];


Page({
  data: {
    loading: false,
    users: [],
    roleOptions: ROLE_OPTIONS,
    groupFilter: '',
    roleIndex: 0,
    editing: false,
    saving: false,
    editUserId: "",
    editDraft: {
      name: "",
      roleIndex: 1,
      groupId: '1'
    },
    editRoleOptions: ROLE_OPTIONS.slice(1) // 不含“全部”
  },

  onLoad() {
    this.reload();
  },

  async reload() {
    this.setData({ loading: true });
    try {
      const me = await login();
      if (!me || me.role !== 0) {
        wx.showToast({ title: "无权限", icon: "none" });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }

      const roleValue = this.data.roleOptions[this.data.roleIndex].value;
      const groupValue = this.data.groupFilter.trim() === '' ? null : Number(this.data.groupFilter);
      if (groupValue !== null && (!Number.isSafeInteger(groupValue) || groupValue < 0)) throw new Error('团队编号须为非负整数');

      const res = await wx.cloud.callFunction({
        name: "adminUserList",
        data: {
          role: roleValue === null ? undefined : roleValue,
          groupId: groupValue === null ? undefined : groupValue
        }
      });
      if (!res?.result?.success) throw new Error(res?.result?.message || "加载失败");
      this.setData({ users: res.result.data.list || [] });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRoleFilterChange(e) {
    this.setData({ roleIndex: Number(e.detail.value) });
    this.reload();
  },

  onGroupFilterChange(e) {
    this.setData({ groupFilter: e.detail.value });
  },

  openEdit(e) {
    const u = e.currentTarget.dataset.user;
    const roleIdx = this.data.editRoleOptions.findIndex((x) => x.value === u.role);
    this.setData({
      editing: true,
      editUserId: u._id,
      editDraft: {
        name: u.name || "",
        roleIndex: roleIdx >= 0 ? roleIdx : 2, // 默认成员
        groupId: String(u.groupId || 0)
      }
    });
  },

  closeEdit() {
    if (this.data.saving) return;
    this.setData({ editing: false, editUserId: "" });
  },

  onEditName(e) {
    this.setData({ "editDraft.name": e.detail.value });
  },

  onEditRole(e) {
    this.setData({ "editDraft.roleIndex": Number(e.detail.value) });
    // 管理员 role=0 时，自动把 group 置到 0
    const role = this.data.editRoleOptions[Number(e.detail.value)].value;
    if (role === 0) {
      this.setData({ "editDraft.groupId": '0' });
    }
  },

  onEditGroup(e) {
    this.setData({ "editDraft.groupId": e.detail.value });
  },

  async saveEdit() {
    if (this.data.saving) return;
    const userId = this.data.editUserId;
    const name = (this.data.editDraft.name || "").trim();
    const role = this.data.editRoleOptions[this.data.editDraft.roleIndex].value;
    const groupId = role === 0 ? 0 : Number(this.data.editDraft.groupId);
    if (!Number.isSafeInteger(groupId) || (role !== 0 && groupId < 1)) {
      wx.showToast({ title: '请输入正整数团队编号', icon: 'none' }); return;
    }

    if (!name) {
      wx.showToast({ title: "昵称不能为空", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "adminUserUpdate",
        data: { userId, name, role, groupId }
      });
      if (!res?.result?.success) throw new Error(res?.result?.message || "保存失败");

      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({ editing: false, editUserId: "" });
      await this.reload();
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  }
});

