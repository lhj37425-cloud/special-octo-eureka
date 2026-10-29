// 换成甲方给的 logo（2026-10-28，原图存在 D:\data网站数据保存\甲方logo-2026-10-28\）：
// 把 public/{zh,vi,en} 下全部静态页页头、页脚里的旧图标（红方块里一个白色 E 的 SVG）换成 /brand/evol-mark.png，
// 并在网页图标链接后面补上 PNG 图标和苹果手机主屏幕图标。已经换过的页面跳过，可以重复运行。
// 课程、专家、案例页和 404 用静态页作外框，跟着一起变；网页图标 /favicon.svg 本身另外换（后台也读这个文件）。
// 用法：node 换品牌标志.cjs
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', 'public');
const oldMark = /<svg viewBox="0 0 40 40"[^>]*>(?:(?!<\/svg>)[\s\S])*?M2 3h35v8H11v5h20v8H11v5h26v8H2z[\s\S]*?<\/svg>/g;
// 图片 164×132，页面上按高度缩放（v2.css 的 .brand-mark）；链接本身有“EVOL DREAM 首页”的读屏文字，图片不再重复
const newMark = '<img class="brand-mark" src="/brand/evol-mark.png" alt="" width="164" height="132">';
const icons = '<link rel="icon" type="image/png" sizes="64x64" href="/brand/icon-64.png"><link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">';
const pages = ['zh', 'vi', 'en'].flatMap(l => {
  const out = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' && out.push(path.join(d, e.name)));
  walk(path.join(root, l));
  return out;
});
let changed = 0;
for (const file of pages) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html, marks = (html.match(oldMark) || []).length;
  if (marks && marks !== 2) throw Error(`旧图标应该有 2 个（页头、页脚），这页有 ${marks} 个：${file}`);
  html = html.replace(oldMark, newMark);
  if (!html.includes('/brand/icon-64.png')) html = html.replace('<link rel="icon" type="image/svg+xml" href="/favicon.svg">', '<link rel="icon" type="image/svg+xml" href="/favicon.svg">' + icons);
  if (html !== before) { fs.writeFileSync(file, html); changed++; }
}
console.log(`共 ${pages.length} 个静态页，改了 ${changed} 个`);
