// 前台唯一取数口（方案 3.1、第 5 步）：只读后台发布快照，整理成每种语言能直接渲染的数据。
// 规则：只保留“已发布 + 该语言必填项都填了”的内容；没填完的语言不显示，也不拿别的语言补。
// 顺序、大卡、授课专家、片段、附件、课程信息名称都按后台发布快照和选项整理。
const schema = require('./内容栏位.cjs');
const core = require('./后台服务.cjs');

const LANGS = schema.LANGS;
const media = file => file?.id ? `/admin-media/${encodeURIComponent(file.id)}` : '';
const asList = value => Array.isArray(value) ? value.map(x => String(x ?? '')).filter(x => x.trim()) : String(value ?? '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const aligned = value => Array.isArray(value) ? value.map(x => String(x ?? '')) : String(value ?? '').split(/\r?\n/);
const paragraphs = value => String(value ?? '').split(/\r?\n\s*\r?\n/).map(x => x.trim()).filter(Boolean);
const optionName = (list, id, lang) => { const option = (list || []).find(x => x.id === id); return option ? (option[lang] || option.zh || '') : ''; };

// 旧记录没有共用区：从旧的语言栏位推导（与后台 normalizeDraft 相同）；不修改数据文件
function normalize(record, options) {
  const p = record.published || {};
  const draft = { shared: { ...(p.shared || {}) }, zh: { ...(p.zh || {}) }, vi: { ...(p.vi || {}) }, en: { ...(p.en || {}) } };
  const shared = draft.shared;
  if (!shared.image) for (const lang of LANGS) { const image = draft[lang].image; if (image) { shared.image = image; break; } }
  if (!Array.isArray(shared.experts) || !shared.experts.length) shared.experts = (record.publishedSettings?.experts || record.experts || []).slice(0, 6);
  options = options || core.listOptions();
  if (record.type === 'courses') {
    if (!shared.category) {
      const name = String(draft.zh.category || draft.vi.category || draft.en.category || '').trim();
      const found = (options.courseCategories || []).find(o => o.zh === name);
      if (found) shared.category = found.id;
    }
  }
  if (record.type === 'experts') {
    for (const lang of LANGS) {
      const v = draft[lang];
      if (!v.identity && v.role) v.identity = String(v.role);
      if (!v.bio && v.description) v.bio = String(v.description);
    }
  }
  return draft;
}

// 某种语言是否算填完；旧记录没有新必填项时，用旧栏位判断，保证 K2 的旧资料照样显示
function languageComplete(record, draft, lang) {
  const v = draft[lang] || {};
  if (record.type === 'experts' && !('tagline' in v)) return !!(String(v.name || '').trim() && String(v.identity || v.role || '').trim());
  if (record.type === 'courses' && !('goals' in v)) return !!(String(v.name || '').trim() && String(v.description || '').trim() && String(v.audience || '').trim() && asList(v.outline).length);
  return schema.langComplete(record.type, v).complete;
}

function expertFields(record, draft, lang) {
  const v = draft[lang] || {};
  return {
    name: v.name || '',
    identity: v.identity || v.role || '',
    tagline: v.tagline || '',
    highlights: asList(v.highlights).slice(0, 3),
    bio: paragraphs(v.bio || v.description),
    experience: asList(v.experience),
    photo: media(draft.shared.image),
    bigCard: !!draft.shared.bigCard,
    order: Number(record.order ?? 0),
  };
}

function courseFields(record, draft, lang, teacherVisible, options) {
  const v = draft[lang] || {}, shared = draft.shared; options = options || core.listOptions();
  const factLabels = shared.factLabels || [], factValues = aligned(v.factValues);
  const facts = factLabels.map((id, i) => [optionName(options.courseFacts, id, lang), factValues[i] || '']).filter(([label, value]) => label && value);
  const outcomes = (Array.isArray(v.outcomes) ? v.outcomes : []).map(item => [String(item?.title || ''), String(item?.text || '')]).filter(([title, text]) => title || text);
  const legacyTitles = aligned(v.clipTitles);
  const langClips = Array.isArray(v.clips) && v.clips.length ? v.clips : (lang === 'zh' && Array.isArray(shared.clips) ? shared.clips : []);
  const videos = langClips.map((clip, i) => {
    if (!clip?.video?.id) return null;
    const title = String(clip.title || legacyTitles[i] || '');
    if (!title.trim()) return null;
    return { name: title, title, url: media(clip.video), poster: media(clip.cover) || media(shared.image), duration: Number(clip.duration || clip.video.duration || 0) };
  }).filter(Boolean);
  const legacyNames = aligned(v.attachmentNames);
  const rawAttachments = Array.isArray(v.attachments) && v.attachments.length
    ? v.attachments
    : (shared.attachments || []).filter(item => (item.langs || LANGS).includes(lang));
  const materials = rawAttachments.map((item, i) => {
    const file = item?.file?.id ? item.file : (item?.id ? item : null);
    if (!file?.id) return null;
    return { name: item?.displayName || legacyNames[i] || file.name || '', url: media(file) };
  }).filter(Boolean);
  const teacherIds = (shared.experts || []).filter(id => teacherVisible(id, lang));
  const category = optionName(options.courseCategories, shared.category, lang) || String(v.category || '');
  return {
    name: v.name || '', intro: v.description || '', goals: String(v.goals || ''), audience: v.audience || '',
    outline: asList(v.outline), facts, outcomes, videos, materials, category,
    cover: media(shared.image), teacherIds, teacherId: teacherIds[0] || '',
    order: Number(record.order ?? 0),
  };
}

function qualificationFields(record, draft, lang) {
  const v = draft[lang] || {};
  return { name: v.name || '', intro: v.description || '', photo: media(draft.shared.image) };
}

function caseFields(record, draft, lang) {
  const v = draft[lang] || {};
  return {
    slug: record.slug || record.id, featured: !!record.featured, image: media(draft.shared.image),
    order: Number(record.order ?? 0),
    [lang]: {
      title: v.name || '', industry: v.industry || '', summary: v.description || '', problem: v.problem || '',
      steps: asList(v.steps), people: v.people || '', deliverables: asList(v.deliverables),
      highlight: v.highlight || '', evaluation: v.evaluation || '',
    },
  };
}

// 预览用：把某一条的发布快照换成草稿；其余内容仍用发布版（第 6 步用）。
// 还没发布过的草稿也要能出现在预览列表里。
function readRecords(override = null) {
  const records = core.list(true);
  if (!override || !override.id || !override.draft) return records;
  const all = core.list(), source = all.find(record => record.id === override.id);
  if (!source) return records;
  const merged = {
    ...source,
    published: override.draft,
    publishedSettings: { category: source.category, order: source.order, experts: source.experts },
  };
  const index = records.findIndex(record => record.id === override.id);
  if (index >= 0) records[index] = merged; else records.push(merged);
  return records;
}

function content(override = null) {
  // 单次请求只读一次选项（原来每条记录、每种语言各读一次 state.json）
  const records = readRecords(override), options = core.listOptions();
  const teachers = records.filter(r => r.type === 'experts').map(record => {
    const draft = normalize(record, options), languages = {}, translations = {};
    for (const lang of LANGS) {
      languages[lang] = languageComplete(record, draft, lang);
      if (lang !== 'zh' && languages[lang]) translations[lang] = expertFields(record, draft, lang);
    }
    return { id: record.id, published: true, languages, translations, ...expertFields(record, draft, 'zh') };
  }).sort((a, b) => a.order - b.order);
  const teacherById = new Map(teachers.map(item => [item.id, item]));
  const teacherVisible = (id, lang) => !!teacherById.get(id)?.languages?.[lang];

  const courses = records.filter(r => r.type === 'courses').map(record => {
    const draft = normalize(record, options), languages = {}, translations = {};
    for (const lang of LANGS) {
      languages[lang] = languageComplete(record, draft, lang);
      if (lang !== 'zh' && languages[lang]) translations[lang] = courseFields(record, draft, lang, teacherVisible, options);
    }
    return { id: record.id, published: true, languages, translations, ...courseFields(record, draft, 'zh', teacherVisible, options) };
  }).sort((a, b) => a.order - b.order);

  const qualifications = records.filter(r => r.type === 'qualifications').map(record => {
    const draft = normalize(record, options), languages = {}, translations = {};
    for (const lang of LANGS) {
      languages[lang] = languageComplete(record, draft, lang);
      if (lang !== 'zh' && languages[lang]) translations[lang] = qualificationFields(record, draft, lang);
    }
    return { id: record.id, published: true, featured: !!record.featured, languages, translations, ...qualificationFields(record, draft, 'zh'), order: Number(record.order ?? 0) };
  }).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.order - b.order);

  return { courses, teachers, qualifications };
}

// 首页资质：只取这种语言有名称和图片的；勾首页展示的在前，其余按 order（F4）
function qualifications(lang, override = null) {
  const records = readRecords(override), options = core.listOptions();
  return records.filter(r => r.type === 'qualifications').map(record => {
    const draft = normalize(record, options);
    if (!languageComplete(record, draft, lang)) return null;
    const v = draft[lang] || {}, image = draft.shared.image;
    if (!v.name || !image) return null;
    return { featured: !!record.featured, order: Number(record.order ?? 0), item: [v.name, v.description || '', media(image)] };
  }).filter(Boolean).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.order - b.order).map(x => x.item);
}

// 案例：只取这种语言填完的；编号按 order 在这个语言的可见列表里从 01 开始（F5）
function cases(lang, override = null) {
  const options = core.listOptions();
  const records = readRecords(override).filter(r => r.type === 'cases').map(record => ({ record, draft: normalize(record, options) }))
    .filter(({ record, draft }) => languageComplete(record, draft, lang) && draft[lang]?.name && draft.shared.image)
    .sort((a, b) => (a.record.order || 0) - (b.record.order || 0));
  return records.map(({ record, draft }, index) => ({ ...caseFields(record, draft, lang), no: String(index + 1).padStart(2, '0') }));
}

function allCases(override = null) { return cases('zh', override); }

module.exports = { content, qualifications, cases, allCases, normalize, languageComplete };
