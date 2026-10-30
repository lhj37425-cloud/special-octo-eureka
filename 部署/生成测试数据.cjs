// 生成 Render 免费测试用的脱敏数据：只保留已发布内容 + 被引用的媒体，不含账号、会话、留言、草稿、备份。
// 用法：node 部署/生成测试数据.cjs [源数据目录] [输出目录]
const fs = require('fs'), path = require('path');
const src = path.resolve(process.argv[2] || 'D:/项目/data');
const out = path.resolve(process.argv[3] || path.join(__dirname, '..', 'demo-data'));
const sourceState = JSON.parse(fs.readFileSync(path.join(src, 'admin-backend', 'state.json'), 'utf8'));
if (!Array.isArray(sourceState.records)) throw Error('源 state.json 没有 records');

const records = sourceState.records
  .filter(r => r.type && r.status === 'published' && r.published)
  .map(r => ({
    id: r.id,
    type: r.type,
    status: 'published',
    order: r.order,
    featured: !!r.featured,
    experts: r.experts || [],
    category: r.category || '',
    slug: r.slug,
    published: r.published,
    publishedSettings: r.publishedSettings,
  }));

const media = new Set();
const add = f => {
  if (typeof f?.id === 'string') media.add(f.id);
};
for (const r of records) {
  const p = r.published || {};
  const s = p.shared || {};
  add(s.image);
  for (const c of s.clips || []) { add(c.video); add(c.cover); }
  for (const a of s.attachments || []) add(a.file || a);
  for (const lang of ['zh', 'vi', 'en']) {
    const v = p[lang] || {};
    add(v.image);
    for (const c of v.clips || []) { add(c.video); add(c.cover); }
    for (const a of v.attachments || []) add(a.file || a);
  }
}

const uploadOut = path.join(out, 'admin-backend', 'uploads');
fs.mkdirSync(uploadOut, { recursive: true });
let copied = 0, bytes = 0;
const missing = [];
for (const id of media) {
  const from = path.join(src, 'admin-backend', 'uploads', path.basename(id));
  if (!fs.existsSync(from)) { missing.push(id); continue; }
  fs.copyFileSync(from, path.join(uploadOut, path.basename(id)));
  copied++;
  bytes += fs.statSync(from).size;
}

const clean = {
  version: sourceState.version || 1,
  users: [],
  sessions: {},
  records,
  options: sourceState.options || {},
};
fs.mkdirSync(path.join(out, 'admin-backend'), { recursive: true });
fs.writeFileSync(path.join(out, 'admin-backend', 'state.json'), JSON.stringify(clean, null, 2));
fs.writeFileSync(path.join(out, 'mvp-leads.json'), '[]');
console.log(JSON.stringify({
  output: out,
  records: records.length,
  mediaReferenced: media.size,
  mediaCopied: copied,
  mediaMissing: missing,
  mediaMB: Math.round(bytes / 1048576 * 10) / 10,
}, null, 2));
