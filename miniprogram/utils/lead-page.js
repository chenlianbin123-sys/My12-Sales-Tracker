const { login } = require('./auth');
const { formatDateOnly } = require('./date');
const { getStatusText, getFilterStatusOptions } = require('./status');
const { SORT_OPTIONS, toCsv, cleanPreferences } = require('./lead-tools');

// Shared controller keeps the anchor and sales screens consistent.
module.exports = function createLeadPage(isAnchor) {
  return {
    data: {
      isAnchor, leads: [], loading: false, error: '', userName: '',
      statusIndex: 0, statusOptions: getFilterStatusOptions(), sortOptions: SORT_OPTIONS,
      sortIndex: 0, keyword: '', createdFrom: '', createdTo: '', unfollowed: false,
      page: 0, total: 0, hasMore: false, rememberFilters: false
    },
    onShow() { this.loadLeads(); },
    onUnload() { this._requestId = (this._requestId || 0) + 1; },
    onRefresh() { return this.loadLeads(); },
    async onPullDownRefresh() {
      try { await this.loadLeads(); } finally { wx.stopPullDownRefresh(); }
    },
    onReachBottom() { if (this.data.hasMore && !this.data.loading) this.loadLeads(true); },
    onLoadMore() { if (!this.data.loading) return this.loadLeads(true); },
    async loadLeads(append = false) {
      if (append && (!this.data.hasMore || this.data.loading)) return;
      const requestId = (this._requestId || 0) + 1;
      this._requestId = requestId;
      this.setData({ loading: true, error: '' });
      try {
        const user = await login({ forceRefresh: true });
        if (this._requestId !== requestId) return;
        if (!user || user.needRegister) {
          this.setData({ leads: [], total: 0, hasMore: false });
          wx.redirectTo({ url: '/pages/login/index' });
          return;
        }
        const key = 'lead-filters:' + (user.userId || user._id) + ':' + (isAnchor ? 'anchor' : 'sales');
        if (this._preferenceKey !== key) {
          this._preferenceKey = key;
          let saved;
          try { saved = wx.getStorageSync(key); } catch (_) {}
          this.setData({ ...cleanPreferences(saved), rememberFilters: !!saved, keyword: '', leads: [], page: 0 });
          append = false;
        }
        this.setData({ userName: user.name || '' });
        const params = {
          pageSize: 20, keyword: this.data.keyword.trim(),
          status: this.data.statusOptions[this.data.statusIndex].value,
          sort: SORT_OPTIONS[this.data.sortIndex].value,
          createdFrom: this.data.createdFrom, createdTo: this.data.createdTo, unfollowed: this.data.unfollowed
        };
        const filterKey = JSON.stringify(params);
        if (append && filterKey !== this._appliedFilters) append = false;
        const page = append ? this.data.page + 1 : 1;
        params.page = page;
        const res = await wx.cloud.callFunction({ name: 'leadList', data: params });
        if (this._requestId !== requestId) return;
        if (!res.result || !res.result.success) throw new Error(res.result && res.result.message || '加载失败');
        const list = (res.result.data.list || []).map(lead => ({
          ...lead, lastFollowUpAt: lead.lastFollowUpAt ? formatDateOnly(lead.lastFollowUpAt) : '',
          createdAtDate: formatDateOnly(lead.createdAt), lastStatusText: getStatusText(lead.lastStatus || lead.status)
        }));
        const combined = append ? this.data.leads.concat(list) : list;
        const seen = new Set();
        const leads = combined.filter(lead => !seen.has(lead._id) && seen.add(lead._id));
        const total = res.result.data.total;
        this._appliedFilters = filterKey;
        this.setData({ leads, page, total, hasMore: page * 20 < total });
        this.savePreferences();
      } catch (error) {
        if (this._requestId === requestId) {
          // Never leave stale results exportable under newly selected filters.
          this.setData({ error: error.message || '加载失败', ...(append ? {} : { leads: [], total: 0, hasMore: false }) });
        }
      } finally {
        if (this._requestId === requestId) this.setData({ loading: false });
      }
    },
    savePreferences() {
      if (!this._preferenceKey) return;
      try {
        if (this.data.rememberFilters) wx.setStorageSync(this._preferenceKey, cleanPreferences(this.data));
        else wx.removeStorageSync(this._preferenceKey);
      } catch (_) { wx.showToast({ title: '无法保存筛选偏好', icon: 'none' }); }
    },
    onRememberChange(e) { this.setData({ rememberFilters: e.detail.value }); this.savePreferences(); },
    onKeywordInput(e) { this.setData({ keyword: e.detail.value }); },
    onSearch() { return this.loadLeads(); },
    onStatusChange(e) { this.setData({ statusIndex: Number(e.detail.value) }); this.loadLeads(); },
    onSortChange(e) { this.setData({ sortIndex: Number(e.detail.value) }); this.loadLeads(); },
    onFromChange(e) { this.setData({ createdFrom: e.detail.value }); this.loadLeads(); },
    onToChange(e) { this.setData({ createdTo: e.detail.value }); this.loadLeads(); },
    onUnfollowedChange(e) { this.setData({ unfollowed: e.detail.value }); this.loadLeads(); },
    onReset() {
      this.setData({ ...cleanPreferences({}), keyword: '' });
      return this.loadLeads();
    },
    onLeadTap(e) { wx.navigateTo({ url: '/pages/lead-detail/index?leadId=' + encodeURIComponent(e.currentTarget.dataset.id) }); },
    onFollowUpTap(e) { wx.navigateTo({ url: '/pages/followup-edit/index?leadId=' + encodeURIComponent(e.currentTarget.dataset.id) }); },
    onAddLead() { wx.navigateTo({ url: '/pages/anchor/lead-edit/index' }); },
    goProfile() { wx.navigateTo({ url: '/pages/profile/index' }); },
    onCall(e) { wx.makePhoneCall({ phoneNumber: String(e.currentTarget.dataset.phone), fail() {} }); },
    onCopy(e) { wx.setClipboardData({ data: String(e.currentTarget.dataset.phone) }); },
    onExport() {
      if (!this.data.leads.length || this.data.loading || this.data.error) return;
      const content = toCsv(this.data.leads);
      wx.showModal({
        title: '导出已加载线索', content: '仅导出已加载的 ' + this.data.leads.length + ' 条结果，包含客户电话和备注，请妥善保管。',
        success: res => {
          if (!res.confirm) return;
          const filePath = wx.env.USER_DATA_PATH + '/sales-leads.csv';
          wx.getFileSystemManager().writeFile({ filePath, data: content, encoding: 'utf8',
            success() {
              if (wx.shareFileMessage) wx.shareFileMessage({ filePath, fileName: 'sales-leads.csv', fail() {} });
              else wx.showToast({ title: '当前微信版本不支持文件分享', icon: 'none' });
            }, fail() { wx.showToast({ title: '导出失败', icon: 'none' }); }
          });
        }
      });
    },
    onDeleteLead(e) {
      if (!isAnchor) return;
      const leadId = e.currentTarget.dataset.id;
      wx.showModal({ title: '确认删除', content: '删除后无法恢复，确定删除这条线索吗？', success: async res => {
        if (!res.confirm) return;
        try {
          const result = await wx.cloud.callFunction({ name: 'leadDelete', data: { leadId } });
          if (!result.result.success) throw new Error(result.result.message);
          await this.loadLeads();
        } catch (error) { wx.showToast({ title: error.message || '删除失败', icon: 'none' }); }
      } });
    }
  };
};
