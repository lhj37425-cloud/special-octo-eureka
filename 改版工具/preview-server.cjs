// 改版预览站（只开前台）：用改版文件夹的代码，读数据副本，碰不到 D:\项目\data
// 用法：node preview-server.cjs → http://127.0.0.1:4273/zh/
const fs = require('fs'), path = require('path');
const repo = path.resolve(__dirname, '..');
const data = path.resolve(process.env.PREVIEW_DATA_DIR || 'D:\\data网站数据保存\\预览数据');
const adminData = path.join(data, 'admin-backend');
const real = path.resolve('D:\\项目\\data');
const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
if (inside(data, real) || inside(real, data)) throw Error('预览站不能用真数据目录：' + data);
if (!fs.existsSync(path.join(adminData, 'state.json'))) throw Error('找不到数据副本：' + path.join(adminData, 'state.json'));
// server.js 和它加载的 后台服务.cjs 在启动时读这三个设置，必须先设好再加载
process.env.PORT = process.env.PORT || '4273';
process.env.MVP_DATA_DIR = data;
process.env.ADMIN_DATA_DIR = adminData;
console.log('改版预览站  代码：' + repo + '  数据：' + data);
require(path.join(repo, 'server.js'));
