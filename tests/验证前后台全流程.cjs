const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// 第 8 步 / 方案 6.2：前后台打通自动测试
// 每类内容都走：草稿→发布→补越南语→补英文→改草稿→发布→撤销→下架→重发→删除；另测关联、排序、数量与规则
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-e2e-full-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs'),{render}=require('../views.cjs'),casePages=require('../cases.cjs'),home=require('./../homepage-trust-production.cjs');
const publicRoot=path.join(__dirname,'..','public');
core.initialize('e2e-admin','e2e-password-123');const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');
const img=n=>core.file(n,png,'image/png');

const frontPort=7600+Math.floor(Math.random()*150),adminPort=7800+Math.floor(Math.random()*150),frontBase='http://127.0.0.1:'+frontPort,adminBase='http://127.0.0.1:'+adminPort;
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,PORT:String(frontPort),ADMIN_PORT:String(adminPort)};
let servers=[];
function startServers(){servers=[spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'}),spawn(process.execPath,['后台服务器.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'})]}
async function waitServers(){for(let i=0;i<150;i++){try{await fetch(frontBase+'/zh/');await fetch(adminBase+'/api/status');return}catch{await new Promise(r=>setTimeout(r,100))}}throw Error('服务未启动')}
async function restart(){for(const s of servers)s.kill();servers=[];await new Promise(r=>setTimeout(r,400));startServers();await waitServers()}
const page=async p=>{const r=await fetch(frontBase+p);return{status:r.status,html:await r.text()}};
const current=id=>core.read().records.find(r=>r.id===id);
const saveDraft=(id,mutate)=>{const cur=JSON.parse(JSON.stringify(current(id)));mutate(cur.draft,cur);return core.saveRecord(cur,owner)};
const publish=id=>core.publish(id,owner);
const segment={experts:'teachers',courses:'courses',cases:'cases',qualifications:'qualifications'};
const listPath=(type,lang)=>type==='qualifications'?`/${lang}/`:`/${lang}/${segment[type]}/`;
const detailPath=(record,lang)=>record.type==='qualifications'?null:record.type==='cases'?`/${lang}/cases/${record.slug||record.id}/`:`/${lang}/${segment[record.type]}/${record.id}/`;
const previewPath=(record,lang)=>`/preview/${lang}/${segment[record.type]}/${record.id}/`;

// 登录拿会话，供预览和权限接口用
let ownerCookie='',ownerCsrf='';
async function login(account,password){const r=await fetch(adminBase+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,password})});const d=await r.json();const cookies=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');return{cookie:cookies,csrf:d.csrf,user:d.user}}
async function api(path,method='GET',body=null,session=null){const headers={'Content-Type':'application/json'};if(session){headers.cookie=session.cookie;headers['x-csrf-token']=session.csrf}const r=await fetch(adminBase+path,{method,headers,body:body?JSON.stringify(body):undefined});let data={};try{data=await r.json()}catch{}return{status:r.status,data}}

const teacher=core.saveRecord({type:'experts',draft:{shared:{image:img('基础讲师.png')},zh:{name:'基础讲师',identity:'顾问',tagline:'一句话'},vi:{name:'Giảng viên',identity:'Cố vấn',tagline:'Một câu'}}},owner);publish(teacher.id);

function makeZh(type,name){return type==='experts'?{name,identity:'顾问',tagline:'一句话'}:type==='courses'?{name,goals:'目标',description:'介绍',audience:'零基础',outline:['第一章']}:type==='cases'?{name,industry:'行业',description:'简介',problem:'问题',steps:'一\n二',people:'人',deliverables:'成果'}:{name,description:'说明'}}
function makeVi(type,name){return type==='experts'?{name,identity:'Cố vấn',tagline:'Một câu'}:type==='courses'?{name:'Khóa '+name,goals:'Mục tiêu',description:'Giới thiệu',audience:'Người mới',outline:['Chương một']}:type==='cases'?{name:'Tình huống '+name,industry:'Ngành',description:'Mô tả',problem:'Vấn đề',steps:'Bước một',people:'A',deliverables:'Kết quả'}:{name:'Chứng nhận '+name,description:'Mô tả'}}
function createRecord(type,name,outline=1){const shared={image:img(type+'-'+name+'.png')};if(type==='courses'){shared.category='cat-aigc';shared.experts=[teacher.id]}const r=core.saveRecord({type,draft:{shared,zh:makeZh(type,name),vi:{},en:{}}},owner);return r}
const textHas=(html,text)=>html.includes(text);

(async()=>{try{
 startServers();await waitServers();const session=await login('e2e-admin','e2e-password-123');ownerCookie=session.cookie;ownerCsrf=session.csrf;

 // —— 1–12：每一类内容 ——
 for(const type of ['experts','courses','cases','qualifications']){
  const firstNames={experts:'流程专家',courses:'流程课程',cases:'流程案例',qualifications:'流程资质'};
  const name=firstNames[type];
  let r=createRecord(type,name);
  const detailUrl=detailPath(r,'zh');
  assert.equal(textHas((await page(listPath(type,'zh'))).html,name),false,`${type} 草稿前台不显示（1）`);
  if(detailUrl)assert.equal((await page(detailUrl)).status,404,`${type} 草稿详情 404（1）`);
  publish(r.id);
  assert.equal(textHas((await page(listPath(type,'zh'))).html,name),true,`${type} 发布后中文显示（2）`);
  assert.equal(textHas((await page(listPath(type,'vi'))).html,name),false,`${type} 越南语未填不显示（2）`);
  if(detailUrl){const zhDetail=await page(detailUrl);assert.equal(zhDetail.status,200);if(type==='experts'||type==='courses')assert.match(zhDetail.html,new RegExp(`/vi/${segment[type]}/`),`${type} 详情语言切换指向越南语列表（C10）`)}
  // 越南语填一半
  saveDraft(r.id,d=>{d.vi={name:'半填'}});
  assert.equal(textHas((await page(listPath(type,'vi'))).html,name),false,`${type} 越南语填一半不显示（3）`);
  // 越南语填完并发布
  saveDraft(r.id,d=>{d.vi=makeVi(type,name)});publish(r.id);
  assert.equal(textHas((await page(listPath(type,'vi'))).html,makeVi(type,name).name),true,`${type} 越南语发布后显示（4）`);
  // 英文填一半也能发布，但不显示
  saveDraft(r.id,d=>{d.en={name:'Half English'}});publish(r.id);
  assert.equal(textHas((await page(listPath(type,'en'))).html,name),false,`${type} 英文填一半不显示（5）`);
  // 改中文草稿：前台旧、预览新
  const field=type==='experts'?'identity':type==='courses'?'goals':type==='cases'?'industry':'description';
  const oldText=current(r.id).published.zh[field];
  saveDraft(r.id,d=>{if(type==='experts')d.zh.identity='改后身份';else if(type==='courses')d.zh.goals='改后目标';else if(type==='cases')d.zh.industry='改后行业';else d.zh.description='改后说明'});
  if(detailUrl)assert.equal(textHas((await page(detailUrl)).html,type==='experts'?'改后身份':type==='courses'?'改后目标':type==='cases'?'改后行业':'改后说明'),false,`${type} 草稿不影响前台（6）`);
  const pv=await fetch(frontBase+previewPath(current(r.id),'zh'),{headers:{cookie:ownerCookie}});assert.equal(pv.status,200);assert.match(await pv.text(),/改后身份|改后目标|改后行业|改后说明/,`${type} 预览用草稿（6）`);
  publish(r.id);
  if(detailUrl)assert.equal(textHas((await page(detailUrl)).html,type==='experts'?'改后身份':type==='courses'?'改后目标':type==='cases'?'改后行业':'改后说明'),true,`${type} 发布后前台更新（7）`);
  // 撤销修改
  const revertValue=current(r.id).published.zh[field];
  saveDraft(r.id,d=>{if(type==='experts')d.zh.identity='要撤销';else if(type==='courses')d.zh.goals='要撤销';else if(type==='cases')d.zh.industry='要撤销';else d.zh.description='要撤销'});
  core.revert(r.id,owner);assert.equal(current(r.id).draft.zh[field],revertValue,`${type} 撤销回到发布版（8）`);
  // 下架
  core.offline(r.id,owner);assert.equal(textHas((await page(listPath(type,'zh'))).html,name),false,`${type} 下架后中文消失（9）`);assert.equal(textHas((await page(listPath(type,'vi'))).html,makeVi(type,name).name),false,`${type} 下架后越南语消失（9）`);
  if(detailUrl)assert.equal((await page(detailUrl)).status,404,`${type} 下架后详情 404（9）`);
  // 重新发布
  publish(r.id);assert.equal(textHas((await page(listPath(type,'zh'))).html,name),true,`${type} 重新发布恢复（10）`);
  // 重启只在一个类型里做（11）
  if(type==='experts'){await restart();assert.equal(textHas((await page(listPath(type,'zh'))).html,name),true,`重启后仍显示（11）`)}
  // 删除
  core.offline(r.id,owner);const fileId=current(r.id).published.shared.image.id;core.remove(r.id,owner);
  assert.equal(current(r.id),undefined,`${type} 删除后后台没有（12）`);assert.ok(!fs.existsSync(core.filePath(fileId)),`${type} 独有文件删除（12）`);
  if(detailUrl)assert.equal((await page(detailUrl)).status,404,`${type} 删除后详情 404（12）`);
  console.log(`${type}：草稿/三语/修改/撤销/下架/重发/删除（1–12）通过`);
 }

 // —— 13–18 关联 ——
 const A=core.saveRecord({type:'experts',draft:{zh:{name:'关联甲',identity:'顾问',tagline:'一句话'}}},owner);publish(A.id);
 const B=core.saveRecord({type:'experts',draft:{zh:{name:'关联乙',identity:'讲师',tagline:'一句话'}}},owner);publish(B.id);
 const C=core.saveRecord({type:'courses',experts:[A.id,B.id],draft:{shared:{category:'cat-aigc',image:img('关联课程.png')},zh:{name:'关联课程',goals:'目标',description:'介绍',audience:'零基础',outline:['第一章']}}},owner);publish(C.id);
 let chtml=await page('/zh/courses/'+C.id+'/');assert.ok(chtml.html.indexOf('关联甲')<chtml.html.indexOf('关联乙'),'课程详情甲在前（13）');
 let html=await page('/zh/courses/');assert.match(html.html,/关联甲/,'课程卡显示主讲（13）');
 assert.match((await page('/zh/teachers/'+A.id+'/')).html,/关联课程/,'甲详情列出课程（13）');
 assert.match((await page('/zh/teachers/'+B.id+'/')).html,/关联课程/,'乙详情列出课程（13）');
 core.saveRecord({...current(C.id),experts:[B.id,A.id]},owner);publish(C.id);
 chtml=await page('/zh/courses/'+C.id+'/');assert.ok(chtml.html.indexOf('关联乙')<chtml.html.indexOf('关联甲'),'调换后乙在前（14）');
 core.offline(A.id,owner);chtml=await page('/zh/courses/'+C.id+'/');assert.doesNotMatch(chtml.html,/关联甲/,'下架甲后课程页不显示（15）');assert.match(chtml.html,/关联乙/);assert.equal((await page('/zh/teachers/'+A.id+'/')).status,404);
 core.remove(A.id,owner);assert.deepEqual(current(C.id).experts,[B.id],'删除甲后课程去掉甲（16）');
 const B2=core.saveRecord({type:'experts',draft:{zh:{name:'只有中文乙',identity:'顾问',tagline:'一句话'}}},owner);publish(B2.id);
 core.saveRecord({...current(C.id),experts:[B.id,B2.id],draft:{...current(C.id).draft,vi:{name:'Khóa liên kết',goals:'Mục tiêu',description:'Giới thiệu',audience:'Người mới',outline:['Chương một']}}},owner);publish(C.id);
 assert.doesNotMatch(await (await fetch(frontBase+'/vi/courses/'+C.id+'/')).text(),/只有中文乙/,'越南语课程不显示只有中文的专家（17）');
 core.offline(C.id,owner);assert.doesNotMatch(await (await fetch(frontBase+'/zh/teachers/'+B.id+'/')).text(),/关联课程/, '下架课程后专家页不再列课程（18）');
 console.log('课程专家关联、语言可见、下架/删除联动（13–18）：通过');

 // —— 19–22 排序与权限 ——
 const O1=core.saveRecord({type:'experts',order:1,draft:{zh:{name:'排序一',identity:'顾问',tagline:'一句话'}}},owner);publish(O1.id);
 const O2=core.saveRecord({type:'experts',order:2,draft:{zh:{name:'排序二',identity:'顾问',tagline:'一句话'}}},owner);publish(O2.id);
 const editor=core.createUser(owner,{account:'e2e-editor',password:'editor-password-123',perms:{}});
 const editorSession=await login('e2e-editor','editor-password-123');await fetch(adminBase+'/api/password',{method:'POST',headers:{'Content-Type':'application/json',cookie:editorSession.cookie,'x-csrf-token':editorSession.csrf},body:JSON.stringify({oldPassword:'editor-password-123',newPassword:'editor-password-456'})});
 const editorLogin=await login('e2e-editor','editor-password-456');
 const orderIds=core.read().records.filter(r=>r.type==='experts').map(r=>r.id).reverse();
 let status=(await api('/api/order','POST',{type:'experts',ids:orderIds},editorLogin)).status;assert.equal(status,403,'没有发布权限不能排序（20）');
 const orderResult=await api('/api/order','POST',{type:'experts',ids:orderIds},session);assert.equal(orderResult.status,200,'有发布权限能排序（19）');
 assert.equal((await page('/zh/teachers/')).html.indexOf('排序二')<(await page('/zh/teachers/')).html.indexOf('排序一'),true,'前台顺序马上变（19）');
 const small=core.saveRecord({type:'experts',draft:{zh:{name:'升大卡',identity:'顾问',tagline:'一句话'}}},owner);publish(small.id);
 const countBig=h=>(h.match(/<a class="v2-lead2"/g)||[]).length;
 const beforeBig=countBig((await page('/zh/teachers/')).html);
 core.saveRecord({...current(small.id),draft:{...current(small.id).draft,shared:{...current(small.id).draft.shared,bigCard:true}}},owner);publish(small.id);
 const afterBig=countBig((await page('/zh/teachers/')).html);assert.equal(afterBig,beforeBig+1,'勾大卡后从小卡移到大卡（21）');
 const Q1=core.saveRecord({type:'qualifications',draft:{shared:{image:img('排序资质1.png')},zh:{name:'排序资质一',description:'说明'}}},owner);publish(Q1.id);
 const Q2=core.saveRecord({type:'qualifications',draft:{shared:{image:img('排序资质2.png')},zh:{name:'排序资质二',description:'说明'}}},owner);publish(Q2.id);
 await api('/api/order','POST',{type:'qualifications',ids:core.read().records.filter(r=>r.type==='qualifications').map(r=>r.id).reverse()},session);
 assert.ok((await page('/zh/')).html.indexOf('排序资质二')<(await page('/zh/')).html.indexOf('排序资质一'),'资质顺序影响首页（22）');
 console.log('排序、无权限 403、大卡迁移、资质首页顺序（19–22）：通过');

 // —— 33–37 规则 ——
 const over=core.saveRecord({type:'experts',draft:{zh:{name:'超'.repeat(21),identity:'顾问',tagline:'一句话'}}},owner);
 assert.throws(()=>publish(over.id),/姓名/, '超上限发布拒绝（33）');
 assert.throws(()=>core.saveRecord({type:'experts',draft:{zh:{highlights:['1','2','3','4']}}},owner),/最多 3 条/, '第 4 条亮点拒收（34）');
 for(const [path,method,body] of [['/api/records/'+orderIds[0]+'/publish','POST',null],['/api/records/'+orderIds[0]+'/offline','POST',null],['/api/records/'+orderIds[0],'DELETE',null],['/api/options','POST',{courseCategories:[]}],['/api/order','POST',{type:'experts',ids:orderIds}]]){const res=await api(path,method,body,editorLogin);assert.equal(res.status,403,path+' 没有权限 403（35）')}
 const bigCount=()=>core.read().records.filter(r=>r.type==='experts'&&r.status==='published'&&(r.published?.shared?.bigCard)).length;
 let bi=0;while(bigCount()<4){const br=core.saveRecord({type:'experts',draft:{shared:{bigCard:true},zh:{name:'大卡'+bi++,identity:'顾问',tagline:'一句话'}}},owner);publish(br.id)}
 const fifth=core.saveRecord({type:'experts',draft:{shared:{bigCard:true},zh:{name:'第五大卡',identity:'顾问',tagline:'一句话'}}},owner);
 assert.throws(()=>publish(fifth.id),/大卡已有 4 位/, '第 5 位大卡发布拒绝（37）');
 const strip=h=>h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<a[^>]*>中文<\/a>/g,'');
 for(const lang of ['vi','en']){const h=strip((await page(`/${lang}/teachers/`)).html);assert.doesNotMatch(h,/[一-鿿]/,`${lang} 页面不混中文（36）`)}
 console.log('超限、亮点上限、无权限 403、英越不混中文、大卡上限（33–37）：通过');

 fs.rmSync(temp,{recursive:true,force:true});console.log('\n第 8 步前后台全流程验证通过');
}catch(e){console.error(e);fs.rmSync(temp,{recursive:true,force:true});process.exitCode=1}finally{for(const s of servers)s.kill();setTimeout(()=>process.exit(process.exitCode||0),300)}})();
