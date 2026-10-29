// 量首页每个板块的高度（默认量改版预览站 4273，也可以传网址：node live-home.cjs http://127.0.0.1:4173）在 1366×768 下每个板块的高度
const { chromium } = require('D:/项目/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto((process.argv[2] || 'http://127.0.0.1:4273') + '/zh/');
  await p.waitForLoadState('load');
  const r = await p.evaluate(() => {
    const header = document.querySelector('header');
    const names = { hero: '首屏', 'company-introduction-section': '公司介绍', 'services-section': '产品服务体系', 'business-scenarios': '业务场景', 'home-qualifications': '公司资质', 'home-cooperation': '合作模式+合作之前', 'contact-section': '联系表单' };
    const rows = [...document.querySelectorAll('main section')].filter(s => !s.parentElement.closest('main section')).map(s => {
      const key = Object.keys(names).find(k => s.classList.contains(k));
      return `${key ? names[key] : s.className} ${s.offsetHeight}`;
    });
    return { header: header ? header.offsetHeight : 0, rows };
  });
  console.log(`页头 ${r.header}px，可用 ${768 - r.header}px`);
  console.log(r.rows.join('\n'));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
