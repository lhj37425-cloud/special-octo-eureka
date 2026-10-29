// 专家、课程的新编辑页（方案 4.1–4.3、第 3 步）：按 内容栏位.cjs 的栏位表生成表单。
// 共用区只填一次；文字分中文、越南语、英文；字数、三语检查、列表增删排序都在这里。
import { prepareAndUploadImage, prepareVideo, captureFrame, prepareCoverImage, uploadMedia, validateMediaFile } from './media.js';

export const SCHEMA_TYPES = ['experts', 'courses', 'cases', 'qualifications'];
export const LANG_NAME = { zh: '中文', vi: '越南语', en: '英文' };

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const btn = (text, action, css = '', extra = '') => `<button type="button" class="${css}" data-editor-action="${action}" ${extra}>${text}</button>`;
const asList = value => Array.isArray(value) ? value.map(x => String(x ?? '')) : String(value || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const hasValue = value => Array.isArray(value)
  ? value.some(x => x && typeof x === 'object' ? Object.values(x).some(y => String(y ?? '').trim() !== '') : String(x ?? '').trim() !== '')
  : String(value ?? '').trim().length > 0;

// 字数（B3）：汉字和全角标点算 1，字母/数字/半角标点/空格算 ½；越南语组合声调不另算，显示向上取整
export function widthOf(text) {
  let n = 0;
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0);
    if (code >= 0x300 && code <= 0x36f) continue;
    n += code > 0xff ? 1 : 0.5;
  }
  return n;
}
export const count = text => Math.ceil(widthOf(text));

let stylesReady = false;
export function ensureEditorStyles() {
  if (stylesReady) return;
  stylesReady = true;
  const style = document.createElement('style');
  style.textContent = `
  .se-block{border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fff;min-width:0}
  .se-block+.se-block{margin-top:14px}
  .se-block h3{margin:0 0 4px;font-size:15px}
  .se-block .se-sub{margin:0 0 12px;color:#64748b;font-size:12px}
  .se-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .se-grid.one{grid-template-columns:minmax(0,1fr)}
  @media(max-width:1000px){.se-grid{grid-template-columns:minmax(0,1fr)}}
  .se-media{display:flex;gap:14px;align-items:flex-start;min-width:0}
  .se-media img{width:132px;height:132px;object-fit:cover;border-radius:12px;background:#f1f5f9;flex:none}
  .se-media img.is-round{border-radius:50%}
  .se-media img.is-wide{width:210px;height:118px}
  .se-placeholder{width:132px;height:132px;border:1.5px dashed #cbd5e1;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:6px;flex:none;font-size:12px}
  .se-placeholder.is-wide{width:210px;height:118px}
  .se-media-actions{display:flex;flex-direction:column;gap:8px;min-width:0}
  .se-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .efield{min-width:0;margin-top:12px}
  .efield>label{display:block;font-size:13px;font-weight:600;margin-bottom:5px}
  .efield .req{color:#dc2626;margin-left:2px}
  .ecount{float:right;font-weight:400;font-size:11px;color:#94a3b8}
  .ecount.warn{color:#b45309}
  .ecount.over{color:#dc2626;font-weight:700}
  .zh-ref{font-size:12px;line-height:1.55;color:#94a3b8;background:#f8fafc;border-left:2px solid #e2e8f0;padding:6px 9px;margin-bottom:6px;white-space:pre-wrap;border-radius:0 6px 6px 0}
  .used{font-size:11px;color:#94a3b8;margin-top:4px}
  .elist-row{display:flex;gap:6px;align-items:center;margin-bottom:6px;min-width:0}
  .elist-row input{flex:1;min-width:0}
  .elist-row .mini{width:26px;height:26px;padding:0;flex:none}
  .outcome-row{border:1px solid #eef2f6;border-radius:9px;padding:8px;margin-bottom:8px}
  .outcome-row .row{display:flex;gap:6px;align-items:center;margin-top:6px}
  .expert-picker{display:grid;gap:10px;min-width:0}
  .expert-options{max-height:190px;overflow:auto;border:1px solid #e2e8f0;border-radius:9px;padding:6px 9px;display:grid;gap:4px}
  .expert-options label{display:flex;gap:7px;align-items:center;font-size:13px}
  .expert-order{list-style:none;margin:0;padding:0;display:grid;gap:6px}
  .expert-order li{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:7px 9px;background:#fff;min-width:0}
  .expert-order li .drag{cursor:grab;color:#94a3b8}
  .expert-order li .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .clip-card{border:1px solid #e2e8f0;border-radius:11px;padding:10px;margin-bottom:10px}
  .clip-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
  .clip-media{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}
  .clip-media video{width:280px;max-width:100%;border-radius:8px;background:#0f172a}
  .clip-media img{width:160px;height:90px;object-fit:cover;border-radius:8px}
  .clip-meta{font-size:11px;color:#64748b;margin-top:4px}
  .attach-row{display:flex;gap:9px;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:7px 9px;margin-bottom:6px;flex-wrap:wrap}
  .attach-row .name{flex:1;min-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .attach-langs{display:flex;gap:8px;font-size:12px;color:#475569}
  .lang-check-row{display:flex;justify-content:space-between;gap:8px;width:100%;border:0;background:none;text-align:left;padding:6px 0;border-bottom:1px dashed #e2e8f0;cursor:pointer;font:inherit;color:inherit}
  .lang-check-row:last-child{border-bottom:0}
  .lang-check-row .st{font-size:11px;color:#94a3b8;text-align:right}
  .lang-check-row .st.bad{color:#b45309}
  .editor-card-preview{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff}
  .editor-card-preview .top{display:flex;gap:12px;align-items:center}
  .editor-card-preview img{width:74px;height:74px;border-radius:50%;object-fit:cover}
  .editor-card-preview .surname{width:74px;height:74px;border-radius:50%;background:#eef6f2;color:#21785b;display:flex;align-items:center;justify-content:center;font-size:26px;flex:none}
  .editor-card-preview h4{margin:0;font-size:16px}
  .editor-card-preview .tag{display:inline-block;background:#fef2f2;color:#b91c1c;border-radius:99px;padding:1px 8px;font-size:11px;margin-top:4px}
  .editor-card-preview p{font-size:12px;color:#475569;margin:8px 0 0;line-height:1.5}
  .editor-card-preview ul{margin:8px 0 0;padding-left:16px;font-size:11px;color:#475569}
  .editor-card-preview.is-big img,.editor-card-preview.is-big .surname{width:104px;height:104px;border-radius:14px}
  .editor-relation .rel-row{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #e2e8f0;font-size:12px}
  .editor-relation .rel-row:last-child{border-bottom:0}
  #editor-media-status{font-size:12px;color:#64748b;margin-top:6px;min-height:18px}
  `;
  document.head.appendChild(style);
}

// 老记录补齐新栏位；新记录补齐共用区和三种语言（不覆盖已有值）
export function ensureDraft(record, schema, options = null) {
  const T = schema?.TYPES?.[record.type];
  if (!T) return record;
  record.draft = record.draft || {};
  const shared = record.draft.shared = record.draft.shared || {};
  for (const f of T.shared) {
    if (f.key === 'experts') {
      const ids = Array.isArray(record.experts) && record.experts.length ? record.experts : (Array.isArray(shared.experts) ? shared.experts : []);
      shared.experts = ids.slice(0, 6);
      record.experts = ids.slice(0, 6);
      continue;
    }
    if (shared[f.key] === undefined) {
      shared[f.key] = f.type === 'check' ? false : f.type === 'image' ? null : f.type === 'select' ? '' : ['experts', 'factLabels', 'clips', 'files', 'list', 'outcomes'].includes(f.type) ? [] : '';
    }
  }
  for (const f of T.shared) {
    if ((f.type === 'clips' || f.type === 'files' || f.type === 'factLabels' || f.type === 'experts') && !Array.isArray(shared[f.key])) shared[f.key] = [];
  }
  for (const lang of schema.LANGS) {
    const v = record.draft[lang] = record.draft[lang] || {};
    for (const f of T.lang) {
      if (v[f.key] === undefined) v[f.key] = f.type === 'list' || f.type === 'outcomes' ? [] : '';
      else if (f.type === 'list' && !Array.isArray(v[f.key])) v[f.key] = asList(v[f.key]);
      else if (f.type === 'outcomes' && !Array.isArray(v[f.key])) v[f.key] = [];
    }
    if (record.type === 'experts') {
      if (!v.identity && v.role) v.identity = String(v.role);
      if (!v.bio && v.description) v.bio = String(v.description);
    }
  }
  // 旧记录还没有共用区：从旧的语言栏位推导（与服务端 normalizeDraft 一致，保存后正式写入）
  if (!shared.image) for (const lang of schema.LANGS) { const image = record.draft[lang]?.image; if (image) { shared.image = image; break; } }
  if (record.type === 'courses') {
    if (!shared.clips.length) {
      const oldClips = Array.isArray(record.draft.zh?.clips) ? record.draft.zh.clips : [];
      if (oldClips.length) {
        shared.clips = oldClips.filter(c => c && c.video).map(c => ({ video: c.video || null, cover: c.cover || null, duration: Number(c.duration) || 0 }));
        for (const lang of schema.LANGS) if (!record.draft[lang].clipTitles.length) record.draft[lang].clipTitles = (record.draft[lang]?.clips || []).map(c => String(c?.title || ''));
      }
    }
    if (!shared.attachments.length) {
      const byId = new Map();
      for (const lang of schema.LANGS) for (const item of record.draft[lang]?.attachments || []) {
        const file = item?.file?.id ? item.file : item?.id ? item : null;
        if (!file?.id) continue;
        const entry = byId.get(file.id) || { file, langs: [] };
        if (!entry.langs.includes(lang)) entry.langs.push(lang);
        byId.set(file.id, entry);
      }
      shared.attachments = [...byId.values()];
      for (const lang of schema.LANGS) if (!record.draft[lang].attachmentNames.length) record.draft[lang].attachmentNames = shared.attachments.map(item => {
        const old = (record.draft[lang]?.attachments || []).find(a => (a.file?.id || a.id) === item.file.id);
        return String(old?.displayName || '');
      });
    }
    if (!shared.category) {
      const name = String(record.draft.zh?.category || record.draft.vi?.category || record.draft.en?.category || '').trim();
      const option = (options?.courseCategories || []).find(o => o.zh === name);
      if (option) shared.category = option.id;
    }
  }
  return record;
}

function langCheck(record, lang, schema) {
  const T = schema.TYPES[record.type], v = record.draft?.[lang] || {}, missing = [], over = [];
  for (const f of T.lang) {
    if (f.required) {
      const value = v[f.key];
      const ok = f.type === 'list' ? asList(value).length >= (f.minItems || 1) : String(value ?? '').trim().length > 0;
      if (!ok) missing.push(f.label);
    }
    if (f.type === 'list' && f.max) asList(v[f.key]).forEach((x, i) => { if (count(x) > f.max) over.push(`${f.label}第 ${i + 1} 条 ${count(x)} / ${f.max}`); });
    if (f.type === 'outcomes') (Array.isArray(v[f.key]) ? v[f.key] : []).forEach((x, i) => {
      if (f.titleMax && count(x?.title) > f.titleMax) over.push(`${f.label}第 ${i + 1} 条小标题 ${count(x.title)} / ${f.titleMax}`);
      if (f.textMax && count(x?.text) > f.textMax) over.push(`${f.label}第 ${i + 1} 条说明 ${count(x.text)} / ${f.textMax}`);
    });
    if (f.max && !['list', 'outcomes'].includes(f.type) && count(v[f.key]) > f.max) over.push(`${f.label} ${count(v[f.key])} / ${f.max}`);
  }
  const started = T.lang.some(f => {
    const x = v[f.key];
    if (f.type === 'outcomes') return (Array.isArray(x) ? x : []).some(item => String(item?.title ?? '').trim() || String(item?.text ?? '').trim());
    if (Array.isArray(x)) return x.some(y => y && typeof y === 'object' ? Object.values(y).some(z => String(z ?? '').trim() !== '') : String(y ?? '').trim() !== '');
    return String(x ?? '').trim() !== '';
  });
  return { missing, over, complete: missing.length === 0, started };
}
export const languageStatus = (record, lang, schema) => langCheck(record, lang, schema);

function optionName(option, lang) {
  if (!option) return '';
  return option[lang] || option.zh || '';
}
function bigCardOthers(record, records) {
  return records.filter(r => r.type === 'experts' && r.id !== record.id && r.status === 'published' && (r.published?.shared?.bigCard ?? r.draft?.shared?.bigCard));
}
function courseExperts(record, records) {
  return (record.draft?.shared?.experts || record.experts || []).map(id => records.find(r => r.id === id)).filter(Boolean);
}

function counterHTML(text, field) {
  const n = count(text), cls = field.max && n > field.max ? 'over' : field.suggest && n > field.suggest ? 'warn' : '';
  const tip = field.max ? ` / ${field.max}` : field.suggest ? ` / 建议 ${field.suggest}` : '';
  return `<span class="ecount ${cls}" data-count="${field.key}">${n}${tip}</span>`;
}

function zhRef(zh, field, index = null) {
  const value = index === null ? zh?.[field.key] : (Array.isArray(zh?.[field.key]) ? zh[field.key][index] : '');
  const text = Array.isArray(value) ? value.join(' · ') : value;
  return String(text ?? '').trim() ? `<div class="zh-ref">中文：${esc(text)}</div>` : '';
}

function renderImageField(record, field, { preset, round = false, wide = false, label, required = false, ui }) {
  const image = record.draft.shared[field];
  return `<div class="efield"><label>${label}${required ? '<span class="req">*</span>' : ''}</label>
    <div class="se-media">
      ${image ? `<img class="${round ? 'is-round' : wide ? 'is-wide' : ''}" src="${ui.mediaURL(image)}" alt="${esc(image.name || label)}">` : `<div class="se-placeholder ${wide ? 'is-wide' : ''}">${ui.icon('upload')}<span>${round ? '正方形照片' : preset === 'qualification' ? '完整图片' : preset === 'case' ? '16:10 图片' : wide ? '16:9 图片' : '图片'}</span></div>`}
      <div class="se-media-actions">
        <div class="se-actions">${btn(image ? '替换图片' : '上传图片', `pick:${field}`)}${image ? btn('移除', `remove-shared:${field}`, 'text-btn danger-link') : ''}</div>
        <div class="small muted">JPG / PNG / WebP · 原图不超过 20MB${round ? ' · 上传后裁成正方形' : preset === 'qualification' ? ' · 不裁剪，完整显示，长边压到 2400 以内' : preset === 'case' ? ' · 上传后裁成 16:10' : ' · 上传后按比例裁剪'}</div>
      </div>
    </div>
    <input type="file" hidden data-editor-file="${field}" accept=".jpg,.jpeg,.png,.webp">
  </div>`;
}

function renderSharedExpert(record, records, ui) {
  const shared = record.draft.shared, big = bigCardOthers(record, records);
  return `<section class="se-block"><h3>① 共用（三种语言一样）</h3><p class="se-sub">照片只传一次，三种语言共用；勾选大卡后，专家页用大图卡片。</p>
    <div class="se-grid">
      ${renderImageField(record, 'image', { preset: 'expert', round: true, label: '照片', ui })}
      <div class="efield"><label>大卡展示</label>
        <label class="selection"><input type="checkbox" data-shared-check="bigCard" ${shared.bigCard ? 'checked' : ''}> 勾上的用大卡（一行 2 张）</label>
        <p class="used">已发布大卡 ${big.length} 位${big.length ? '：' + big.map(r => esc(r.published?.zh?.name || r.draft?.zh?.name || r.id)).join('、') : ''}，最多 4 位。大卡单数时最后一张居中。</p>
        ${shared.bigCard && big.length >= 4 ? '<p class="used" style="color:#b45309">已经 4 位大卡，发布前要先取消一位。</p>' : ''}
      </div>
    </div>
  </section>`;
}

function renderExpertPicker(record, records, ui) {
  const selected = record.draft.shared.experts || [], experts = records.filter(r => r.type === 'experts');
  return `<div class="efield"><label>授课专家<span class="req">*</span></label>
    <div class="expert-picker">
      <p class="used">从全部专家里搜索、勾选，最多 6 位；拖动或上移下移调整顺序，第一位自动标“主讲”。</p>
      <input data-expert-search placeholder="搜索专家姓名" aria-label="搜索专家">
      <div class="expert-options">${experts.length ? experts.map(e => {
        const name = e.draft?.zh?.name || e.published?.zh?.name || e.id;
        return `<label><input type="checkbox" data-expert-check="${esc(e.id)}" ${selected.includes(e.id) ? 'checked' : ''} ${!selected.includes(e.id) && selected.length >= 6 ? 'disabled' : ''}> ${esc(name)} <small class="muted">${e.status === 'published' ? '' : '未发布'}</small></label>`;
      }).join('') : '<p class="help">暂无专家，请先新增专家档案。</p>'}</div>
      <ol class="expert-order">${selected.map((id, i) => {
        const e = records.find(r => r.id === id), name = e?.draft?.zh?.name || id;
        return `<li draggable="true" data-expert-item="${esc(id)}"><span class="drag" title="拖动排序">≡</span><span class="name">${esc(name)}</span>${i === 0 ? '<span class="badge good">主讲</span>' : ''}<span class="row">${btn('↑', `expert-up:${i}`, 'text-btn mini', `aria-label="上移 ${esc(name)}"`)}${btn('↓', `expert-down:${i}`, 'text-btn mini', `aria-label="下移 ${esc(name)}"`)}${btn('移除', `expert-remove:${i}`, 'text-btn danger-link')}</span></li>`;
      }).join('')}</ol>
      ${selected.length ? '' : '<p class="help">还没有选择授课专家。</p>'}
    </div>
  </div>`;
}

function renderClips(record, ui) {
  const clips = record.draft.shared.clips || [];
  return `<div class="efield"><label>学习预览片段</label>
    <p class="used">每个片段：视频必传，封面选填（不选用第 1 秒画面）；建议不超过 6 个。</p>
    ${clips.map((clip, i) => `<div class="clip-card">
      <div class="clip-head"><strong class="small">片段 ${i + 1}</strong><div class="row">${btn('↑', `clip-up:${i}`, 'text-btn mini')}${btn('↓', `clip-down:${i}`, 'text-btn mini')}${btn('删除', `clip-remove:${i}`, 'text-btn danger-link')}</div></div>
      <div class="clip-media">
        ${clip.video ? `<div><video controls preload="metadata" src="${ui.mediaURL(clip.video)}" ${clip.cover ? `poster="${ui.mediaURL(clip.cover)}"` : ''}></video><div class="clip-meta">${clip.duration || clip.video.duration || 0} 秒 · ${clip.video.width || 0}×${clip.video.height || 0} · ${(clip.video.size / 1048576).toFixed(1)} MB</div></div>` : `<div class="se-placeholder is-wide">${ui.icon('upload')}<span>尚未上传视频</span></div>`}
        ${clip.cover ? `<img src="${ui.mediaURL(clip.cover)}" alt="片段 ${i + 1} 封面">` : ''}
      </div>
      <div class="se-actions" style="margin-top:8px">
        ${btn(clip.video ? '替换视频' : '上传视频', `pick:clip-video:${i}`)}
        ${clip.video ? btn('另传封面图', `pick:clip-cover:${i}`) : ''}
        ${clip.video ? `<label class="small muted">第 <input type="number" min="0" step="0.1" value="1" data-frame-time="${i}" style="width:64px"> 秒 ${btn('用这一帧做封面', `clip-frame:${i}`, 'text-btn')}</label>` : ''}
      </div>
      <input type="file" hidden data-editor-file="clip-video" data-clip="${i}" accept=".mp4">
      <input type="file" hidden data-editor-file="clip-cover" data-clip="${i}" accept=".jpg,.jpeg,.png,.webp">
    </div>`).join('')}
    ${btn('+ 添加预览片段', 'clip-add', '', 'style="width:100%;border-style:dashed"')}
    <div id="editor-media-status"></div>
  </div>`;
}

function renderAttachments(record, ui) {
  const files = record.draft.shared.attachments || [];
  return `<div class="efield"><label>资料附件</label>
    <p class="used">PDF / DOCX / XLSX / PPTX · 单个不超过 30MB；每个附件勾选在哪几种语言显示。</p>
    ${files.map((item, i) => `<div class="attach-row">${ui.icon('file')}<span class="name" title="${esc(item.file?.name)}">${esc(item.file?.name || '附件')}</span><small>${((item.file?.size || 0) / 1048576).toFixed(1)} MB</small><span class="attach-langs">${['zh', 'vi', 'en'].map(lang => `<label><input type="checkbox" data-attachment-lang="${i}:${lang}" ${(item.langs || []).includes(lang) ? 'checked' : ''}> ${lang.toUpperCase()}</label>`).join('')}</span>${btn('移除', `attach-remove:${i}`, 'text-btn danger-link')}</div>`).join('') || '<div class="small muted">尚未添加附件</div>'}
    ${btn('+ 添加附件', 'attach-add', '', 'style="width:100%;border-style:dashed"')}
    <input type="file" hidden data-editor-file="attachment" accept=".pdf,.docx,.xlsx,.pptx">
  </div>`;
}

function renderSharedCourse(record, options, records, ui) {
  const shared = record.draft.shared;
  const categories = options?.courseCategories || [], facts = options?.courseFacts || [];
  return `<section class="se-block"><h3>① 共用（三种语言一样）</h3><p class="se-sub">封面、分类、授课专家、片段和附件只填一次，三种语言共用。</p>
    <div class="se-grid">
      ${renderImageField(record, 'image', { preset: 'course', wide: true, label: '封面', required: true, ui })}
      <div class="efield"><label>分类<span class="req">*</span></label>
        <select data-shared-select="category"><option value="">请选择分类</option>${categories.filter(o => !o.disabled || shared.category === o.id).map(o => `<option value="${esc(o.id)}" ${shared.category === o.id ? 'selected' : ''}>${esc(o.zh)}${o.disabled ? '（已停用）' : ''}</option>`).join('')}</select>
        <p class="used">卡片角标、列表页筛选。新分类在“选项设置”里加。</p>
        ${categories.length ? '' : '<p class="used" style="color:#b45309">还没有课程分类，请先到“选项设置”添加。</p>'}
      </div>
    </div>
    ${renderExpertPicker(record, records, ui)}
    <div class="efield"><label>课程信息（名称）</label>
      <div class="se-actions">${facts.map(o => `<label class="selection"><input type="checkbox" data-fact-check="${esc(o.id)}" ${(shared.factLabels || []).includes(o.id) ? 'checked' : ''} ${!(shared.factLabels || []).includes(o.id) && (shared.factLabels || []).length >= 4 ? 'disabled' : ''}> ${esc(o.zh)}${o.disabled ? '（停用）' : ''}</label>`).join('') || '<span class="help">还没有课程信息名称，请先到“选项设置”添加。</span>'}</div>
      <p class="used">最多 4 条；具体内容在下面每种语言里分别填。</p>
    </div>
    ${renderClips(record, ui)}
    ${renderAttachments(record, ui)}
  </section>`;
}

function renderSharedMedia(record, records, ui) {
  const isCase = record.type === 'cases';
  const featured = !!record.featured;
  const canFeature = ui.canPublish() && record.status === 'published';
  const featuredCount = records.filter(r => r.type === record.type && r.featured).length;
  return `<section class="se-block"><h3>① 共用（三种语言一样）</h3><p class="se-sub">${isCase ? '案例图片裁成 16:10，三种语言共用。' : '资质图片完整显示、不裁剪，长边压到 2400 以内。'}</p>
    <div class="se-grid">
      ${renderImageField(record, 'image', { preset: isCase ? 'case' : 'qualification', wide: true, label: isCase ? '案例图片' : '资质图片', required: true, ui })}
      <div class="efield"><label>首页展示</label>
        <label class="selection"><input type="checkbox" data-featured ${featured ? 'checked' : ''} ${canFeature ? '' : 'disabled'}> 在首页${isCase ? '业务场景' : '资质区'}展示</label>
        <p class="used">最多 3 个；只有已发布的才能勾选，需要发布权限。${canFeature ? `当前已勾选 ${featuredCount} 个。` : record.status === 'published' ? '你的账号没有发布权限，不能修改首页展示。' : '发布后才能勾选。'}</p>
      </div>
    </div>
  </section>`;
}

function renderListField(record, tab, field, ui, { labels = null, addLabel = '添加一条' } = {}) {
  const v = record.draft[tab] || {}, zh = record.draft.zh || {};
  const aligned = !!labels;
  let values = asList(v[field.key]), zhValues = asList(zh[field.key]);
  if (aligned) values = labels.map((_, i) => values[i] || '');
  const atMax = field.maxItems && values.length >= field.maxItems;
  return `<div class="efield" data-field-anchor="${field.key}"><label>${field.label}${field.required ? '<span class="req">*</span>' : ''}</label>
    ${values.map((value, i) => `<div class="elist-row">
      ${aligned ? `<span class="small muted" style="width:88px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(labels[i] || '第 ' + (i + 1) + ' 条')}</span>` : ''}
      <input data-lang-list="${field.key}" data-index="${i}" value="${esc(value)}" placeholder="${aligned ? esc(labels[i] || '') : '第 ' + (i + 1) + ' 条'}">
      <span class="ecount ${field.max && count(value) > field.max ? 'over' : field.suggest && count(value) > field.suggest ? 'warn' : ''}" data-count="${field.key}:${i}">${count(value)}${field.max ? ' / ' + field.max : field.suggest ? ' / 建议 ' + field.suggest : ''}</span>
      ${aligned ? '' : `${btn('↑', `list-up:${field.key}:${i}`, 'text-btn mini')}${btn('↓', `list-down:${field.key}:${i}`, 'text-btn mini')}${btn('×', `list-del:${field.key}:${i}`, 'text-btn danger-link mini')}`}
    </div>${tab !== 'zh' && zhValues[i] ? `<div class="zh-ref" style="margin-left:${aligned ? '88px' : '0'}">中文：${esc(zhValues[i])}</div>` : ''}`).join('')}
    ${values.length ? '' : '<div class="small muted">还没有内容</div>'}
    ${aligned ? '' : btn(`+ ${addLabel}`, `list-add:${field.key}`, '', `style="margin-top:6px" ${atMax ? 'disabled' : ''}`)}
    <p class="used">${aligned ? '对应上面的共用项，按顺序填。' : ''}${!aligned && field.maxItems ? `最多 ${field.maxItems} 条。` : ''}${!aligned && field.minItems ? `至少 ${field.minItems} 条。` : ''}${field.usedIn ? '用在：' + esc(field.usedIn) : ''}</p>
  </div>`;
}

function renderOutcomes(record, tab, field) {
  const v = record.draft[tab] || {}, zh = record.draft.zh || {};
  const values = Array.isArray(v[field.key]) ? v[field.key] : [], zhValues = Array.isArray(zh[field.key]) ? zh[field.key] : [];
  const atMax = field.maxItems && values.length >= field.maxItems;
  return `<div class="efield" data-field-anchor="${field.key}"><label>${field.label}</label>
    ${values.map((item, i) => `<div class="outcome-row">
      <div class="elist-row"><input data-outcome-title="${i}" value="${esc(item?.title)}" placeholder="小标题"><span class="ecount ${field.titleMax && count(item?.title) > field.titleMax ? 'over' : ''}" data-count="${field.key}:${i}:title">${count(item?.title)}${field.titleMax ? ' / ' + field.titleMax : ''}</span></div>
      <div class="row"><input data-outcome-text="${i}" value="${esc(item?.text)}" placeholder="一句话说明"><span class="ecount ${field.textMax && count(item?.text) > field.textMax ? 'over' : ''}" data-count="${field.key}:${i}:text">${count(item?.text)}${field.textMax ? ' / ' + field.textMax : ''}</span>${btn('×', `outcome-del:${i}`, 'text-btn danger-link mini')}</div>
      ${tab !== 'zh' && zhValues[i] ? `<div class="zh-ref">中文：${esc(zhValues[i].title || '')}${zhValues[i].text ? ' · ' + esc(zhValues[i].text) : ''}</div>` : ''}
    </div>`).join('')}
    ${values.length ? '' : '<div class="small muted">还没有内容</div>'}
    ${btn('+ 添加一条', 'outcome-add', '', `style="margin-top:6px" ${atMax ? 'disabled' : ''}`)}
    <p class="used">最多 ${field.maxItems} 条；0 条时前台整块不显示。</p>
  </div>`;
}

function renderLangField(record, tab, field, options, ui) {
  const v = record.draft[tab] || {}, zh = record.draft.zh || {};
  if (field.key === 'factValues') {
    const labels = (record.draft.shared.factLabels || []).map(id => optionName((options?.courseFacts || []).find(o => o.id === id), tab));
    if (!labels.length) return `<div class="efield"><label>${field.label}</label><p class="used">先在共用区选择“课程信息（名称）”。</p></div>`;
    return renderListField(record, tab, field, ui, { labels });
  }
  if (field.key === 'clipTitles') {
    const clips = record.draft.shared.clips || [];
    if (!clips.length) return `<div class="efield"><label>${field.label}</label><p class="used">先在共用区添加学习预览片段。</p></div>`;
    return renderListField(record, tab, field, ui, { labels: clips.map((_, i) => `片段 ${i + 1}`), addLabel: '补一条标题' });
  }
  if (field.key === 'attachmentNames') {
    const files = record.draft.shared.attachments || [];
    if (!files.length) return `<div class="efield"><label>${field.label}</label><p class="used">先在共用区添加资料附件。</p></div>`;
    return renderListField(record, tab, field, ui, { labels: files.map(a => a.file?.name || '附件'), addLabel: '补一条名称' });
  }
  if (field.type === 'list') return renderListField(record, tab, field, ui);
  if (field.type === 'outcomes') return renderOutcomes(record, tab, field);
  const value = String(v[field.key] ?? ''), zhValue = String(zh[field.key] ?? '');
  const counter = `<span class="ecount ${field.max && count(value) > field.max ? 'over' : field.suggest && count(value) > field.suggest ? 'warn' : ''}" data-count="${field.key}">${count(value)}${field.max ? ' / ' + field.max : field.suggest ? ' / 建议 ' + field.suggest : ''}</span>`;
  return `<div class="efield" data-field-anchor="${field.key}"><label>${field.label}${field.required ? '<span class="req">*</span>' : ''}${counter}</label>
    ${tab !== 'zh' && zhValue.trim() ? `<div class="zh-ref">中文：${esc(zhValue)}</div>` : ''}
    ${field.type === 'text' ? `<textarea data-lang="${field.key}" rows="4" placeholder="${esc(field.example || '')}">${esc(value)}</textarea>` : `<input data-lang="${field.key}" value="${esc(value)}" placeholder="${esc(field.example || '')}">`}
    <p class="used">${field.usedIn ? '用在：' + esc(field.usedIn) : ''}</p>
  </div>`;
}

function renderLangSection(record, tab, schema, options, ui) {
  const T = schema.TYPES[record.type];
  return `<section class="se-block" id="editor-lang-section"><h3>② ${LANG_NAME[tab]}文字</h3><p class="se-sub">三种语言各填一份；没填完的语言发布后不显示，不会强制补齐。切到越南语、英文时，每一项上面灰字显示中文。</p>
    ${T.lang.map(field => renderLangField(record, tab, field, options, ui)).join('')}
  </section>`;
}

function renderPreview(record, tab, records, ui) {
  const v = record.draft[tab] || {}, shared = record.draft.shared || {};
  if (record.type === 'experts') {
    const big = !!shared.bigCard, name = v.name || '', surname = name ? [...name][0] : '姓';
    return `<div class="editor-card-preview ${big ? 'is-big' : ''}"><div class="top">${shared.image ? `<img src="${ui.mediaURL(shared.image)}" alt="">` : `<div class="surname">${esc(surname)}</div>`}<div><div class="eyebrow">EXPERT PROFILE</div><h4>${esc(name || '姓名')}</h4><div class="tag">${esc(v.identity || '身份')}</div></div></div><p>${esc(v.tagline || '一句话介绍')}</p>${asList(v.highlights).length ? `<ul>${asList(v.highlights).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  if (record.type === 'cases') return `<div class="editor-card-preview"><div class="top">${shared.image ? `<img src="${ui.mediaURL(shared.image)}" alt="" style="width:96px;height:60px;border-radius:8px">` : '<div class="surname" style="border-radius:8px">案</div>'}<div><div class="eyebrow">USE CASE</div><h4>${esc(v.name || '案例标题')}</h4><div class="tag">${esc(v.industry || '行业')}</div></div></div><p>${esc(v.description || '简介')}</p></div>`;
  if (record.type === 'qualifications') return `<div class="editor-card-preview"><div class="top">${shared.image ? `<img src="${ui.mediaURL(shared.image)}" alt="" style="width:96px;height:60px;border-radius:8px">` : '<div class="surname" style="border-radius:8px">资</div>'}<div><div class="eyebrow">CERTIFICATE</div><h4>${esc(v.name || '名称')}</h4></div></div><p>${esc(v.description || '简短说明')}</p></div>`;
  return `<div class="editor-card-preview"><div class="top">${shared.image ? `<img src="${ui.mediaURL(shared.image)}" alt="" style="width:88px;height:50px;border-radius:8px">` : '<div class="surname" style="border-radius:8px">课</div>'}<div><div class="eyebrow">AI LEARNING</div><h4>${esc(v.name || '课程名')}</h4></div></div><p>${esc(v.goals || '一句话目标')}</p><p class="small muted">${esc(v.audience || '适合人群')}</p></div>`;
}

function renderLangCheck(record, schema) {
  return `<div class="editor-lang-check">${schema.LANGS.map(lang => {
    const st = langCheck(record, lang, schema), zh = record.draft.zh || {}, v = record.draft[lang] || {};
    const zhOnly = schema.TYPES[record.type].lang.filter(f => hasValue(zh[f.key]) && !hasValue(v[f.key])).map(f => f.label);
    const target = st.missing.length ? (schema.TYPES[record.type].lang.find(f => f.required && !hasValue(v[f.key]))?.key || 'name') : 'name';
    return `<button type="button" class="lang-check-row" data-editor-action="jump:${lang}:${target}"><span>${LANG_NAME[lang]}</span><span class="st ${st.complete ? '' : 'bad'}">${st.complete ? '会显示' : '不会显示' + (st.missing.length ? '：缺 ' + esc(st.missing.join('、')) : '')}${st.over.length ? ' · ' + esc(st.over.slice(0, 2).join('；')) : ''}${zhOnly.length ? ' · 中文有，这里没有：' + esc(zhOnly.slice(0, 2).join('、')) : ''}</span></button>`;
  }).join('')}</div>`;
}

function renderRelation(record, records, ui) {
  if (record.type !== 'experts') return '';
  const courses = records.filter(r => r.type === 'courses' && ((r.experts || []).includes(record.id) || (r.draft?.shared?.experts || []).includes(record.id)));
  return `<section class="panel editor-relation"><div class="panel-head"><h3>授课课程</h3><span class="badge">只读</span></div><div class="panel-body">${courses.length ? courses.map(c => `<div class="rel-row"><span>${esc(c.draft?.zh?.name || c.published?.zh?.name || c.id)}</span>${btn('打开', `open-course:${esc(c.id)}`, 'text-btn')}</div>`).join('') : '<p class="help">这门课还没有出现在任何课程里。授课专家在课程表单里设置。</p>'}</div></section>`;
}

export function renderEditorPage(ctx) {
  ensureEditorStyles();
  const { record, tab, schema, options, records, ui, dirty } = ctx;
  const original = records.find(r => r.id === record.id);
  const T = schema.TYPES[record.type];
  const tabs = schema.LANGS.map(lang => {
    const st = langCheck(record, lang, schema), over = st.over.length;
    return `<button type="button" class="tab ${tab === lang ? 'active' : ''}" data-editor-action="tab:${lang}">${LANG_NAME[lang]}${!st.complete ? '<span class="badge" style="margin-left:6px">' + (st.missing.length ? '缺 ' + st.missing.length : '') + '</span>' : ''}${over ? '<span class="badge warn" style="margin-left:6px">超字数</span>' : ''}</button>`;
  }).join('');
  const stateLabel = ui.statusLabel[record.status] || record.status;
  return `<a class="back" href="#" data-action="back">${ui.icon('back')}返回${ui.types[record.type]}</a>
  <div class="page-heading"><div><div class="eyebrow">EDIT CONTENT</div><h1>${esc(ui.label(record))}</h1><p>${esc(record.id)} &nbsp;·&nbsp; <span class="badge ${record.status === 'published' ? 'good' : 'warn'}">${stateLabel}</span> ${original && ui.changed(original) ? '<span class="status-note">有未发布修改</span>' : ''}</p></div>${ui.btn(`${ui.icon('eye')}预览内容`, 'preview-edit')}</div>
  <div class="edit-layout"><section class="panel"><div class="tabs">${tabs}</div><div class="panel-body">
    ${record.type === 'experts' ? renderSharedExpert(record, records, ui) : record.type === 'courses' ? renderSharedCourse(record, options, records, ui) : renderSharedMedia(record, records, ui)}
    ${renderLangSection(record, tab, schema, options, ui)}
  </div></section>
  <aside class="edit-aside">
    <section class="panel"><div class="panel-head"><h3>页面上的样子</h3><span class="badge">${LANG_NAME[tab]}</span></div><div class="panel-body" id="editor-preview">${renderPreview(record, tab, records, ui)}</div></section>
    <section class="panel"><div class="panel-head"><h3>三语检查</h3></div><div class="panel-body" id="editor-lang-check">${renderLangCheck(record, schema)}</div></section>
    ${renderRelation(record, records, ui)}
    <section class="panel"><div class="aside-note">${ui.icon('info')}<br><strong style="color:var(--ink)">保存 ≠ 发布</strong><br>草稿只在后台可见。发布后才更新前台；没填完的语言发布后不显示，不会强制补齐。<br><br>共用项（照片、封面、分类、专家、片段、附件）只填一次，三种语言共用。</div></section>
  </aside></div>
  <div class="sticky-bottom"><div class="small muted" id="save-status">${dirty ? '● 有未保存的修改' : ctx.saved ? '所有更改已保存到本地后台' : '新内容，填写后请保存草稿'}</div><div class="actions">${ui.btn('保存草稿', 'save')}${ui.btn('预览', 'preview-edit')}${ui.canPublish() ? ui.btn(`${ui.icon('check')}发布内容`, 'publish-edit', 'primary') : '<span class="small muted">你的账号只能保存草稿，发布请联系主管理员</span>'}</div></div>`;
}

function refreshCounters(record, tab, schema) {
  const T = schema.TYPES[record.type];
  document.querySelectorAll('[data-count]').forEach(el => {
    const parts = el.dataset.count.split(':'), field = T.lang.find(f => f.key === parts[0]);
    if (!field) return;
    let value, max, suggest;
    if (parts.length === 1) { value = record.draft[tab]?.[parts[0]]; max = field.max; suggest = field.suggest; }
    else if (parts.length === 2) { value = asList(record.draft[tab]?.[parts[0]])[Number(parts[1])]; max = field.max; suggest = field.suggest; }
    else { const item = (record.draft[tab]?.[parts[0]] || [])[Number(parts[1])]; value = parts[2] === 'title' ? item?.title : item?.text; max = parts[2] === 'title' ? field.titleMax : field.textMax; }
    const n = count(value);
    el.textContent = n + (max ? ` / ${max}` : suggest ? ` / 建议 ${suggest}` : '');
    el.className = 'ecount ' + (max && n > max ? 'over' : suggest && n > suggest ? 'warn' : '');
  });
}

// 把表单事件接起来；上传、裁剪、视频首帧都走 media.js
export function bindEditor(ctx) {
  ensureEditorStyles();
  const { record, schema, records, tab, ui } = ctx;
  const T = schema.TYPES[record.type];
  const ask = ctx.ask || ((title, message) => Promise.resolve('ok'));
  const setStatus = text => { const el = document.querySelector('#editor-media-status'); if (el) el.textContent = text; };
  const refresh = () => {
    refreshCounters(record, tab, schema);
    const preview = document.querySelector('#editor-preview');
    if (preview) preview.innerHTML = renderPreview(record, tab, records, ui);
    const check = document.querySelector('#editor-lang-check');
    if (check) check.innerHTML = renderLangCheck(record, schema);
    if (ctx.onChange) ctx.onChange();
  };
  const listOf = key => {
    const v = record.draft[tab];
    if (!Array.isArray(v[key])) v[key] = asList(v[key]);
    return v[key];
  };
  const fileInput = (field, clip) => document.querySelector(`[data-editor-file="${field}"]${clip === undefined ? '' : `[data-clip="${clip}"]`}`);
  let uploading = false;

  for (const el of document.querySelectorAll('[data-lang]')) el.oninput = () => { record.draft[tab][el.dataset.lang] = el.value; refresh(); };
  for (const el of document.querySelectorAll('[data-lang-list]')) el.oninput = () => { listOf(el.dataset.langList)[Number(el.dataset.index)] = el.value; refresh(); };
  for (const el of document.querySelectorAll('[data-outcome-title]')) el.oninput = () => { const item = record.draft[tab].outcomes[Number(el.dataset.outcomeTitle)] || {}; item.title = el.value; record.draft[tab].outcomes[Number(el.dataset.outcomeTitle)] = item; refresh(); };
  for (const el of document.querySelectorAll('[data-outcome-text]')) el.oninput = () => { const item = record.draft[tab].outcomes[Number(el.dataset.outcomeText)] || {}; item.text = el.value; record.draft[tab].outcomes[Number(el.dataset.outcomeText)] = item; refresh(); };
  for (const el of document.querySelectorAll('[data-shared-check]')) el.onchange = () => { record.draft.shared[el.dataset.sharedCheck] = el.checked; ctx.rerender(); };
  for (const el of document.querySelectorAll('[data-featured]')) el.onchange = () => { record.featured = el.checked; if (ctx.onChange) ctx.onChange(); };
  for (const el of document.querySelectorAll('[data-shared-select]')) el.onchange = () => { record.draft.shared[el.dataset.sharedSelect] = el.value; refresh(); };
  for (const el of document.querySelectorAll('[data-fact-check]')) el.onchange = () => {
    let ids = [...(record.draft.shared.factLabels || [])], id = el.dataset.factCheck;
    if (el.checked) { if (ids.length >= 4) { el.checked = false; ctx.toast('课程信息最多 4 条。'); return; } if (!ids.includes(id)) ids.push(id); }
    else ids = ids.filter(x => x !== id);
    record.draft.shared.factLabels = ids;
    ctx.rerender();
  };
  for (const el of document.querySelectorAll('[data-expert-check]')) el.onchange = () => {
    let ids = [...(record.draft.shared.experts || [])], id = el.dataset.expertCheck;
    if (el.checked) { if (ids.length >= 6) { el.checked = false; ctx.toast('最多选 6 位授课专家。'); return; } if (!ids.includes(id)) ids.push(id); }
    else ids = ids.filter(x => x !== id);
    record.draft.shared.experts = ids; record.experts = ids;
    ctx.rerender();
  };
  for (const el of document.querySelectorAll('[data-attachment-lang]')) el.onchange = () => {
    const [index, lang] = el.dataset.attachmentLang.split(':'); const item = record.draft.shared.attachments[Number(index)];
    if (!item) return; const langs = new Set(item.langs || []);
    if (el.checked) langs.add(lang); else langs.delete(lang);
    if (!langs.size) { el.checked = true; ctx.toast('附件至少勾选一种显示语言。'); return; }
    item.langs = [...langs];
    if (ctx.onChange) ctx.onChange();
  };
  const search = document.querySelector('[data-expert-search]');
  if (search) search.oninput = () => { const q = search.value.trim().toLowerCase(); for (const label of document.querySelectorAll('.expert-options label')) label.style.display = !q || label.textContent.toLowerCase().includes(q) ? '' : 'none'; };

  let dragIndex = null;
  for (const [index, li] of [...document.querySelectorAll('[data-expert-item]')].entries()) {
    li.ondragstart = event => { dragIndex = index; event.dataTransfer.effectAllowed = 'move'; try { event.dataTransfer.setData('text/plain', String(index)); } catch { } };
    li.ondragover = event => event.preventDefault();
    li.ondrop = event => {
      event.preventDefault();
      const from = dragIndex ?? Number(event.dataTransfer.getData('text/plain')), to = index;
      if (!Number.isInteger(from) || from === to) return;
      const ids = [...(record.draft.shared.experts || [])], [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved); record.draft.shared.experts = ids; record.experts = ids; dragIndex = null; ctx.rerender();
    };
  }

  async function handleFile(input) {
    if (uploading) return;
    const file = input.files?.[0], field = input.dataset.editorFile, clipIndex = input.dataset.clip === undefined ? null : Number(input.dataset.clip);
    input.value = '';
    if (!file) return;
    uploading = true;
    try {
      if (field === 'image') {
        const preset = { experts: 'expert', courses: 'course', cases: 'case', qualifications: 'qualification' }[record.type] || 'course';
        const prepared = await prepareAndUploadImage(file, { preset, onProgress: p => setStatus(`正在上传图片 ${p}%`) });
        if (!prepared) return;
        record.draft.shared.image = prepared.saved;
        if (prepared.warn) ctx.toast(prepared.warn);
        setStatus(''); ctx.toast('图片已上传，点击保存草稿后写入内容'); ctx.rerender();
      } else if (field === 'clip-video') {
        const check = validateMediaFile(file, 'video'); if (!check.ok) { ctx.toast(check.error); return; }
        setStatus('正在读取视频信息…');
        const prepared = await prepareVideo(file);
        setStatus('正在上传视频…');
        const video = await uploadMedia(prepared.file, { name: prepared.file.name, onProgress: p => setStatus(`正在上传视频 ${p}%`) });
        let cover = null;
        if (prepared.cover) { try { cover = await uploadMedia(prepared.cover.blob, { name: '片段封面.jpg' }); } catch { } }
        const clip = record.draft.shared.clips[clipIndex] || {};
        clip.video = video; clip.cover = cover || clip.cover || null; clip.duration = video.duration || prepared.meta.duration || 0;
        record.draft.shared.clips[clipIndex] = clip;
        setStatus(''); ctx.toast('视频已上传，点击保存草稿后写入内容'); ctx.rerender();
      } else if (field === 'clip-cover') {
        const prepared = await prepareCoverImage(file); if (!prepared) return;
        const cover = await uploadMedia(prepared.file, { name: prepared.name, onProgress: p => setStatus(`正在上传封面 ${p}%`) });
        record.draft.shared.clips[clipIndex].cover = cover;
        setStatus(''); ctx.toast('封面已上传'); ctx.rerender();
      } else if (field === 'attachment') {
        const check = validateMediaFile(file, 'attachment'); if (!check.ok) { ctx.toast(check.error); return; }
        setStatus('正在上传附件…');
        const saved = await uploadMedia(file, { name: file.name, onProgress: p => setStatus(`正在上传附件 ${p}%`) });
        record.draft.shared.attachments.push({ file: saved, langs: ['zh', 'vi', 'en'] });
        setStatus(''); ctx.toast('附件已上传，点击保存草稿后写入内容'); ctx.rerender();
      }
    } catch (error) {
      setStatus(''); ctx.toast(error.message || '上传失败');
    } finally { uploading = false; }
  }
  for (const input of document.querySelectorAll('[data-editor-file]')) input.onchange = () => handleFile(input);

  async function useFrame(index) {
    const clip = record.draft.shared.clips[index];
    if (!clip?.video) return;
    const time = Number(document.querySelector(`[data-frame-time="${index}"]`)?.value || 1);
    setStatus('正在截取视频画面…');
    try {
      const response = await fetch(`/media/${encodeURIComponent(clip.video.id)}`);
      if (!response.ok) throw Error('读取视频失败，请重新上传视频。');
      const blob = await response.blob();
      const file = new File([blob], clip.video.name || 'video.mp4', { type: clip.video.mime || 'video/mp4' });
      const frame = await captureFrame(file, time);
      clip.cover = await uploadMedia(frame.blob, { name: '片段封面.jpg' });
      setStatus(''); ctx.toast(`已用第 ${time} 秒的画面做封面`); ctx.rerender();
    } catch (error) { setStatus(''); ctx.toast(error.message || '截取封面失败'); }
  }

  async function runAction(act, a, b) {
    if (act === 'tab') { if (ctx.setTab) ctx.setTab(a); return; }
    if (act === 'pick') { fileInput(a, b === undefined ? undefined : Number(b))?.click(); return; }
    if (act === 'remove-shared') {
      if (await ask('移除这个共用文件？', '三种语言都会移除；已发布版本保留到再次发布。') !== 'ok') return;
      record.draft.shared[a] = null; ctx.rerender(); return;
    }
    if (act === 'list-add' || act === 'list-del' || act === 'list-up' || act === 'list-down') {
      const key = a, arr = listOf(key);
      if (act === 'list-add') {
        const field = T.lang.find(f => f.key === key);
        if (field?.maxItems && arr.length >= field.maxItems) return;
        arr.push('');
      } else {
        const i = Number(b), j = act === 'list-up' ? i - 1 : i + 1;
        if (act === 'list-del') arr.splice(i, 1);
        else if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      ctx.rerender(); return;
    }
    if (act === 'outcome-add') { const arr = record.draft[tab].outcomes = Array.isArray(record.draft[tab].outcomes) ? record.draft[tab].outcomes : []; if (arr.length < 3) arr.push({ title: '', text: '' }); ctx.rerender(); return; }
    if (act === 'outcome-del') { record.draft[tab].outcomes.splice(Number(a), 1); ctx.rerender(); return; }
    if (act === 'clip-add') { record.draft.shared.clips.push({ video: null, cover: null, duration: 0 }); ctx.rerender(); return; }
    if (act === 'clip-remove') { record.draft.shared.clips.splice(Number(a), 1); ctx.rerender(); return; }
    if (act === 'clip-up' || act === 'clip-down') {
      const clips = record.draft.shared.clips, i = Number(a), j = act === 'clip-up' ? i - 1 : i + 1;
      if (j >= 0 && j < clips.length) [clips[i], clips[j]] = [clips[j], clips[i]];
      ctx.rerender(); return;
    }
    if (act === 'clip-frame') { await useFrame(Number(a)); return; }
    if (act === 'attach-add') { fileInput('attachment')?.click(); return; }
    if (act === 'attach-remove') { record.draft.shared.attachments.splice(Number(a), 1); ctx.rerender(); return; }
    if (act === 'expert-up' || act === 'expert-down' || act === 'expert-remove') {
      const ids = [...(record.draft.shared.experts || [])], i = Number(a);
      if (act === 'expert-remove') ids.splice(i, 1);
      else { const j = act === 'expert-up' ? i - 1 : i + 1; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; }
      record.draft.shared.experts = ids; record.experts = ids; ctx.rerender(); return;
    }
    if (act === 'jump') {
      if (ctx.setTab) ctx.setTab(a);
      setTimeout(() => document.querySelector(`[data-field-anchor="${b}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 40);
      return;
    }
    if (act === 'open-course' && ctx.openCourse) { await ctx.openCourse(a); return; }
  }

  for (const el of document.querySelectorAll('[data-editor-action]')) el.onclick = async event => {
    event.preventDefault();
    const [act, a, b] = el.dataset.editorAction.split(':');
    await runAction(act, a, b);
  };
}
