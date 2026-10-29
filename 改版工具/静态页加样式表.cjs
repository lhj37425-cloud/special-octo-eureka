// 给 public/{zh,vi,en} 下的全部静态页加一个样式表链接，放在 </head> 前（也就是所有样式表的最后）。已经有的跳过，可以重复运行。
// 用法：node 静态页加样式表.cjs /v2.css
const fs = require('fs'), path = require('path');
const href = process.argv[2];
if (!href) throw Error('用法：node 静态页加样式表.cjs /v2.css');
// Git Bash 会把 /v2.css 自动改写成 C:/Program Files/Git/v2.css，要加 MSYS_NO_PATHCONV=1 再运行
if (!/^\/[\w./-]+\.css$/.test(href)) throw Error('样式表地址要以 / 开头，比如 /v2.css；在 Git Bash 里请加 MSYS_NO_PATHCONV=1。收到的是：' + href);
const root = path.resolve(__dirname, '..', 'public');
const files = ['zh', 'vi', 'en'].flatMap(l => [path.join(root, l, 'index.html'), ...fs.readdirSync(path.join(root, l), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(root, l, d.name, 'index.html'))]).filter(f => fs.existsSync(f));
let added = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  if (html.includes(`href="${href}"`)) continue;
  if (html.split('</head>').length !== 2) throw Error('找不到唯一的 </head>：' + f);
  fs.writeFileSync(f, html.replace('</head>', `<link rel="stylesheet" href="${href}"></head>`));
  added++;
}
console.log(`共 ${files.length} 个静态页，新加 ${added} 个`);
