// 应用案例页面：/{lang}/cases/{slug}/
// 案例内容来自后台“应用案例”中已发布的记录，每次请求时读取，后台发布或下架后前台自动更新。
const fs = require('fs'), path = require('path');
const frontData = require('./前台数据.cjs');

const L = {
  zh: { overview: '案例概览', industryLabel: '行业', flowLabel: '实施过程', moreCases: '查看全部案例', deliverLabel: '交付成果', listTitle: '全部应用案例', listIntro: '来自制造、贸易和服务企业的真实工作场景。每个案例都写清业务问题、AI 的用法、人员分工和交付成果。', viewCase: '查看案例', listCta: '想了解适合您企业的应用方式？', listCtaBtn: '预约咨询', crumb: '应用案例', caseNo: '应用案例', problem: '业务问题', how: '应用方式', people: '人员分工', deliverables: '交付成果', evaluation: '评估重点', imageNote: '应用案例示意', prev: '上一个案例', next: '下一个案例', cta: '咨询类似方案', aboutTitle: '关于EVOL DREAM | EVOL DREAM', aboutNav: '关于我们', option: ['项目实施', '合作交流'], notFound: '没有找到这个案例' },
  vi: { overview: 'Tổng quan tình huống', industryLabel: 'Ngành', flowLabel: 'Quá trình triển khai', moreCases: 'Xem tất cả tình huống', deliverLabel: 'Sản phẩm bàn giao', listTitle: 'Tất cả tình huống ứng dụng', listIntro: 'Các tình huống công việc thực tế từ doanh nghiệp sản xuất, thương mại và dịch vụ. Mỗi tình huống nêu rõ bài toán nghiệp vụ, cách ứng dụng AI, vai trò của nhân sự và sản phẩm bàn giao.', viewCase: 'Xem tình huống', listCta: 'Muốn tìm cách ứng dụng phù hợp với doanh nghiệp của bạn?', listCtaBtn: 'Đăng ký tư vấn', crumb: 'Tình huống ứng dụng', caseNo: 'Tình huống ứng dụng', problem: 'Bài toán nghiệp vụ', how: 'Cách ứng dụng', people: 'Vai trò của nhân sự', deliverables: 'Sản phẩm bàn giao', evaluation: 'Trọng tâm đánh giá', imageNote: 'Minh họa tình huống ứng dụng', prev: 'Tình huống trước', next: 'Tình huống tiếp theo', cta: 'Tư vấn giải pháp tương tự', aboutTitle: 'Về EVOL DREAM | EVOL DREAM', aboutNav: 'Về chúng tôi', option: ['Dự án AI', 'Hợp tác'], notFound: 'Không tìm thấy tình huống này' },
  en: { overview: 'Case overview', industryLabel: 'Industry', flowLabel: 'How it works', moreCases: 'View all cases', deliverLabel: 'Deliverables', listTitle: 'All use cases', listIntro: 'Real work scenarios from manufacturing, trading and service companies. Each case sets out the business problem, how AI is used, the role of people and the deliverables.', viewCase: 'View case', listCta: 'Want to find the right AI application for your company?', listCtaBtn: 'Get in touch', crumb: 'Use cases', caseNo: 'Use case', problem: 'Business problem', how: 'How AI is used', people: 'Role of people', deliverables: 'Deliverables', evaluation: 'Evaluation focus', imageNote: 'Illustrative scenario', prev: 'Previous case', next: 'Next case', cta: 'Discuss a similar project', aboutTitle: 'About EVOL DREAM | EVOL DREAM', aboutNav: 'About us', option: ['Implementation', 'Partnerships'], notFound: 'Case not found' }
};

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const lines = v => String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
// 读取某语言可显示的案例：编号按后台已发布案例的 order 排列，该语言没填完的案例不显示
function loadCases(lang, override = null) { return frontData.cases(lang, override); }

// 用“关于我们”页面作为外框（页头、页脚、联系表单），只替换中间内容
function shell(lang, publicRoot, pagePath, title, desc, main) {
  const t = L[lang];
  let s = fs.readFileSync(path.join(publicRoot, lang, 'about', 'index.html'), 'utf8');
  const oldDesc = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (oldDesc) s = s.split(oldDesc).join(esc(desc));
  s = s.split(t.aboutTitle).join(esc(title));
  for (const l2 of ['zh', 'vi', 'en']) s = s.split(`/${l2}/about/`).join(`/${l2}/${pagePath}`);
  s = s.replace('<link rel="stylesheet" href="/mvp.css">', '<link rel="stylesheet" href="/mvp.css"><link rel="stylesheet" href="/service-page.css"><link rel="stylesheet" href="/case-page.css">');
  s = s.replace(`<a href="/${lang}/${pagePath}" class="active" aria-current="page">${t.aboutNav}</a>`, `<a href="/${lang}/about/">${t.aboutNav}</a>`);
  const i = s.indexOf('<main id="main">'), j = s.indexOf('<section class="contact-section"');
  s = s.slice(0, i) + main + s.slice(j);
  const [opt, def] = t.option;
  const imp = `<option value="implementation">${opt}</option>`;
  if (s.includes(imp)) s = s.replace(imp, `<option value="implementation" selected>${opt}</option>`).replace(`<option value="partnerships" selected>${def}</option>`, `<option value="partnerships">${def}</option>`);
  return s;
}

function crumbs(lang, publicRoot, items) {
  const about = fs.readFileSync(path.join(publicRoot, lang, 'about', 'index.html'), 'utf8');
  const m = about.match(new RegExp(`<nav class="breadcrumbs" aria-label="([^"]*)"><a href="/${lang}/">([^<]*)</a>`));
  const label = m ? m[1] : '', home = m ? m[2] : '';
  return `<nav class="breadcrumbs" aria-label="${label}"><a href="/${lang}/">${home}</a>` + items.map(([text, href]) => `<span aria-hidden="true">/</span>` + (href ? `<a href="${href}">${esc(text)}</a>` : `<span>${esc(text)}</span>`)).join('') + `</nav>`;
}

function renderDetail(lang, slug, publicRoot, override = null) {
  const t = L[lang], cases = loadCases(lang, override);
  const index = cases.findIndex(c => c.slug === slug);
  if (index < 0) return null;
  const c = cases[index], d = c[lang];
  const prev = cases[index - 1], next = cases[index + 1];
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const navCard = (item, label, cls) => item ? `<a class="case-pn ${cls}" href="/${lang}/cases/${item.slug}/"><img src="${esc(item.image)}" alt="" loading="lazy" decoding="async" width="1600" height="532"><span><small>${esc(label)}</small><b>${esc(item[lang].title)}</b><em>${esc(item[lang].industry)}</em></span></a>` : `<span class="case-pn ${cls} is-empty"></span>`;
  const step = (n, title, body) => `<li class="case-step"><span class="case-step-no">${n}</span><div><h2>${esc(title)}</h2>${body}</div></li>`;
  const main = `<main id="main"><section class="page-hero case-hero2"><div class="container case-hero2-grid"><div class="case-hero2-text">${crumbs(lang, publicRoot, [[t.crumb, `/${lang}/cases/`], [d.title]])}`
    + `<p class="case-hero2-meta"><span>${esc(c.no)}</span>${esc(d.industry)}</p><h1>${esc(d.title)}</h1><p class="intro">${esc(d.summary)}</p>`
    + (d.highlight ? `<blockquote class="case-hero2-quote">${esc(d.highlight)}</blockquote>` : '') + `</div>`
    + `<figure class="case-hero2-figure"><img src="${esc(c.image)}" alt="${esc(d.title)}" width="1600" height="532"><figcaption><b>${esc(c.no)}</b><span>${esc(d.industry)}<br><small>${esc(t.imageNote)}</small></span></figcaption></figure></div></section>`
    + `<section class="svc-section case-body2"><div class="container case-body2-grid"><div class="case-main">`
    + `<p class="eyebrow">${esc(t.flowLabel)}</p><ol class="case-steps">`
    + step('01', t.problem, `<p>${esc(d.problem)}</p>`)
    + step('02', t.how, `<ol class="case-how">${d.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`)
    + step('03', t.people, `<p>${esc(d.people)}</p>`)
    + `</ol></div>`
    + `<aside class="case-aside"><div class="case-aside-card"><p class="case-aside-title">${esc(t.overview)}</p>`
    + `<dl><div><dt>${esc(t.industryLabel)}</dt><dd>${esc(d.industry)}</dd></div>`
    + `<div><dt>${esc(t.deliverables)}</dt><dd><ul>${d.deliverables.map(x => `<li>${CHECK}<span>${esc(x)}</span></li>`).join('')}</ul></dd></div>`
    + (d.evaluation ? `<div><dt>${esc(t.evaluation)}</dt><dd>${esc(d.evaluation)}</dd></div>` : '') + `</dl>`
    + `<a class="button primary" href="#contact">${esc(t.cta)}</a></div></aside></div></section>`
    + `<section class="case-pn-section"><div class="container"><div class="case-pn-grid">${navCard(prev, t.prev, 'is-prev')}${navCard(next, t.next, 'is-next')}</div><p class="case-pn-all"><a href="/${lang}/cases/">${esc(t.moreCases)} <i aria-hidden="true">→</i></a></p></div></section>`;
  return shell(lang, publicRoot, `cases/${c.slug}/`, `${d.title} | EVOL DREAM`, d.summary, main);
}

function renderList(lang, publicRoot, override = null) {
  const t = L[lang], cases = loadCases(lang, override);
  const cards = cases.map(c => { const d = c[lang]; return `<li><a class="case-card" href="/${lang}/cases/${c.slug}/"><div class="case-card-media"><img src="${esc(c.image)}" alt="${esc(d.title)}" loading="lazy" decoding="async" width="1600" height="532"><span class="case-card-no">${esc(c.no)}</span></div><div class="case-card-body"><p class="case-card-meta">${esc(d.industry)}</p><h2>${esc(d.title)}</h2><p class="case-card-summary">${esc(d.summary)}</p><div class="case-card-tags" aria-label="${esc(t.deliverLabel)}">${(d.deliverables || []).map(x => `<span>${esc(x)}</span>`).join('')}</div><span class="case-card-link">${esc(t.viewCase)} <i aria-hidden="true">→</i></span></div></a></li>`; }).join('');
  const main = `<main id="main"><section class="page-hero case-list-hero"><div class="container">${crumbs(lang, publicRoot, [[t.crumb]])}<h1>${esc(t.listTitle)}</h1><p class="intro">${esc(t.listIntro)}</p></div></section>`
    + `<section class="svc-section case-list-section"><div class="container"><ul class="case-grid">${cards}</ul>`
    + `<div class="svc-closing case-list-cta"><p>${esc(t.listCta)}</p><div class="hero-actions"><a class="button primary" href="#contact">${esc(t.listCtaBtn)}</a></div></div></div></section>`;
  return shell(lang, publicRoot, 'cases/', `${t.listTitle} | EVOL DREAM`, t.listIntro, main);
}

function render(lang, slug, publicRoot, override = null) {
  if (!L[lang]) return { status: 404, body: 'Not found' };
  if (!slug) return { status: 200, body: renderList(lang, publicRoot, override) };
  if (slug) {
    const body = renderDetail(lang, slug, publicRoot, override);
    if (body) return { status: 200, body };
  }
  const main = `<main id="main"><section class="page-hero"><div class="container"><h1>${esc(L[lang].notFound)}</h1><div class="hero-actions"><a class="button primary" href="/${lang}/#scenarios">← ${esc(L[lang].crumb)}</a></div></div></section>`;
  return { status: 404, body: shell(lang, publicRoot, 'cases/', `${L[lang].notFound} | EVOL DREAM`, L[lang].notFound, main) };
}

module.exports = { render, loadCases };
