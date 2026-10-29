// 检查真网站（默认查改版预览站 http://127.0.0.1:4273），页面从各语言首页顺着链接自动找全：
// 1. 电脑 1366×768、1440×900、1920×1080：<main> 里每个区块高度 ≤ 视口高 − 页头高（“一屏”）。
//    第一块深色首屏伸到页头后面、从页面最顶上开始时（2026-10-28 页头照豆包），它的可用高度是整个视口高。
//    分三档（用户 2026-10-28 定）：课程页、专家页必须一屏；隐私、条款不要求；其他页面尽量一屏，超了只提示、不算问题
// 2. 手机 390×844：页面不能左右滑动
// 3. 坏图、加载失败的请求、页面脚本报错
// 4. 文字对比度（正文 ≥ 4.5:1，大字 ≥ 3:1）、小于 12px 的字（在 1366 宽下查）
// 5. 英文、越南语页面不能出现中文（语言切换里标了 lang="zh" 的“中文”除外，规则同 tests/验证前台语言隔离.cjs）
// 加 --shots 目录：同时拍电脑版（1366 宽）和手机版（390 宽）整页截图。
// 用法：node 检查网站.cjs [--base 网址] [--lang zh,vi,en] [--only 网址规则，如 courses 或 ^/zh/$] [--shots 截图目录] [--report 报告.md]
const { chromium } = require('D:/项目/node_modules/playwright');
const fs = require('fs'), path = require('path');

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://127.0.0.1:4273').replace(/\/+$/, '');
const langs = arg('lang', 'zh,vi,en').split(',');
const only = arg('only', '');
const shotDir = arg('shots', '');
const reportFile = arg('report', '') || (shotDir && path.join(shotDir, '检查结果.md'));
const DESKTOP = [[1366, 768], [1440, 900], [1920, 1080]];
const PHONE = { width: 390, height: 844 };
const MAX_SHOT = 16000; // Chrome 整页截图超过这个高度可能不完整
// 一屏规则分三档：must 必须一屏（课程页、专家页，甲方 10-26 的要求）、none 不要求（长文）、soft 尽量一屏（其他页面）
const screenRule = p => /\/(courses|teachers)\//.test(p) ? 'must' : /\/(privacy|terms)\//.test(p) ? 'none' : 'soft';
const overCount = r => r.rule === 'none' ? 0 : r.desk.filter(d => d.over.length).length;

// 从首页顺着链接找出这种语言的全部页面；感谢页只有提交表单后才会跳到，单独加上
async function crawl(lang) {
  const root = `/${lang}/`, origin = new URL(base).origin, pages = new Map(), queue = [root, `/${lang}/thank-you/`];
  while (queue.length) {
    const p = queue.shift();
    if (pages.has(p)) continue;
    const res = await fetch(base + p), html = await res.text();
    pages.set(p, { status: res.status, title: ((html.match(/<title>([^<]*)/) || [])[1] || '').split(' | ')[0].trim() });
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      let u; try { u = new URL(href.replace(/&amp;/g, '&'), base + p); } catch { continue; }
      if (u.origin !== origin || !u.pathname.startsWith(root) || /\.\w+$/.test(u.pathname)) continue;
      const q = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      if (!pages.has(q) && !queue.includes(q)) queue.push(q);
    }
  }
  return pages;
}

// 截图文件名用中文页面标题，三种语言同一个页面同一个编号，方便对照
const clean = s => s.replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 30);
function labeler(pagesByLang) {
  const title = rest => { for (const l of Object.keys(pagesByLang)) { const t = pagesByLang[l].get(`/${l}/${rest}`)?.title; if (t) return t; } return ''; };
  return rest => {
    if (!rest) return '首页';
    const parts = rest.replace(/\/$/, '').split('/');
    const own = clean(title(rest)) || parts.at(-1);
    return parts.length > 1 ? `${clean(title(parts[0] + '/')) || parts[0]}-${own}` : own;
  };
}

// 以下几个函数在浏览器里运行
async function settle(scroll) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
  // 网站样式里有 scroll-behavior:smooth，滚动要用 instant，否则截图时页面还没回到顶部，吸顶页头会画在页面中间
  if (scroll) for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo({ top: y, behavior: 'instant' }); await wait(50); }
  scrollTo({ top: 0, behavior: 'instant' });
  // 页头回到顶上时颜色有 0.3 秒渐变，等它变完再查对比度
  await wait(400);
  const pending = [...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }));
  await Promise.race([Promise.all(pending), wait(8000)]);
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function measure() {
  const header = document.querySelector('.site-header') || document.querySelector('header');
  const headerH = header ? Math.round(header.getBoundingClientRect().height) : 0;
  const main = document.querySelector('main') || document.body;
  const sections = [...main.querySelectorAll('section')]
    .filter(s => !s.parentElement.closest('section') && s.getBoundingClientRect().height > 0)
    .map(s => { const t = s.querySelector('h1,h2'), r = s.getBoundingClientRect(), top = Math.round(r.top + scrollY); return { name: (s.id || s.classList[0] || 'section') + (t ? `「${t.textContent.trim().replace(/\s+/g, ' ').slice(0, 12)}」` : ''), h: Math.round(r.height), limit: top < headerH ? innerHeight - top : innerHeight - headerH }; });
  return { headerH, avail: innerHeight - headerH, sections, pageH: document.documentElement.scrollHeight };
}

function overflowX() {
  const over = document.documentElement.scrollWidth - innerWidth, W = innerWidth + 1;
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join('');
  // 只列最外层超出的元素：它自己超出右边，它的父元素没超出
  const culprits = over <= 0 ? [] : [...document.querySelectorAll('body *')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W && e.parentElement.getBoundingClientRect().right <= W; })
    .slice(0, 5).map(e => `${desc(e)} 超出 ${Math.round(e.getBoundingClientRect().right - innerWidth)}px`);
  return { over: Math.max(0, over), culprits, pageH: document.documentElement.scrollHeight };
}

function textCheck(checkChinese) {
  const rgb = s => { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  // 往上找第一层不透明的背景色，返回 [颜色, 带这个背景的元素]。遇到背景图片算不出来；
  // 只有渐变时，底下有不透明底色就按底色算（深色色带上叠的光晕、网格很淡），没有底色也算不出来
  const bgOf = el => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e), c = rgb(s.backgroundColor), solid = c && (c[3] === undefined || c[3] > 0.5);
      if (s.backgroundImage !== 'none') return [s.backgroundImage.includes('url(') || !solid ? null : c, e];
      if (solid) return [c, e];
    }
    return [[255, 255, 255], document.documentElement];
  };
  // 文字压在图片、视频上时（图片在背景元素里面，画在背景色上面），背景也算不出来
  const media = [...document.querySelectorAll('img, video, canvas, iframe')].map(el => ({ el, r: el.getBoundingClientRect() })).filter(m => m.r.width > 20 && m.r.height > 20);
  const onMedia = (box, holder) => { const x = box.left + box.width / 2, y = box.top + box.height / 2; return media.some(m => holder.contains(m.el) && x >= m.r.left && x <= m.r.right && y >= m.r.top && y <= m.r.bottom); };
  const fails = [], small = [];
  for (const el of document.querySelectorAll('header *, main *, footer *')) {
    if (el.children.length || !el.textContent.trim()) continue;
    const box = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (box.width < 2 || box.height < 2 || s.visibility === 'hidden') continue; // 隐藏的、只给读屏软件用的
    const size = parseFloat(s.fontSize), text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 14);
    if (size < 12) small.push(`${size}px「${text}」`);
    const fg = rgb(s.color), [bg, holder] = bgOf(el);
    if (!fg || !bg || onMedia(box, holder)) continue;
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < (large ? 3 : 4.5)) fails.push(`${ratio.toFixed(2)} ${size}px「${text}」`);
  }
  const chinese = [];
  if (checkChinese) {
    const re = /[\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]/, skip = el => !el || el.closest('script,style,noscript,[lang^="zh"]');
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) if (!skip(n.parentElement) && re.test(n.textContent)) chinese.push(n.textContent.trim().replace(/\s+/g, ' ').slice(0, 20));
    for (const el of document.querySelectorAll('[alt],[title],[placeholder],[aria-label],meta[content]')) {
      if (skip(el)) continue;
      for (const a of ['alt', 'title', 'placeholder', 'aria-label', 'content']) { const v = el.getAttribute(a); if (v && re.test(v)) chinese.push(`${a}="${v.slice(0, 20)}"`); }
    }
    if (re.test(document.title)) chinese.push('网页标题：' + document.title);
  }
  return { fails, small, chinese: [...new Set(chinese)] };
}

(async () => {
  const pagesByLang = {};
  for (const l of new Set(['zh', ...langs])) pagesByLang[l] = await crawl(l);
  const label = labeler(pagesByLang);
  const all = [...new Set(langs.flatMap(l => [...pagesByLang[l].keys()].map(p => p.slice(l.length + 2))))].sort();
  const num = rest => String(all.indexOf(rest) + 1).padStart(2, '0');
  if (shotDir) for (const d of ['电脑版', '手机版']) fs.mkdirSync(path.join(shotDir, d), { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const desk = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const phone = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // 打开一个页面，记下失败的请求、坏图和脚本报错
  async function open(ctx, url, size, scroll) {
    const page = await ctx.newPage(), bad = [], errors = [];
    if (size) await page.setViewportSize(size);
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(base, '')}`); });
    page.on('requestfailed', r => { const t = r.failure()?.errorText || ''; if (!t.includes('ERR_ABORTED')) bad.push(`${t} ${r.url().replace(base, '')}`); });
    page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text().slice(0, 120)); });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(settle, scroll);
    const broken = await page.evaluate(() => [...document.images].filter(i => i.complete && !i.naturalWidth && i.getAttribute('src')).map(i => i.getAttribute('src')));
    return { page, bad: [...bad, ...broken.filter(s => !bad.some(b => b.endsWith(s))).map(s => '坏图 ' + s)], errors };
  }
  const shot = (page, dir, name) => page.screenshot({ path: path.join(shotDir, dir, name + '.jpg'), fullPage: true, type: 'jpeg', quality: 80, animations: 'disabled' });

  const rows = [];
  for (const lang of langs) for (const [p, info] of pagesByLang[lang]) {
    if (only && !new RegExp(only).test(p)) continue;
    const rest = p.slice(lang.length + 2);
    const row = { lang, p, name: `${lang}-${num(rest)}-${label(rest)}`, rule: screenRule(p), status: info.status, desk: [], bad: [], errors: [] };
    rows.push(row);
    try {
      if (info.status >= 400) throw Error(`打不开（${info.status}）`);
      for (const [w, h] of DESKTOP) {
        const first = w === DESKTOP[0][0], o = await open(desk, base + p, { width: w, height: h }, first && !!shotDir);
        const m = await o.page.evaluate(measure);
        row.desk.push({ w, h, ...m, over: m.sections.filter(s => s.h > s.limit) });
        if (first) {
          Object.assign(row, { bad: o.bad, errors: o.errors, text: await o.page.evaluate(textCheck, lang !== 'zh') });
          if (shotDir) await shot(o.page, '电脑版', row.name);
        }
        await o.page.close();
      }
      const o = await open(phone, base + p, null, !!shotDir);
      row.phone = await o.page.evaluate(overflowX);
      row.bad = [...new Set([...row.bad, ...o.bad])];
      row.errors = [...new Set([...row.errors, ...o.errors])];
      if (shotDir) await shot(o.page, '手机版', row.name);
      await o.page.close();
    } catch (e) { row.crash = e.message.split('\n')[0]; }
    console.log(line(row));
  }
  await browser.close();
  if (reportFile) { fs.writeFileSync(reportFile, report(rows)); console.log('\n报告：' + reportFile); }
  const problems = rows.filter(r => r.crash || (r.rule === 'must' && overCount(r)) || r.phone?.over || r.bad.length || r.text?.fails.length || r.text?.small.length || r.text?.chinese.length || r.errors.length);
  console.log(`共 ${rows.length} 页，有问题的 ${problems.length} 页`);
})().catch(e => { console.error(e.message); process.exit(1); });

function line(r) {
  if (r.crash) return `${r.name}  检查出错：${r.crash}`;
  const over = r.desk.filter(d => d.over.length).map(d => `${d.w} 宽超一屏 ${d.over.length} 块`).join('、');
  const screen = r.rule === 'none' ? '长文页，不要求一屏' : !over ? '区块都在一屏内' : r.rule === 'soft' ? `尽量一屏：${over}（只提示，不算问题）` : over;
  const parts = [screen, r.phone.over && `手机横向溢出 ${r.phone.over}px`, r.bad.length && `坏图/失败请求 ${r.bad.length}`,
    r.text.fails.length && `对比度不达标 ${r.text.fails.length}`, r.text.small.length && `小于 12px ${r.text.small.length}`,
    r.text.chinese.length && `出现中文 ${r.text.chinese.length}`, r.errors.length && `脚本报错 ${r.errors.length}`].filter(Boolean);
  return `${r.name}  ${parts.join('，')}`;
}

function report(rows) {
  const esc = s => String(s).replace(/\|/g, '\\|');
  const md = ['# 网站检查结果', '', `- 网址：${base}`, `- 时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`, `- 页面：${rows.length} 个（${langs.join(' / ')}）`,
    '- 一屏：电脑宽度下 `<main>` 里每个区块的高度 ≤ 视口高 − 页头高。课程页、专家页必须做到；隐私、条款不要求；其他页面尽量做到，超出只提示、不算问题（2026-10-28 定）',
    '- 手机：390 宽不能左右滑动',
    '- 对比度：正文 ≥ 4.5:1，大字（≥ 24px，或 ≥ 18.66px 加粗）≥ 3:1；文字压在图片、视频或渐变上时算不出来，没查，要看截图', '',
    '## 汇总', '', '| 页面 | 网址 | 超一屏的区块数 1366 / 1440 / 1920 | 手机横向溢出 | 坏图/失败请求 | 对比度不达标 | 小于 12px 的字 | 英、越页面里的中文 | 脚本报错 |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    if (r.crash) { md.push(`| ${esc(r.name)} | ${r.p} | 检查出错：${esc(r.crash)} | | | | | | |`); continue; }
    md.push(`| ${esc(r.name)} | ${r.p} | ${r.rule === 'none' ? '不要求' : r.desk.map(d => d.over.length || '–').join(' / ') + (r.rule === 'soft' && overCount(r) ? '（尽量，不算问题）' : '')} | ${r.phone.over ? r.phone.over + 'px' : '–'} | ${r.bad.length || '–'} | ${r.text.fails.length || '–'} | ${r.text.small.length || '–'} | ${r.lang === 'zh' ? '不查' : r.text.chinese.length || '–'} | ${r.errors.length || '–'} |`);
  }
  md.push('', '## 明细', '');
  for (const r of rows) {
    if (r.crash) continue;
    md.push(`### ${r.name}　${r.p}`, '');
    for (const d of r.desk) md.push(`- ${d.w}×${d.h}（页头 ${d.headerH}px，可用 ${d.avail}px，整页 ${d.pageH}px）：` + (d.sections.length ? d.sections.map(s => `${s.name} ${s.h}${s.limit !== d.avail ? `（从页面顶上开始，可用 ${s.limit}）` : ''}${s.h > s.limit && r.rule !== 'none' ? (r.rule === 'must' ? ' **超**' : ' 超（尽量）') : ''}`).join('，') : '没找到区块'));
    md.push(`- 手机 390：整页 ${r.phone.pageH}px` + (r.phone.over ? `，**横向溢出 ${r.phone.over}px**：${r.phone.culprits.join('；')}` : '，没有横向溢出') + (r.phone.pageH > MAX_SHOT ? '（页面太长，整页截图可能不完整）' : ''));
    if (r.bad.length) md.push(`- 坏图/失败请求：${r.bad.join('；')}`);
    if (r.text.fails.length) md.push(`- 对比度不达标 ${r.text.fails.length} 处：${r.text.fails.slice(0, 6).join('；')}`);
    if (r.text.small.length) md.push(`- 小于 12px 的字 ${r.text.small.length} 处：${r.text.small.slice(0, 6).join('；')}`);
    if (r.text.chinese.length) md.push(`- 出现中文 ${r.text.chinese.length} 处：${r.text.chinese.slice(0, 6).join('；')}`);
    if (r.errors.length) md.push(`- 脚本报错：${r.errors.join('；')}`);
    md.push('');
  }
  return md.join('\n');
}
