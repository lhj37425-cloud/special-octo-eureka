// 生成宋体网页字体（决定 D12）：GB2312 一级常用字 3755 + 网站现有字 + 英越字母，
// 按 unicode-range 分成多个 woff2，浏览器只下载页面用到的分片。
// 用法：node 生成宋体网页字体-分片.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const siteCharsFile = path.join(__dirname, '输出', '宋体字表.txt');
const fontDir = path.join(root, 'public', 'fonts');
const cssFile = path.join(root, 'public', 'v2.css');
const listFile = path.join(fontDir, '宋体字表.txt');
const py = path.join(__dirname, '裁剪宋体.py');

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join('');
// 英文字母、数字、标点，越南语字母与声调组合符号
const basics = range(0x20, 0x7e) + range(0xa0, 0xff) + range(0x100, 0x17f) + 'ƠơƯư' + range(0x300, 0x303) + '̣̉' +
  range(0x1ea0, 0x1ef9) + range(0x2010, 0x2027) + range(0x2030, 0x203a) + '€™←↑→↓×' + range(0x3000, 0x303f) + range(0xff01, 0xff5e);

// GB2312 一级字库：3755 个最常用汉字（按拼音序）
const gbCommon = [], gbDecoder = new TextDecoder('gb18030');
for (let hi = 0xb0; hi <= 0xd7; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) {
  let ch; try { ch = gbDecoder.decode(Uint8Array.of(hi, lo)); } catch { continue; }
  if (ch && /[㐀-鿿]/.test(ch)) gbCommon.push(ch);
}
const siteChars = fs.existsSync(siteCharsFile) ? [...fs.readFileSync(siteCharsFile, 'utf8')].filter(ch => ch.trim()) : [];
const all = new Set([...basics, ...gbCommon, ...siteChars]);
const cjk = [...all].filter(ch => /[㐀-鿿]/.test(ch)).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
const siteSet = new Set(siteChars);

// 第一片放网站现有字 + 英越字母：现有页面只下载这一片；
// 其余常用字按码点每 700 字一片，以后新加的人名/课程名才按需加载
const chunks = [[...new Set([...basics, ...siteChars])].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))];
const rest = cjk.filter(ch => !siteSet.has(ch));
for (let i = 0; i < rest.length; i += 700) chunks.push(rest.slice(i, i + 700));

function unicodeRange(chars) {
  const codes = [...new Set(chars.map(ch => ch.codePointAt(0)))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < codes.length;) {
    let j = i; while (j + 1 < codes.length && codes[j + 1] === codes[j] + 1) j++;
    parts.push(i === j ? `U+${codes[i].toString(16).toUpperCase()}` : `U+${codes[i].toString(16).toUpperCase()}-${codes[j].toString(16).toUpperCase()}`);
    i = j + 1;
  }
  return parts.join(',');
}

fs.mkdirSync(fontDir, { recursive: true });
const faces = [], sizes = [];
chunks.forEach((chars, index) => {
  const temp = path.join(fontDir, `.chunk-${index + 1}.txt`);
  const out = path.join(fontDir, `evol-serif-700-${index + 1}.woff2`);
  fs.writeFileSync(temp, chars.join(''), 'utf8');
  execFileSync('python', [py, temp, out], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  fs.rmSync(temp, { force: true });
  sizes.push(fs.statSync(out).size);
  faces.push(`@font-face{font-family:"EVOL Serif";src:url(/fonts/evol-serif-700-${index + 1}.woff2) format("woff2");font-weight:700;font-style:normal;font-display:swap;unicode-range:${unicodeRange(chars)}}`);
});
fs.writeFileSync(listFile, [...all].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join(''), 'utf8');

// 替换 v2.css 里原来的单个 @font-face
const css = fs.readFileSync(cssFile, 'utf8');
const lines = css.split(/\r?\n/).filter(line => !/^@font-face\{font-family:"EVOL Serif"/.test(line));
lines.push(...faces);
fs.writeFileSync(cssFile, lines.join('\n'), 'utf8');

const total = sizes.reduce((a, b) => a + b, 0);
console.log(`分片 ${chunks.length} 个，总字表 ${all.size} 个字符（汉字 ${cjk.length}），字体总大小 ${(total / 1024).toFixed(0)}KB，最大一片 ${(Math.max(...sizes) / 1024).toFixed(0)}KB`);
console.log(`字表：${listFile}`);
console.log(`CSS：${cssFile}`);
