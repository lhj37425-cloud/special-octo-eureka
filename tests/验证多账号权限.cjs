const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),child=require('child_process');
const root=path.join(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-accounts-'));process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=path.join(temp,'mvp');
const core=require('../后台服务.cjs');
// 旧版只有一个管理员的数据会自动变成“主管理员”
const legacySalt='00112233445566778899aabbccddeeff',crypto=require('crypto');
fs.writeFileSync(path.join(temp,'state.json'),JSON.stringify({version:1,admin:{account:'88888888',salt:legacySalt,hash:crypto.scryptSync('legacy-pass-123',legacySalt,64).toString('hex'),changedAt:'2026-10-01T00:00:00.000Z'},sessions:{old:{createdAt:Date.now(),lastAt:Date.now()}},records:[]}));
assert.equal(core.auth('old'),null,'旧会话应失效');
const ownerToken=core.login('88888888','legacy-pass-123');const owner=core.auth(ownerToken);assert.equal(owner.role,'owner');
// 主管理员新建子账号；子账号不能管理账号
const editor=core.createUser(owner,{account:'zhangsan',name:'张三',password:'first-pass-123',perms:{publish:false,backup:false}});
assert.equal(editor.mustChange,true);assert.throws(()=>core.createUser(owner,{account:'zhangsan',name:'重复',password:'first-pass-123'}),/已经存在/);
const editorToken=core.login('zhangsan','first-pass-123'),me=core.auth(editorToken);assert.equal(me.role,'editor');
assert.throws(()=>core.listUsers(me),/只有主管理员/);
// 首次登录改密码
assert.throws(()=>core.changePassword(editorToken,'wrong-pass-000','second-pass-123'),/原密码不正确/);
assert.equal(core.changePassword(editorToken,'first-pass-123','second-pass-123').mustChange,false);
// 子账号能保存草稿，不能发布、下架、删除；记录修改人
let r=core.saveRecord({type:'courses',draft:{zh:{name:'子账号课程',description:'说明',image:{id:'c.png',size:1},attachments:[],clips:[]}}},me);
assert.equal(r.updatedBy,'张三');assert.throws(()=>core.publish(r.id,me),/没有发布权限/);assert.throws(()=>core.remove(r.id,me),/没有删除权限/);
// 主管理员发布；给子账号开放发布权限后可以下架
r=core.publish(r.id,owner);assert.equal(r.publishedBy,'主管理员');assert.throws(()=>core.offline(r.id,me),/没有下架权限/);
core.updateUser(owner,editor.id,{perms:{publish:true,backup:false}});const me2=core.auth(editorToken);assert.equal(me2.perms.publish,true);core.offline(r.id,me2);
// 两人同时编辑：后保存的人收到提示，不会覆盖
const a=core.list().find(x=>x.id===r.id),b=JSON.parse(JSON.stringify(a));core.saveRecord({...a,draft:{...a.draft,zh:{...a.draft.zh,description:'张三的修改'}}},me2);
assert.throws(()=>core.saveRecord({...b,draft:{...b.draft,zh:{...b.draft.zh,description:'主管理员的修改'}}},owner),/刚被 张三 修改/);
// 重置密码、停用后登录失效；主管理员不能被删除
core.resetUserPassword(owner,editor.id,'reset-pass-123');assert.equal(core.auth(editorToken),null);assert.equal(core.auth(core.login('zhangsan','reset-pass-123')).mustChange,true);
core.updateUser(owner,editor.id,{disabled:true});assert.equal(core.login('zhangsan','reset-pass-123'),null);
assert.throws(()=>core.removeUser(owner,owner.id),/不能删除/);core.removeUser(owner,editor.id);assert.equal(core.listUsers(owner).length,1);
// 咨询留言：主管理员可看；子账号需要勾选权限；处理状态另存，不改原始留言
const mvp=path.join(temp,'mvp');fs.mkdirSync(mvp,{recursive:true});fs.writeFileSync(path.join(mvp,'mvp-leads.json'),JSON.stringify([{id:'L1',name:'客户',company:'公司',contact:'a@b.com',service:'training',message:'你好',language:'vi',createdAt:'2026-10-25T00:00:00.000Z'}]));
assert.equal(core.listLeads(owner)[0].status,'new');const viewer=core.createUser(owner,{account:'wangwu',name:'王五',password:'wangwu-pass-123'});const vt=core.auth(core.login('wangwu','wangwu-pass-123'));
assert.throws(()=>core.listLeads(vt),/没有查看咨询留言/);core.updateUser(owner,viewer.id,{perms:{leads:true}});const vt2=core.auth(core.login('wangwu','wangwu-pass-123'));
assert.equal(core.updateLead(vt2,'L1',{status:'contacted',note:'已电话沟通'}).handledBy,'王五');assert.equal(JSON.parse(fs.readFileSync(path.join(mvp,'mvp-leads.json'),'utf8'))[0].status,undefined);
assert.throws(()=>core.removeLead(vt2,'L1'),/只有主管理员/);const bk=core.backup();assert.ok(fs.existsSync(path.join(bk,'lead-status.json')));core.removeLead(owner,'L1');assert.equal(core.listLeads(owner).length,0);core.removeUser(owner,viewer.id);
console.log('多账号：旧数据迁移、子账号权限、首次改密码、同时编辑提示、咨询留言、停用与删除：通过');
// 修改登录账号：主管理员可改自己和子账号的账号；格式和重复会被拒绝；改名后旧账号不能登录，已登录会话保留
const renamed=core.createUser(owner,{account:'zhaoliu',name:'赵六',password:'zhaoliu-pass-1'});
assert.throws(()=>core.updateUser(owner,renamed.id,{account:'88888888'}),/已经存在/);assert.throws(()=>core.updateUser(owner,renamed.id,{account:'a b'}),/3-40 位/);
assert.equal(core.updateUser(owner,renamed.id,{account:'zhaoliu2'}).account,'zhaoliu2');assert.equal(core.login('zhaoliu','zhaoliu-pass-1'),null);assert.ok(core.login('zhaoliu2','zhaoliu-pass-1'));
assert.throws(()=>core.updateUser(core.auth(core.login('zhaoliu2','zhaoliu-pass-1')),owner.id,{account:'hijack'}),/只有主管理员/);
assert.equal(core.updateUser(owner,owner.id,{account:'evol-admin'}).account,'evol-admin');assert.equal(core.auth(ownerToken).account,'evol-admin');assert.equal(core.login('88888888','legacy-pass-123'),null);assert.ok(core.login('evol-admin','legacy-pass-123'));
core.removeUser(owner,renamed.id);console.log('修改登录账号：通过');
// 接口：子账号调用发布接口被拒绝
const port=4900+Math.floor(Math.random()*90);core.createUser(owner,{account:'lisi',name:'李四',password:'lisi-pass-1234'});
const server=child.spawn(process.execPath,['后台服务器.js'],{cwd:root,env:{...process.env,ADMIN_DATA_DIR:temp,ADMIN_PORT:String(port)},stdio:'ignore'}),base=`http://127.0.0.1:${port}`;
(async()=>{try{let res;for(let i=0;i<40;i++){try{res=await fetch(base+'/api/status');break}catch{await new Promise(x=>setTimeout(x,75))}}
 res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'lisi',password:'lisi-pass-1234'})});const data=await res.json();assert.equal(data.user.role,'editor');
 const cookie=res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),h={'Content-Type':'application/json',cookie,'x-csrf-token':data.csrf};
 // 首次登录未改密码：除查看自己、改密码、退出外，其余接口一律拒绝
 res=await fetch(base+'/api/records',{headers:h});assert.equal(res.status,403);assert.match((await res.json()).error,/修改初始密码/);
 res=await fetch(base+'/api/me',{headers:h});assert.equal(res.status,200);
 res=await fetch(base+'/api/password',{method:'POST',headers:h,body:JSON.stringify({oldPassword:'lisi-pass-1234',newPassword:'lisi-pass-5678'})});assert.equal(res.status,200);
 res=await fetch(base+'/api/records',{headers:h});assert.equal(res.status,200);
 res=await fetch(base+'/api/users',{headers:h});assert.equal(res.status,403);
 res=await fetch(base+`/api/records/${r.id}/publish`,{method:'POST',headers:h});assert.equal(res.status,403);assert.match((await res.json()).error,/没有发布权限/);
 res=await fetch(base+'/api/backup',{method:'POST',headers:h});assert.equal(res.status,403);
 console.log('多账号接口权限：通过')}finally{server.kill();fs.rmSync(temp,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
