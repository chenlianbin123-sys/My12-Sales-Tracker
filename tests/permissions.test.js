const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Isolated cloud-function harness: no SDK installation, credentials or cloud writes.
function load(name, user, lead = {}) {
  const calls = [];
  const db = {
    command: { in: values => ({ in: values }) },
    collection(collection) {
      const query = {
        where(value) { calls.push({ collection, where: value }); return this; },
        orderBy() { return this; },
        skip(value) { calls.push({ skip: value }); return this; },
        limit(value) { calls.push({ limit: value }); return this; },
        field() { return this; },
        doc() { this.isDoc = true; return this; },
        async get() {
          if (collection === 'users') return { data: [user] };
          return { data: this.isDoc ? lead : [] };
        },
        async count() { return { total: 0 }; },
        async add(value) { calls.push({ add: value }); return { _id: 'new-lead' }; }
      };
      return query;
    }
  };
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'test-openid' }) };
  const sandbox = { exports: {}, require: id => {
    assert.equal(id, 'wx-server-sdk'); return cloud;
  }, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', name, 'index.js'), 'utf8'), sandbox);
  return { main: sandbox.exports.main, calls };
}

test('sales list requires both current group and assignment', async () => {
  const { main, calls } = load('leadList', { _id: 'sales', role: 2, groupId: 2 });
  assert.equal((await main({})).success, true);
  const query = calls.find(call => call.collection === 'leads').where;
  assert.equal(query.groupId, 2);
  assert.equal(query.assignedSalesIds, 'sales');
});

test('unassigned users cannot list leads or follow-ups or create leads', async () => {
  for (const role of [1, 2]) {
    for (const name of ['leadList', 'followUpList', ...(role === 1 ? ['leadCreate'] : [])]) {
      const { main, calls } = load(name, { _id: 'user', role, groupId: 0 });
      assert.equal((await main({ leadId: 'lead', phone: 'test' })).success, false);
      assert.equal(calls.some(call => call.collection === 'leads' || call.add), false);
    }
  }
});

test('sales cannot read old-group follow-ups even if still assigned', async () => {
  const { main, calls } = load('followUpList', { _id: 'sales', role: 2, groupId: 2 },
    { groupId: 1, assignedSalesIds: ['sales'] });
  assert.equal((await main({ leadId: 'lead' })).success, false);
  assert.equal(calls.some(call => call.collection === 'followUps'), false);
});

test('same-group assigned sales can read follow-ups', async () => {
  const { main } = load('followUpList', { _id: 'sales', role: 2, groupId: 1 },
    { groupId: 1, assignedSalesIds: ['sales'] });
  assert.equal((await main({ leadId: 'lead' })).success, true);
});

test('malformed assignments do not grant follow-up access', async () => {
  const { main } = load('followUpList', { _id: 'sales', role: 2, groupId: 1 },
    { groupId: 1, assignedSalesIds: 'sales' });
  assert.equal((await main({ leadId: 'lead' })).success, false);
});

test('invalid pagination is rejected before querying leads', async () => {
  for (const params of [{ page: 0 }, { page: -1 }, { page: '2' }, { page: 1.5 },
    { pageSize: 0 }, { pageSize: 101 }, { page: Number.MAX_SAFE_INTEGER, pageSize: 100 }]) {
    const { main, calls } = load('leadList', { _id: 'admin', role: 0 });
    assert.equal((await main(params)).success, false);
    assert.equal(calls.some(call => call.collection === 'leads'), false);
  }
});

test('pagination defaults and offset remain compatible', async () => {
  const { main, calls } = load('leadList', { _id: 'admin', role: 0 });
  const result = await main({ page: 3, pageSize: 10 });
  assert.equal(result.success, true);
  assert.equal(result.data.page, 3);
  assert.equal(calls.find(call => call.skip !== undefined).skip, 20);
  assert.equal((await main()).data.pageSize, 20);
});

test('new leads have NEW filter status and malformed phone is rejected', async () => {
  const { main, calls } = load('leadCreate', { _id: 'sales', role: 1, groupId: 1 });
  assert.equal((await main({ phone: 123 })).success, false);
  const result = await main({ phone: ' example ', assignedSalesIds: ['sales'] });
  assert.equal(result.success, true);
  assert.equal(calls.find(call => call.add).add.data.lastStatus, 'NEW');
});
