// 内容栏位表（《后台改造方案》3.1、第 4 节）：四类内容的全部项目、字数算法、
// “某种语言算不算填完”“能不能发布”的判断。后台服务、后台界面、前台取数都用这一份。
const fs = require('fs'), path = require('path');
const LANGS = ['zh', 'vi', 'en'];

// 字数算法（B3）：汉字和全角标点算 1，字母、数字、半角标点、空格算 ½；
// 越南语单独存的声调符号（组合用变音符）不另算；显示时向上取整
function widthOf(text) {
  let n = 0;
  for (const ch of String(text || '')) {
    const code = ch.codePointAt(0);
    if (code >= 0x300 && code <= 0x36f) continue; // 组合用变音符（越南语声调）
    n += code > 0xff ? 1 : 0.5;
  }
  return n;
}
const count = text => Math.ceil(widthOf(text));

// 栏位类型：line 单行 / text 多行 / list 一条一行 / image 图片 / check 勾选 /
// select 下拉（选项设置） / experts 授课专家 / factLabels 课程信息名称 / clips 片段 / files 附件 / outcomes 学完你能做到
// scope：shared 三语共用 / lang 分语言
const TYPES = {
  experts: {
    name: '专家及讲师',
    shared: [
      { key: 'image', label: '照片', type: 'image', required: false, note: '建议填；没有照片显示姓氏', usedIn: '卡片和详情页，统一圆形' },
      { key: 'bigCard', label: '大卡展示', type: 'check', required: false, note: '最多 4 位（只数已发布的）', usedIn: '专家页的卡片大小和先后' },
    ],
    lang: [
      { key: 'name', label: '姓名', type: 'line', required: true, max: 20, usedIn: '卡片、详情页', example: '郑毅' },
      { key: 'identity', label: '身份', type: 'line', required: true, max: 12, usedIn: '卡片和详情页上的红色小标签', example: 'Agent 落地 · 主讲' },
      { key: 'tagline', label: '一句话介绍', type: 'line', required: true, max: 50, usedIn: '卡片；详情页姓名下面' },
      { key: 'highlights', label: '亮点', type: 'list', required: false, maxItems: 3, suggest: 20, max: 24, usedIn: '大卡上的打勾小条、小卡上的小标签、详情页姓名下面' },
      { key: 'bio', label: '详细介绍', type: 'text', required: false, usedIn: '详情页“个人简介”' },
      { key: 'experience', label: '主要经历', type: 'list', required: false, usedIn: '详情页右边' },
    ],
  },
  courses: {
    name: '课程',
    shared: [
      { key: 'image', label: '封面', type: 'image', required: true, usedIn: '列表卡、详情页首屏' },
      { key: 'category', label: '分类', type: 'select', options: 'courseCategories', required: true, usedIn: '卡片角标、列表页筛选' },
      { key: 'experts', label: '授课专家', type: 'experts', required: true, minItems: 1, maxItems: 6, usedIn: '列表卡显示主讲；详情页显示全部；专家详情页自动列出这门课' },
      { key: 'factLabels', label: '课程信息（名称）', type: 'factLabels', options: 'courseFacts', required: false, maxItems: 4, usedIn: '详情页首屏' },
    ],
    lang: [
      { key: 'name', label: '课程名', type: 'line', required: true, max: 30, usedIn: '列表卡、详情页' },
      { key: 'goals', label: '一句话目标', type: 'line', required: true, max: 40, usedIn: '详情页首屏课程名下面' },
      { key: 'description', label: '课程介绍', type: 'text', required: true, max: 300, usedIn: '列表卡（前两行）、详情页“课程介绍”' },
      { key: 'audience', label: '适合人群', type: 'line', required: true, max: 40, usedIn: '列表卡、详情页' },
      { key: 'factValues', label: '课程信息（内容）', type: 'list', required: false, align: 'factLabels', suggest: 12, max: 16, usedIn: '详情页首屏' },
      { key: 'outline', label: '课程大纲', type: 'list', required: true, minItems: 1, suggestItems: [4, 12], suggest: 30, max: 40, usedIn: '详情页“课程大纲”，多于 8 条分两列' },
      { key: 'outcomes', label: '学完你能做到', type: 'outcomes', required: false, maxItems: 3, titleMax: 8, textMax: 40, usedIn: '详情页“学完你能做到”，0 条时整块不显示' },
      { key: 'clips', label: '学习预览片段', type: 'clips', required: false, suggestItems: 6, usedIn: '详情页“学习预览”；每种语言单独上传' },
      { key: 'attachments', label: '资料附件', type: 'files', required: false, usedIn: '详情页课程大纲下面；每种语言单独上传' },
    ],
  },
  cases: {
    name: '应用案例', // 栏位不变（方案 4.4），只把图片挪到共用；字数先不设上限
    shared: [
      { key: 'image', label: '案例图片', type: 'image', required: true, usedIn: '列表卡、详情页、首页业务场景' },
    ],
    lang: [
      { key: 'name', label: '案例标题', type: 'line', required: true, usedIn: '列表卡、详情页、首页' },
      { key: 'industry', label: '行业', type: 'line', required: true, usedIn: '列表卡、详情页' },
      { key: 'description', label: '简介', type: 'text', required: true, usedIn: '列表卡、首页' },
      { key: 'problem', label: '业务问题', type: 'text', required: true, usedIn: '详情页' },
      { key: 'steps', label: '应用方式', type: 'text', required: true, usedIn: '详情页（一步一行，页面自动编号）' },
      { key: 'people', label: '人员分工', type: 'text', required: true, usedIn: '详情页' },
      { key: 'deliverables', label: '交付成果', type: 'text', required: true, usedIn: '详情页、首页（前 3 项）' },
      { key: 'highlight', label: '一句话亮点', type: 'text', required: false, usedIn: '详情页' },
      { key: 'evaluation', label: '评估重点', type: 'text', required: false, usedIn: '详情页' },
    ],
  },
  qualifications: {
    name: '公司资质', // 栏位不变（方案 4.5），字数先只显示
    shared: [
      { key: 'image', label: '资质图片', type: 'image', required: true, usedIn: '首页资质卡，点开看大图' },
    ],
    lang: [
      { key: 'name', label: '名称', type: 'line', required: true, usedIn: '首页资质卡' },
      { key: 'description', label: '简短说明', type: 'text', required: true, usedIn: '首页资质卡' },
    ],
  },
};

// 预置选项（4.6）。越南语、英文名称是执行时拟的（确认状态见《改版待确认文案》），仅在新部署缺省初始化时兜底，正式数据以 state.json 为准
const DEFAULT_OPTIONS = {
  courseCategories: [
    { id: 'cat-aigc', zh: 'AIGC 课程', vi: 'Khóa học AIGC', en: 'AIGC Courses', disabled: false },
  ],
  courseFacts: [
    { id: 'fact-hours', zh: '课时', vi: 'Số giờ', en: 'Duration', disabled: false },
    { id: 'fact-format', zh: '形式', vi: 'Hình thức', en: 'Format', disabled: false },
    { id: 'fact-class', zh: '班型', vi: 'Quy mô lớp', en: 'Class size', disabled: false },
    { id: 'fact-cert', zh: '结业', vi: 'Chứng nhận', en: 'Certificate', disabled: false },
    { id: 'fact-base', zh: '基础', vi: 'Yêu cầu', en: 'Prerequisites', disabled: false },
  ],
};

// 网页宋体字表（D12）：发布时检查姓名/课程名/案例标题/资质名称里有没有字表外的字
let FONT_CHARS = null;
function fontCharSet() {
  if (FONT_CHARS) return FONT_CHARS;
  try { FONT_CHARS = new Set(fs.readFileSync(path.join(__dirname, 'public', 'fonts', '宋体字表.txt'), 'utf8')); }
  catch { FONT_CHARS = new Set(); }
  return FONT_CHARS;
}
function fontWarnings(type, draft) {
  const chars = fontCharSet();
  if (!chars.size) return [];
  const label = { experts: '姓名', courses: '课程名', cases: '案例标题', qualifications: '名称' }[type] || '名称';
  const out = [];
  for (const lang of LANGS) {
    for (const ch of String(draft?.[lang]?.name || '')) {
      if (/\s/.test(ch) || chars.has(ch)) continue;
      const text = `${label}（${langName(lang)}）“${ch}”不在网页宋体字表里，会用电脑字体显示`;
      if (!out.includes(text)) out.push(text);
    }
  }
  return out.slice(0, 8);
}

const fields = type => [...(TYPES[type]?.shared || []), ...(TYPES[type]?.lang || [])];
const field = (type, key) => fields(type).find(f => f.key === key);
const langFieldKeys = type => (TYPES[type]?.lang || []).map(f => f.key);
const sharedFieldKeys = type => (TYPES[type]?.shared || []).map(f => f.key);

// 一条空白草稿：共用区 + 三种语言
function emptyDraft(type) {
  const shared = {}, draft = { shared };
  for (const f of TYPES[type].shared) shared[f.key] = f.type === 'check' ? false : f.type === 'select' ? '' : f.type === 'image' ? null : [];
  for (const lang of LANGS) {
    const v = {};
    for (const f of TYPES[type].lang) v[f.key] = ['list', 'outcomes', 'clips', 'files'].includes(f.type) ? [] : '';
    draft[lang] = v;
  }
  return draft;
}

const asList = value => Array.isArray(value) ? value.map(x => String(x ?? '')) : String(value || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);

// 把旧记录规整成新结构（K2：旧栏位一律保留，只推导缺的新栏位）
function normalizeDraft(type, draft) {
  const empty = emptyDraft(type), out = { shared: { ...empty.shared, ...(draft?.shared || {}) } };
  const legacy = lang => draft?.[lang] || {};
  const sharedClips = Array.isArray(draft?.shared?.clips) ? draft.shared.clips : [];
  const sharedAtts = Array.isArray(draft?.shared?.attachments) ? draft.shared.attachments : [];
  for (const lang of LANGS) {
    const old = legacy(lang), v = { ...old, ...empty[lang] }; // 旧栏位一律保留（K1）
    for (const f of TYPES[type].lang) {
      const value = old[f.key];
      if (f.type === 'list') v[f.key] = value !== undefined ? asList(value) : asList(old[legacyOf(type, f.key)]);
      else if (f.type === 'outcomes') v[f.key] = Array.isArray(value) ? value : [];
      else if (f.type === 'clips') {
        const list = Array.isArray(value) ? value : [];
        v[f.key] = list.filter(c => c && c.video).map(c => ({ video: c.video || null, cover: c.cover || null, duration: Number(c.duration) || 0, title: String(c.title || '') }));
        // 旧共用片段只回填中文，避免把中文视频当成越/英版本
        if (!v[f.key].length && lang === 'zh' && sharedClips.length) {
          v[f.key] = sharedClips.filter(c => c && c.video).map((c, i) => ({ video: c.video || null, cover: c.cover || null, duration: Number(c.duration) || 0, title: String((old.clipTitles || [])[i] || '') }));
        }
      } else if (f.type === 'files') {
        const list = Array.isArray(value) ? value : [];
        v[f.key] = list.map(a => {
          const file = a?.file?.id ? a.file : a;
          return file?.id ? { ...file, displayName: String(a.displayName || file.displayName || '') } : null;
        }).filter(Boolean);
        // 旧共用附件按原来的语言勾选拆回各语言
        if (!v[f.key].length && sharedAtts.length) {
          v[f.key] = sharedAtts.filter(a => (a.langs || LANGS).includes(lang)).map((a, i) => ({ ...a.file, displayName: String((old.attachmentNames || [])[i] || '') }));
        }
      } else v[f.key] = value !== undefined ? String(value ?? '') : String(old[legacyOf(type, f.key)] ?? '');
    }
    out[lang] = v;
  }
  // 共用区缺省时从旧栏位推导
  if (!out.shared.image) out.shared.image = legacy('zh').image || legacy('vi').image || legacy('en').image || null;
  if (type === 'experts') {
    for (const lang of LANGS) {
      if (!out[lang].identity) out[lang].identity = String(legacy(lang).role || '');
      if (!out[lang].bio) out[lang].bio = String(legacy(lang).description || '');
    }
  }
  if (type === 'courses' && !out.shared.category) out.shared.category = ''; // 旧分类名在 normalizeRecord 里按名称对到选项
  // 片段、附件已经改为分语言；旧共用字段不再保留
  delete out.shared.clips;
  delete out.shared.attachments;
  return out;
}
// 新栏位没有自己的键时，读哪个旧栏位（迁移用）
function legacyOf(type, key) {
  const map = { identity: 'role', bio: 'description' };
  return map[key] || key;
}

// 某种语言“填完”没有；没填完时列出缺的必填项（C2）
function langComplete(type, v) {
  const missing = [];
  for (const f of TYPES[type].lang) {
    if (!f.required) continue;
    const value = v?.[f.key];
    const ok = f.type === 'list' ? asList(value).length >= (f.minItems || 1) : String(value || '').trim().length > 0;
    if (!ok) missing.push(f.label);
  }
  return { complete: missing.length === 0, missing };
}

// 超上限的字（B3、D4）：返回 [{label, lang, count, max}]
function overLimit(type, draft) {
  const out = [];
  for (const f of TYPES[type].lang) {
    if (!f.max && !f.titleMax) continue;
    for (const lang of LANGS) {
      const v = draft?.[lang] || {};
      if (f.type === 'list') asList(v[f.key]).forEach((x, i) => { const c = count(x); if (f.max && c > f.max) out.push({ label: `${f.label}第 ${i + 1} 条`, lang, count: c, max: f.max }); });
      else if (f.type === 'outcomes') (Array.isArray(v[f.key]) ? v[f.key] : []).forEach((x, i) => {
        const t = count(x?.title), s = count(x?.text);
        if (f.titleMax && t > f.titleMax) out.push({ label: `${f.label}第 ${i + 1} 条小标题`, lang, count: t, max: f.titleMax });
        if (f.textMax && s > f.textMax) out.push({ label: `${f.label}第 ${i + 1} 条说明`, lang, count: s, max: f.textMax });
      });
      else { const c = count(v[f.key]); if (f.max && c > f.max) out.push({ label: f.label, lang, count: c, max: f.max }); }
    }
  }
  return out;
}

// 发布前检查（D3、D4、E7、F6）：返回 {ok, errors[], languages:{zh:{show,missing},…}}
// records：全部记录（数大卡用）
function publishCheck(record, records = []) {
  const type = record.type, draft = record.draft || {}, shared = draft.shared || {}, errors = [];
  for (const f of TYPES[type].shared) {
    if (!f.required) continue;
    if (f.type === 'image' && !shared[f.key]) errors.push(f.label);
    if (f.type === 'select' && !shared[f.key]) errors.push(f.label);
    if (f.type === 'experts' && (shared.experts || record.experts || []).length < (f.minItems || 1)) errors.push(`${f.label}至少 ${f.minItems || 1} 位`);
  }
  const languages = {};
  for (const lang of LANGS) {
    const { complete, missing } = langComplete(type, draft[lang]);
    languages[lang] = { show: complete, missing };
  }
  // D3：某种语言没填完（填了一半也一样）不拦发布，只在 languages 里报告“不显示、缺什么”。
  // 但一种语言都没填完时不能发布，报错里写清每种语言缺什么（4.8）
  if (!LANGS.some(l => languages[l].show)) {
    const details = LANGS.filter(l => languages[l].missing.length).map(l => `${langName(l)}缺：${languages[l].missing.join('、')}`).join('；');
    errors.push('至少把一种语言的必填项填完才能发布' + (details ? `（${details}）` : ''));
  }
  for (const o of overLimit(type, draft)) errors.push(`${o.label}（${langName(o.lang)}）${o.count} / ${o.max}，超过上限`);
  if (type === 'experts' && shared.bigCard) {
    const big = records.filter(r => r.type === 'experts' && r.id !== record.id && r.status === 'published' && (r.published?.shared?.bigCard ?? r.draft?.shared?.bigCard));
    if (big.length >= 4) errors.push(`大卡已有 4 位（${big.map(r => r.published?.zh?.name || r.draft?.zh?.name || r.id).join('、')}），要先取消一位`);
  }
  return { ok: errors.length === 0, errors, languages, warnings: fontWarnings(type, draft) };
}
const langName = l => ({ zh: '中文', vi: '越南语', en: '英文' }[l] || l);

// 保存时双写旧栏位（K1，3.3）：旧代码读到的就是它认识的格式
function dualWrite(type, draft, options) {
  const shared = draft.shared || {}, out = {};
  const optionName = id => { const o = (options?.courseCategories || []).find(x => x.id === id); return o ? { zh: o.zh, vi: o.vi, en: o.en } : null; };
  for (const lang of LANGS) {
    const v = draft[lang] || {}, legacy = {};
    legacy.image = shared.image || null;
    if (type === 'experts') { legacy.role = v.identity || ''; legacy.description = v.bio || ''; }
    if (type === 'courses') {
      const names = optionName(shared.category);
      legacy.category = names ? names[lang] || '' : '';
      // clips / attachments 已经是分语言的旧格式，双写时保持原样，不覆盖
    }
    out[lang] = legacy;
  }
  return out;
}

module.exports = { LANGS, TYPES, DEFAULT_OPTIONS, widthOf, count, fields, field, langFieldKeys, sharedFieldKeys, emptyDraft, asList, normalizeDraft, langComplete, overLimit, publishCheck, dualWrite, langName };
