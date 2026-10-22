const { login } = require('../../../utils/auth');
const { summarizeBatch, MAX_BATCH } = require('../../../utils/phone-input');

Page({
  data: {
    mode: 'single', // single | batch
    phone: '',
    customerName: '',
    remarks: '',
    batchText: '',
    batchPreview: { validCount: 0, invalidCount: 0, repeatedCount: 0, overLimit: false, preview: [] },
    maxBatch: MAX_BATCH,
    groupSales: [],
    submitting: false
  },

  onLoad() {
    this.loadGroupSales();
  },

  async loadGroupSales() {
    try {
      const user = await login();
      if (!user || user.role !== 1) {
        wx.showToast({ title: '无权限', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      // 查询本团队成员
      const db = wx.cloud.database();
      const res = await db.collection('users')
        .where({
          role: 2,
          groupId: user.groupId
        })
        .get();

      this.setData({
        groupSales: (res.data || []).map(s => ({ ...s, checked: false }))
      });
    } catch (error) {
      console.error('加载成员列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },
  onCustomerNameInput(e) { this.setData({ customerName: e.detail.value }); },

  onRemarksInput(e) {
    this.setData({ remarks: e.detail.value });
  },

  onBatchInput(e) {
    const batchText = e.detail.value;
    this.setData({ batchText, batchPreview: summarizeBatch(batchText) });
  },

  onSalesToggle(e) {
    const sales = e.currentTarget.dataset.sales;
    const groupSales = this.data.groupSales.map(s => {
      if (s._id === sales._id) {
        return { ...s, checked: !s.checked };
      }
      return s;
    });
    this.setData({ groupSales });
  },

  selectedSalesIds() {
    return this.data.groupSales.filter(s => s.checked).map(s => s._id);
  },

  async onSubmit() {
    if (this.data.mode === 'batch') return this.onSubmitBatch();
    const { phone, customerName, remarks, submitting } = this.data;

    if (!phone.trim() && !customerName.trim()) {
      wx.showToast({ title: '请填写名称或电话', icon: 'none' });
      return;
    }

    if (submitting) return;
    this.setData({ submitting: true });

    try {
      const result = await this.createLead({
        phone: phone.trim(),
        customerName: customerName.trim(),
        remarks: remarks.trim()
      });

      // 组内重复：提示后可选择强行录入
      if (result && result.duplicate) {
        this.setData({ submitting: false });
        wx.showModal({
          title: '该号码已存在',
          content: '本组已有相同客户电话，是否仍然录入一条新线索？',
          confirmText: '仍然录入',
          success: res => {
            if (res.confirm) this.forceCreate();
          }
        });
        return;
      }

      if (result && result.success) {
        this.afterCreated('录入成功');
      } else {
        wx.showToast({ title: (result && result.message) || '录入失败', icon: 'none' });
        this.setData({ submitting: false });
      }
    } catch (error) {
      console.error('录入线索失败:', error);
      wx.showToast({ title: '录入失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  async forceCreate() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const result = await this.createLead({
        phone: this.data.phone.trim(),
        remarks: this.data.remarks.trim(),
        force: true
      });
      if (result && result.success) this.afterCreated('录入成功');
      else {
        wx.showToast({ title: (result && result.message) || '录入失败', icon: 'none' });
        this.setData({ submitting: false });
      }
    } catch (error) {
      console.error('强制录入失败:', error);
      wx.showToast({ title: '录入失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  async createLead(extra) {
    const selectedSalesIds = this.selectedSalesIds();
    const res = await wx.cloud.callFunction({
      name: 'leadCreate',
      data: {
        ...extra,
        assignedSalesIds: selectedSalesIds.length > 0 ? selectedSalesIds : undefined
      }
    });
    return res.result || {};
  },

  async onSubmitBatch() {
    const { batchText, remarks, submitting, batchPreview } = this.data;
    if (submitting) return;
    if (!batchText.trim()) {
      wx.showToast({ title: '请粘贴电话号码', icon: 'none' });
      return;
    }
    if (batchPreview.overLimit) {
      wx.showToast({ title: '单次最多 ' + MAX_BATCH + ' 条', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const selectedSalesIds = this.selectedSalesIds();
      const res = await wx.cloud.callFunction({
        name: 'leadCreateBatch',
        data: {
          phones: batchText,
          remarks: remarks.trim(),
          assignedSalesIds: selectedSalesIds.length > 0 ? selectedSalesIds : undefined
        }
      });
      const result = res.result || {};
      if (!result.success) {
        wx.showModal({
          title: '批量录入失败',
          content: (result.message || '请检查输入') +
            (result.data && result.data.invalid && result.data.invalid.length
              ? '\n无效号码：' + result.data.invalid.slice(0, 5).join('、') : ''),
          showCancel: false
        });
        this.setData({ submitting: false });
        return;
      }

      const data = result.data;
      const lines = [
        '成功录入：' + data.createdCount + ' 条',
        '跳过重复：' + data.duplicateCount + ' 条',
        '无效号码：' + data.invalidCount + ' 条'
      ];
      if (data.failedCount) lines.push('写入失败：' + data.failedCount + ' 条');
      if (data.duplicateCount > 0 && data.duplicates.length) {
        lines.push('重复号码示例：' + data.duplicates.slice(0, 3).join('、'));
      }

      this.setData({ submitting: false });
      wx.showModal({
        title: '批量录入结果',
        content: lines.join('\n'),
        showCancel: false,
        success: () => {
          this.setData({ batchText: '', batchPreview: summarizeBatch('') });
          if (data.createdCount > 0) this.afterCreated(null, true);
        }
      });
    } catch (error) {
      console.error('批量录入失败:', error);
      wx.showToast({ title: '批量录入失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  /** 创建成功后的收尾：提示并回退刷新列表 */
  afterCreated(title, stay) {
    if (title) wx.showToast({ title, icon: 'success' });
    this.setData({ submitting: false });
    if (stay) return;
    setTimeout(() => {
      wx.navigateBack();
      const pages = getCurrentPages();
      if (pages.length > 1) {
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadLeads === 'function') {
          setTimeout(() => { prevPage.loadLeads(); }, 300);
        }
      }
    }, 1200);
  }
});
