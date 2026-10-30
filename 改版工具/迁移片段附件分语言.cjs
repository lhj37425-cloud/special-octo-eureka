// 一次性迁移：把课程的片段/附件从“共用区”迁到每种语言自己的 clips / attachments。
// 用法：ADMIN_DATA_DIR=... MVP_DATA_DIR=... node 迁移片段附件分语言.cjs
// 走后台服务的 saveRecord/publish，不直接改 state.json；只处理 courses。
const core = require('../后台服务.cjs');
const owner = { role: 'owner', name: '迁移工具' };
const before = core.list();
const courses = before.filter(r => r.type === 'courses');
const report = [];
for (const record of courses) {
  const input = { id: record.id, type: record.type, revision: record.revision, draft: record.draft, order: record.order, experts: record.experts };
  const saved = core.saveRecord(input, owner);
  const published = record.status === 'published' ? core.publish(record.id, owner) : saved;
  const target = published.published || published.draft;
  report.push({
    id: record.id,
    name: target?.zh?.name || record.draft?.zh?.name || record.id,
    status: record.status,
    zh: { clips: (target?.zh?.clips || []).length, attachments: (target?.zh?.attachments || []).length },
    vi: { clips: (target?.vi?.clips || []).length, attachments: (target?.vi?.attachments || []).length },
    en: { clips: (target?.en?.clips || []).length, attachments: (target?.en?.attachments || []).length },
    sharedKeys: Object.keys(target?.shared || {}),
  });
}
console.log(JSON.stringify(report, null, 2));
