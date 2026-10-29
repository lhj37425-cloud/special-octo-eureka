// 全站页头照豆包 demo（2026-10-28）：把 public/{zh,vi,en} 下全部静态页的语言下拉换成平铺的“中文 | VI | EN”，
// 并在 </head> 前加上页头脚本 /v2.js（页面在最上面时页头透明，往下滚变浅色毛玻璃）。已经换过的页面跳过，可以重复运行。
// 课程、专家页用三语首页作外框，案例页、404 用“关于我们”作外框，跟着这些静态页一起变。
// 语言链接保留原来的 href="..." lang="..." 写法：views.cjs、cases.cjs、server.js 靠它把链接改到同一页面的其他语言。
// 用法：node 页头语言平铺.cjs
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', 'public');
const short = { 'zh-CN': '中文', vi: 'VI', en: 'EN' }, full = { vi: 'Tiếng Việt', en: 'English' };
const pages = ['zh', 'vi', 'en'].flatMap(l => {
  const out = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' && out.push(path.join(d, e.name)));
  walk(path.join(root, l));
  return out;
});
let changed = 0;
for (const file of pages) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  const block = html.match(/<details class="language-switcher">[\s\S]*?<\/details>/);
  if (block) {
    const label = (block[0].match(/<nav class="language-options" aria-label="([^"]*)"/) || [])[1];
    const links = [...block[0].matchAll(/<a (href="[^"]*" lang="([^"]*)"[^>]*)>[\s\S]*?<\/a>/g)];
    if (!label || links.length !== 3) throw Error('语言切换的写法和预期不一样：' + file);
    // 中文按钮本身是中文字；VI、EN 是缩写，读屏软件读完整的语言名
    const pills = links.map(([, attrs, lang]) => `<a ${attrs}${full[lang] ? ` aria-label="${full[lang]}"` : ''}>${short[lang]}</a>`).join('');
    html = html.replace(block[0], `<nav class="language-pills" aria-label="${label}">${pills}</nav>`);
  }
  if (!html.includes('<script src="/v2.js"')) html = html.replace('</head>', '<script src="/v2.js" defer></script></head>');
  if (html !== before) { fs.writeFileSync(file, html); changed++; }
}
console.log(`共 ${pages.length} 个静态页，改了 ${changed} 个`);
