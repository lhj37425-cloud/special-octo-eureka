const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-admin-test-'));process.env.ADMIN_DATA_DIR=temp;
const core=require('../后台服务.cjs');
assert.equal(core.login('admin','wrong'),null);assert.equal(core.initialize('admin','1234567890'),'admin');const token=core.login('admin','1234567890');assert.ok(token);assert.equal(core.auth(token).role,'owner');
let r=core.saveRecord({type:'courses',draft:{zh:{name:'测试课程',description:'用于隔离验证',image:null,attachments:[],clips:[]}}});assert.throws(()=>core.publish(r.id),/封面/);const stale=JSON.parse(JSON.stringify(r));r=core.saveRecord({...r,draft:{...r.draft,zh:{...r.draft.zh,image:{id:'cover.png'}}}});assert.throws(()=>core.saveRecord(stale),/刚被.*修改，请刷新/);core.publish(r.id);assert.equal(core.list(true).length,1);assert.equal(core.publicFile('cover.png'),path.join(temp,'uploads','cover.png'));core.offline(r.id);assert.equal(core.list(true).length,0);core.remove(r.id);assert.equal(core.list().length,0);console.log('真实后台核心验证通过');
const backup=core.backup();assert.ok(fs.existsSync(path.join(backup,'state.json')));assert.ok(fs.existsSync(path.join(backup,'uploads')));console.log('备份验证通过');
const saved=core.file('恢复图片.png',Buffer.from([137,80,78,71,13,10,26,10]),'image/png');let restored=core.saveRecord({type:'courses',draft:{zh:{name:'恢复课程',description:'用于恢复验证',image:saved,attachments:[],clips:[]}}});core.publish(restored.id);const restorePoint=core.backup();core.offline(restored.id);core.remove(restored.id);core.restore(restorePoint);assert.equal(core.list(true).length,1);assert.equal(core.publicFile(saved.id),path.join(temp,'uploads',saved.id));console.log('备份恢复验证通过');
core.reset('admin','0987654321');assert.equal(core.auth(token),null);assert.ok(core.login('admin','0987654321'));console.log('管理员重置会话失效验证通过');
// 登录时清理过期会话：30 分钟无操作、登录满 8 小时或缺少时间的会话被删除，有效会话保留
const stateFile=path.join(temp,'state.json'),state=JSON.parse(fs.readFileSync(stateFile,'utf8')),userId=state.users[0].id,now=Date.now();
state.sessions={idle:{userId,createdAt:now-60*60*1000,lastAt:now-31*60*1000},old:{userId,createdAt:now-9*60*60*1000,lastAt:now},broken:{userId},alive:{userId,createdAt:now-60*1000,lastAt:now-60*1000}};fs.writeFileSync(stateFile,JSON.stringify(state));
const fresh=core.login('admin','0987654321'),left=Object.keys(core.read().sessions).sort();assert.deepEqual(left,['alive',fresh].sort());assert.ok(core.auth('alive'));console.log('登录时清理过期会话验证通过');
// 登录后 1 分钟内的接口请求不再重写 state.json
const sessionToken=core.login('admin','0987654321'),before=fs.readFileSync(stateFile,'utf8');for(let i=0;i<5;i++)assert.ok(core.auth(sessionToken));assert.equal(fs.readFileSync(stateFile,'utf8'),before,'1 分钟内的请求不应重写 state.json');console.log('会话不再每次请求写盘验证通过');
// 账号不存在时同样做一次密码计算，响应快慢不能用来判断账号是否存在
const timed=account=>{const start=process.hrtime.bigint();core.login(account,'wrong-password');return Number(process.hrtime.bigint()-start)};timed('admin');timed('nobody');
const real=Math.min(...[1,2,3].map(()=>timed('admin'))),missing=Math.min(...[1,2,3].map(()=>timed('nobody')));assert.ok(missing>real*0.5,`不存在的账号耗时 ${missing} 明显短于存在的账号 ${real}`);console.log('登录耗时不泄露账号是否存在验证通过');
// 删除内容时清理它独有的上传文件，其他内容仍在用的保留
const shared=core.file('共用.png',Buffer.from([137,80,78,71,13,10,26,10]),'image/png'),own=core.file('独有.png',Buffer.from([137,80,78,71,13,10,26,10]),'image/png'),video=core.file('独有.mp4',Buffer.from([0,0,0,24,102,116,121,112]),'video/mp4');
const keep=core.saveRecord({type:'courses',draft:{zh:{name:'保留课程',description:'说明',image:shared,attachments:[],clips:[]}}});
const drop=core.saveRecord({type:'courses',draft:{zh:{name:'删除课程',description:'说明',image:own,attachments:[shared],clips:[{title:'片段',video,cover:own}]}}});
core.remove(drop.id);assert.ok(!fs.existsSync(core.filePath(own.id)));assert.ok(!fs.existsSync(core.filePath(video.id)));assert.ok(fs.existsSync(core.filePath(shared.id)));core.remove(keep.id);assert.ok(!fs.existsSync(core.filePath(shared.id)));console.log('删除内容时清理独有上传文件验证通过');
