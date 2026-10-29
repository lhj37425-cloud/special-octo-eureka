// 核对概念稿：每个区块是否不超过一屏、手机是否横向溢出、图片是否加载、文字对比度；同时截图
const { chromium } = require('D:/项目/node_modules/playwright');
const path = require('path');
const dir = 'D:/data网站数据保存/改版概念稿v2-2026-10-27/网页';
const pages = ['index', 'courses', 'course-detail', 'teachers', 'teacher-detail', 'design-system'];
const shots = process.argv.includes('--shots');

const contrast = () => {
  const rgb = s => { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); const c = rgb(s.backgroundColor); if (c && (c[3] === undefined || c[3] > 0.5)) return c; if (s.backgroundImage !== 'none' && !s.backgroundImage.includes('linear-gradient(rgba(255, 255, 255, 0.03)')) return null; } return [255, 255, 255]; };
  const fails = []; let small = 0;
  for (const el of document.querySelectorAll('main *, footer *')) {
    if (!el.offsetParent || el.children.length || !el.textContent.trim()) continue;
    const s = getComputedStyle(el), fg = rgb(s.color), bg = bgOf(el); if (parseFloat(s.fontSize) < 12) small++; if (!fg || !bg) continue;
    const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const L1 = lum(fg), L2 = lum(bg), r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (r < (large ? 3 : 4.5)) fails.push(`${r.toFixed(2)} ${size}px「${el.textContent.trim().slice(0, 14)}」`);
  }
  return { fails, small };
};

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [w, h] of [[1366, 768], [1440, 900], [1920, 1080], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
    const rows = [];
    for (const name of pages) {
      await p.goto('file:///' + path.join(dir, name + '.html').replace(/\\/g, '/'));
      await p.waitForLoadState('load');
      const r = await p.evaluate(() => {
        const avail = innerHeight - document.querySelector('.hd').offsetHeight;
        const secs = [...document.querySelectorAll('main > section')].map(s => s.offsetHeight);
        return { avail, secs, over: secs.filter(x => x > avail), overflowX: document.documentElement.scrollWidth - innerWidth, broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')) };
      });
      if (w === 1440) { const c = await p.evaluate(contrast); r.contrast = c; }
      rows.push(`${name.padEnd(15)} 区块高 ${r.secs.join('/')}（可用 ${r.avail}）` + (w < 500 ? `，横向溢出 ${r.overflowX}px` : (r.over.length ? `，超出一屏：${r.over.join(', ')}` : '，全部 ≤ 一屏')) + (r.broken.length ? `，坏图 ${r.broken}` : '') + (r.contrast ? `，对比度不达标 ${r.contrast.fails.length} 处${r.contrast.fails.length ? '：' + r.contrast.fails.slice(0, 3).join('；') : ''}，小于 12px 的文字 ${r.contrast.small} 处` : ''));
      if (shots && (w === 1440 || w === 390)) await p.screenshot({ path: path.join(__dirname, '输出', `shot-${name}-${w}.png`), fullPage: w === 1440 });
    }
    console.log(`\n######## ${w}×${h}\n` + rows.join('\n'));
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
