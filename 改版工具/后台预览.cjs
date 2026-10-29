// 后台改版预览（前台 + 后台一起开）：用本文件夹的代码，读写数据副本，碰不到 D:\项目\data
// 用法：node 后台预览.cjs → 前台 http://127.0.0.1:4373/zh/  后台 http://127.0.0.1:4381/
const fs = require('fs'), path = require('path');
const repo = path.resolve(__dirname, '..');
const data = path.resolve(process.env.PREVIEW_DATA_DIR || 'D:\\data网站数据保存\\后台改版预览数据');
const adminData = path.join(data, 'admin-backend');
const real = path.resolve('D:\\项目\\data');
const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
if (inside(data, real) || inside(real, data)) throw Error('后台改版预览不能用真数据目录：' + data);
if (!fs.existsSync(path.join(adminData, 'state.json'))) throw Error('找不到数据副本：' + path.join(adminData, 'state.json'));
// server.js、后台服务器.js 和它们加载的 后台服务.cjs 在启动时读这些设置，必须先设好再加载
process.env.PORT = process.env.PORT || '4373';
process.env.ADMIN_PORT = process.env.ADMIN_PORT || '4381';
process.env.MVP_DATA_DIR = data;
process.env.ADMIN_DATA_DIR = adminData;
console.log('后台改版预览  代码：' + repo);
console.log('数据副本：' + data + '（前台 + 后台都用这份）');
require(path.join(repo, 'server.js'));
require(path.join(repo, 'backend-server.js'));
