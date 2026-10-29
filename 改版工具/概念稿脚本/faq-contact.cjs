// 把概念稿首页的“常见问题 + 联系区”连在一起截图（1440 宽），看表单卡片压线的效果
const { chromium } = require('D:/项目/node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(pathToFileURL(path.join('D:/data网站数据保存/改版概念稿v2-2026-10-27/网页', 'index.html')).href);
  await p.waitForLoadState('load');
  const r = await p.evaluate(() => {
    const faq = document.querySelector('#faq'), band = document.querySelector('#contact');
    const top = faq.getBoundingClientRect().top + scrollY, bottom = band.getBoundingClientRect().bottom + scrollY;
    const card = band.querySelector('.form').getBoundingClientRect(), qa = faq.querySelector('.qa').getBoundingClientRect();
    return { top, height: bottom - top, gapAboveCard: card.top - qa.bottom };
  });
  console.log('FAQ 最后一条到表单卡片顶部的距离', Math.round(r.gapAboveCard), 'px');
  await p.screenshot({ path: path.join(__dirname, '输出', 'faq-contact.png'), fullPage: true, clip: { x: 0, y: r.top, width: 1440, height: r.height } });
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
