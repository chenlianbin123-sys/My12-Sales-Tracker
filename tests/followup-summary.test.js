const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const REMOVE = { __remove: true };

function load(lead, user, existingFollowUps = []) {
  const writes = { followUp: null, update: null };
  const db = {
    command: { remove: () => REMOVE, in: values => ({ in: values }) },
    collection(name) {
      const query = {
        where() { return this; },
        orderBy() { return this; },
        limit() { return this; },
        get() {
          if (name === 'users') return Promise.resolve({ data: [user] });
          if (name === 'followUps') return Promise.resolve({ data: existingFollowUps });
          return Promise.resolve({ data: [] });
        },
        doc() { this.isDoc = true; return this; },
        update(value) { writes.update = value.data; return Promise.resolve({ updated: 1 }); },
        add(value) { writes.followUp = value.data; return Promise.resolve({ _id: 'fu-new' }); }
      };
      if (name === 'leads') {
        query.doc = () => ({
          get: () => Promise.resolve({ data: lead }),
          update: value => { writes.update = value.data; return Promise.resolve({ updated: 1 }); }
        });
      }
      return query;
    }
  };
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'openid-sales' }) };
  const name = 'followUpCreate';
  const localRequire = createRequire(path.join(__dirname, '..', 'cloudfunctions', name, 'index.js'));
  const sandbox = { exports: {}, require: id => (id === 'wx-server-sdk' ? cloud : localRequire(id)), console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', name, 'index.js'), 'utf8'), sandbox);
  return { main: sandbox.exports.main, writes };
}

const sales = { _id: 'sales', role: 2, groupId: 1 };
const baseLead = {
  _id: 'lead',
  groupId: 1,
  assignedSalesIds: ['sales'],
  status: 'CONTACTED',
  lastStatus: 'CONTACTED',
  lastFollowUpAt: new Date('2026-10-10T00:00:00.000Z'),
  firstFollowUpAt: new Date('2026-10-01T00:00:00.000Z'),
  followUpCount: 1
};

test('latest follow-up writes the planned next date as a China midnight', async () => {
  const { main, writes } = load(baseLead, sales);
  const result = await main({ leadId: 'lead', followUpDate: '2026-10-20', status: 'CONTACTED', nextFollowUpDate: '2026-10-25' });
  assert.equal(result.success, true);
  assert.equal(writes.followUp.nextFollowUpDate, '2026-10-25');
  assert.equal(writes.update.nextFollowUpAt.toISOString(), '2026-10-24T16:00:00.000Z');
  assert.equal(writes.update.lastFollowUpAt.toISOString(), '2026-10-20T00:00:00.000Z');
  assert.equal(writes.update.lastStatus, 'CONTACTED');
  assert.equal(writes.update.followUpCount, 2);
  // 已有首次跟进时间时不重复写入
  assert.equal(writes.update.firstFollowUpAt, undefined);
});

test('closing a deal clears the reminder and records the won date', async () => {
  const { main, writes } = load(baseLead, sales);
  await main({ leadId: 'lead', followUpDate: '2026-10-20', status: 'WON', nextFollowUpDate: '2026-10-30' });
  assert.equal(writes.update.nextFollowUpAt, REMOVE);
  assert.equal(writes.update.status, 'WON');
  assert.equal(writes.update.wonAt.toISOString(), '2026-10-20T00:00:00.000Z');
  assert.equal(writes.update.lastStatus, 'WON');
});

test('leaving the next date blank clears a previous plan', async () => {
  const { main, writes } = load(baseLead, sales);
  await main({ leadId: 'lead', followUpDate: '2026-10-21', status: 'QUOTED', nextFollowUpDate: '' });
  assert.equal(writes.update.nextFollowUpAt, REMOVE);
});

test('backdated records never roll the lead summary backwards', async () => {
  const { main, writes } = load(baseLead, sales);
  const result = await main({ leadId: 'lead', followUpDate: '2026-10-05', status: 'NEW', nextFollowUpDate: '2026-10-28' });
  assert.equal(result.success, true);
  assert.equal(writes.update.followUpCount, 2);
  assert.equal(writes.update.lastFollowUpAt, undefined);
  assert.equal(writes.update.lastStatus, undefined);
  assert.equal(writes.update.nextFollowUpAt, undefined);
});

test('backdated intervals are clamped to zero instead of going negative', async () => {
  const { main, writes } = load(baseLead, sales, [
    { _id: 'fu1', followUpDate: new Date('2026-10-10T00:00:00.000Z'), status: 'CONTACTED' }
  ]);
  await main({ leadId: 'lead', followUpDate: '2026-10-05', status: 'NEW' });
  assert.equal(writes.followUp.durationFromLast, 0);
});
