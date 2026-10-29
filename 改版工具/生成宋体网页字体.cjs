// 生成宋体网页字体 public/fonts/evol-serif-700.woff2：只放网站上用宋体显示的字，网页不用下载整套字体
// 1. 打开预览站三种语言的全部页面（从首页顺着链接找，和 检查网站.cjs 一样），收集标题（h1–h3）和其他用宋体显示的文字
// 2. 加上常用的英文、越南语字母和标点，写进 输出/宋体字表.txt
// 3. 调用 裁剪宋体.py 从本机的思源宋体裁出这些字
// 课程名、专家名、标题文案改了以后要重新运行，否则新出现的字会用电脑自带的宋体显示。
// 用法：node 生成宋体网页字体.cjs [--base http://127.0.0.1:4273]
const { chromium } = require('D:/项目/node_modules/playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://127.0.0.1:4273').replace(/\/+$/, '');
const charsFile = path.join(__dirname, '输出', '宋体字表.txt');
const fontFile = path.resolve(__dirname, '..', 'public', 'fonts', 'evol-serif-700.woff2');

async function crawl(lang) {
  const root = `/${lang}/`, origin = new URL(base).origin, pages = new Set(), queue = [root, `/${lang}/thank-you/`];
  while (queue.length) {
    const p = queue.shift();
    if (pages.has(p)) continue;
    pages.add(p);
    const html = await (await fetch(base + p)).text();
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      let u; try { u = new URL(href.replace(/&amp;/g, '&'), base + p); } catch { continue; }
      if (u.origin !== origin || !u.pathname.startsWith(root) || /\.\w+$/.test(u.pathname)) continue;
      const q = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      if (!pages.has(q) && !queue.includes(q)) queue.push(q);
    }
  }
  return [...pages];
}

// 常用的英文、越南语字母、数字和标点，标题以后改了也不会缺
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join('');
const basics = range(0x20, 0x7e) + range(0xa0, 0xff) + range(0x100, 0x17f) + '\u01a0\u01a1\u01af\u01b0' + range(0x300, 0x303) + '\u0309\u0323' +
  range(0x1ea0, 0x1ef9) + range(0x2010, 0x2027) + range(0x2030, 0x203a) + '€™←↑→↓×' + range(0x3000, 0x303f) + range(0xff01, 0xff5e);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const chars = new Set(basics);
  let count = 0;
  for (const lang of ['zh', 'vi', 'en']) for (const p of await crawl(lang)) {
    await page.goto(base + p, { waitUntil: 'load' });
    const text = await page.evaluate(() => {
      const serif = el => /EVOL Serif|Noto Serif SC/.test(getComputedStyle(el).fontFamily);
      return [...document.querySelectorAll('h1,h2,h3'), ...[...document.body.querySelectorAll('*')].filter(serif)].map(el => el.textContent).join('');
    });
    for (const ch of text) if (ch.trim()) chars.add(ch);
    count++;
  }
  await browser.close();
  const list = [...chars].sort().join('');
  fs.mkdirSync(path.dirname(charsFile), { recursive: true });
  fs.writeFileSync(charsFile, list);
  const cjk = [...list].filter(ch => /[\u3400-\u9fff]/.test(ch)).length;
  console.log(`看了 ${count} 页，字表 ${[...list].length} 个字符，其中汉字 ${cjk} 个 → ${charsFile}`);
  console.log(execFileSync('python', [path.join(__dirname, '裁剪宋体.py'), charsFile, fontFile], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).trim());
  console.log('字体：' + fontFile);
})().catch(e => { console.error(e.message); process.exit(1); });
