// 把首页每个区块单独截图，方便放大检查细节
const { chromium } = require('D:/项目/node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(pathToFileURL(path.join('D:/data网站数据保存/改版概念稿v2-2026-10-27/网页', 'index.html')).href);
  await p.waitForLoadState('load');
  const secs = await p.$$('main > section');
  for (const [i, s] of secs.entries()) await s.screenshot({ path: path.join(__dirname, '输出', `sec-${i + 1}.png`) });
  // 资质展开后的样子
  await p.click('.cert-more');
  await (await p.$('#credentials')).screenshot({ path: path.join(__dirname, '输出', 'sec-cred-open.png') });
  console.log('资质展开后高度', await p.$eval('#credentials', s => s.offsetHeight));
  // 资质放大弹窗
  await p.click('.cert:nth-child(3)');
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, '输出', 'sec-zoom.png') });
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
