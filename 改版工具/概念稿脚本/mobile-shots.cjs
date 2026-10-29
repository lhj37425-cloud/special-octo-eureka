// 手机宽度（390）下把首页整页分三段截图，检查新增板块的手机排版
const { chromium } = require('D:/项目/node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(path.join('D:/data网站数据保存/改版概念稿v2-2026-10-27/网页', 'index.html')).href);
  await p.waitForLoadState('load');
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  const part = Math.ceil(total / 3);
  for (let i = 0; i < 3; i++) {
    await p.screenshot({ path: path.join(__dirname, '输出', `m-index-${i + 1}.png`), fullPage: true, clip: { x: 0, y: i * part, width: 390, height: Math.min(part, total - i * part) } });
  }
  await p.screenshot({ path: path.join(__dirname, '输出', 'm-index-full.png'), fullPage: true });
  console.log('整页高度', total);
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
