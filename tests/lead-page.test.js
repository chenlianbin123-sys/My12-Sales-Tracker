const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function pageHarness(callFunction, user = { userId: 'sales', role: 2, groupId: 1 }) {
  const calls = [], storage = new Map();
  const wx = { cloud: { callFunction }, getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    redirectTo: () => calls.push('redirect'), stopPullDownRefresh: () => calls.push('stop'),
    makePhoneCall: value => calls.push(value), setClipboardData: value => calls.push(value), showToast() {} };
  const file = path.join(__dirname, '../miniprogram/utils/lead-page.js');
  const localRequire = createRequire(file);
  const sandbox = { module: { exports: {} }, wx, require: id => id === './auth' ? { login: async () => user } : localRequire(id) };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  const page = sandbox.module.exports(false);
  page.setData = values => Object.assign(page.data, values);
  return { page, calls, storage, wx };
}
const result = (ids, total) => ({ result: { success: true, data: { list: ids.map(_id => ({ _id, phone: '123', status: 'NEW' })), total } } });

test('pagination appends, deduplicates and sends requested filters', async () => {
  const params = [];
  const { page } = pageHarness(async request => { params.push(request.data); return params.length === 1 ? result(['a'], 21) : result(['a', 'b'], 21); });
  await page.loadLeads();
  await page.loadLeads(true);
  assert.equal(page.data.leads.length, 2);
  assert.equal(params[1].page, 2);
  assert.equal(params[1].keyword, '');
  assert.equal(page.data.hasMore, false);
});
test('editing filters before loading more starts a fresh query', async () => {
  const params = [];
  const { page } = pageHarness(async request => { params.push(request.data); return result([params.length === 1 ? 'old' : 'filtered'], 30); });
  await page.loadLeads();
  page.data.keyword = 'new filter';
  await page.loadLeads(true);
  assert.equal(params[1].page, 1);
  assert.equal(page.data.leads.length, 1);
  assert.equal(page.data.leads[0]._id, 'filtered');
});
test('failed reload clears old results and always releases loading', async () => {
  const { page, calls } = pageHarness(async () => { throw new Error('offline'); });
  page.data.leads = [{ _id: 'stale' }];
  await page.onPullDownRefresh();
  assert.equal(page.data.loading, false);
  assert.equal(page.data.leads.length, 0);
  assert.equal(page.data.error, 'offline');
  assert.ok(calls.includes('stop'));
});
test('unregistered users redirect without retaining data', async () => {
  const { page, calls } = pageHarness(async () => assert.fail('must not query'), { needRegister: true });
  await page.loadLeads();
  assert.equal(page.data.loading, false);
  assert.ok(calls.includes('redirect'));
});
test('older requests cannot overwrite newer filter results', async () => {
  let resolveFirst, count = 0;
  const { page } = pageHarness(async () => ++count === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : result(['new'], 1));
  const first = page.loadLeads();
  await new Promise(resolve => setImmediate(resolve));
  await page.loadLeads();
  resolveFirst(result(['old'], 1));
  await first;
  assert.equal(page.data.leads[0]._id, 'new');
});
test('filter preferences are opt-in and scoped to the user', async () => {
  const { page, storage } = pageHarness(async () => result([], 0));
  await page.loadLeads();
  assert.equal(storage.size, 0);
  page.data.keyword = 'private';
  page.onRememberChange({ detail: { value: true } });
  assert.ok(storage.has('lead-filters:sales:sales'));
  assert.equal(storage.values().next().value.keyword, undefined);
  page.onRememberChange({ detail: { value: false } });
  assert.equal(storage.size, 0);
});
test('dial and clipboard actions use selected phone', () => {
  const { page, calls } = pageHarness(async () => result([], 0));
  const event = { currentTarget: { dataset: { phone: '12345' } } };
  page.onCall(event); page.onCopy(event);
  assert.equal(calls[0].phoneNumber, '12345');
  assert.equal(calls[1].data, '12345');
});

test('CSV writes and shares only loaded records after user confirmation', () => {
  const { page, wx } = pageHarness(async () => result([], 0));
  let written, shared;
  wx.env = { USER_DATA_PATH: '/test-only' };
  wx.showModal = options => options.success({ confirm: true });
  wx.getFileSystemManager = () => ({ writeFile(options) { written = options; options.success(); } });
  wx.shareFileMessage = options => { shared = options; };
  page.data.leads = [{ _id: 'one', phone: '12345' }];
  page.data.total = 200;
  page.onExport();
  assert.equal(written.filePath, '/test-only/sales-leads.csv');
  assert.ok(written.data.includes('12345'));
  assert.equal(written.data.split('\r\n').length, 2);
  assert.equal(shared.fileName, 'sales-leads.csv');
});

test('cancelling export never touches the filesystem', () => {
  const { page, wx } = pageHarness(async () => result([], 0));
  wx.showModal = options => options.success({ confirm: false });
  wx.getFileSystemManager = () => assert.fail('export cancelled');
  page.data.leads = [{ _id: 'one' }];
  page.onExport();
});
