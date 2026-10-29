// 把两套整页截图（改版前、改版后）并排放进一个网页，双击就能逐页对照
// 用法：node 生成对比页.cjs 改版前截图目录 改版后截图目录 [输出文件，默认放在改版后目录/对比.html]
const fs = require('fs'), path = require('path');
const [beforeDir, afterDir, outArg] = process.argv.slice(2).map(p => p && path.resolve(p));
if (!beforeDir || !afterDir) throw Error('用法：node 生成对比页.cjs 改版前截图目录 改版后截图目录 [输出文件]');
const out = outArg || path.join(afterDir, '对比.html');
const rel = p => path.relative(path.dirname(out), p).split(path.sep).map(encodeURIComponent).join('/');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const names = [...new Set(['电脑版', '手机版'].flatMap(d => fs.existsSync(path.join(afterDir, d)) ? fs.readdirSync(path.join(afterDir, d)) : []))].filter(n => n.endsWith('.jpg')).sort();
const cell = (dir, d, n) => fs.existsSync(path.join(dir, d, n)) ? `<a href="${rel(path.join(dir, d, n))}" target="_blank"><img loading="lazy" src="${rel(path.join(dir, d, n))}"></a>` : '<p class="none">没有这张</p>';
const rows = names.map(n => `<section id="${esc(n)}"><h2>${esc(n.replace(/\.jpg$/, ''))}</h2>` +
  ['电脑版', '手机版'].map(d => `<div class="pair ${d === '手机版' ? 'phone' : ''}"><div><b>改版前 · ${d}</b>${cell(beforeDir, d, n)}</div><div><b>改版后 · ${d}</b>${cell(afterDir, d, n)}</div></div>`).join('') + '</section>').join('\n');
fs.writeFileSync(out, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>改版前后对比</title><style>
body{margin:0;font:14px/1.6 "Microsoft YaHei",sans-serif;background:#f6f1ec;color:#2a2320}
header{position:sticky;top:0;z-index:2;background:#1a0d0e;color:#fff;padding:12px 20px}
header select{margin-left:12px;font:inherit;max-width:60vw}
section{padding:20px;border-bottom:1px solid #e8e0d8}
h2{margin:0 0 12px;font-size:18px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;align-items:start}
.pair.phone{grid-template-columns:repeat(2,minmax(0,390px))}
.pair b{display:block;margin-bottom:6px;color:#94070a}
img{display:block;width:100%;border:1px solid #e8e0d8;background:#fff}
.none{color:#5f5650}
</style></head><body><header>改版前后对比（点图片看原图）<select onchange="location.hash=this.value">${names.map(n => `<option value="${esc(n)}">${esc(n.replace(/\.jpg$/, ''))}</option>`).join('')}</select></header>
${rows}</body></html>`);
console.log('对比页：' + out + '（' + names.length + ' 页）');
