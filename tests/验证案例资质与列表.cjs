const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// 第 4 步验收（A1、C6、M2、F1、G8、K2）：案例/资质新表单、首页展示、选项设置、列表三语状态/筛选/调整顺序
// 真实 Chrome + Playwright；临时数据目录；不读写 D:\项目\data
let chromium;
try { ({ chromium } = require('D:/项目/node_modules/playwright')); } catch { console.error('缺少 Playwright：D:/项目/node_modules/playwright'); process.exit(1); }
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const photo='D:/项目/public/team/zheng-yi.jpg';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-case-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');
core.initialize('case-admin','case-password-123');
const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');
const img=name=>core.file(name,png,'image/png');
// 旧案例、旧资质各若干（K2），图片走旧的语言栏位
const caseFields={industry:'制造业',description:'旧案例简介',problem:'旧问题',steps:'第一步\n第二步',people:'甲、乙',deliverables:'成果一\n成果二'};
for(let i=1;i<=6;i++){const r=core.saveRecord({type:'cases',draft:{zh:{name:`旧案例${i}`,...caseFields,image:img(`旧案例${i}.png`)}}},owner);core.publish(r.id,owner)}
const quals=[];
for(let i=1;i<=7;i++){const r=core.saveRecord({type:'qualifications',draft:{zh:{name:`旧资质${i}`,description:`旧资质说明${i}`,image:img(`旧资质${i}.png`)}}},owner);core.publish(r.id,owner);quals.push(r)}
for(const r of quals.slice(0,3)){const cur=core.read().records.find(x=>x.id===r.id);core.saveRecord({...cur,featured:true},owner)}
// 列表用专家：一个完整无照片、一个填一半、一个没填
const e1=core.saveRecord({type:'experts',draft:{zh:{name:'完整专家',identity:'顾问',tagline:'一句话'}}},owner);core.publish(e1.id,owner);
const e2=core.saveRecord({type:'experts',draft:{zh:{name:'半填专家'}}},owner);
const e3=core.saveRecord({type:'experts',draft:{}},owner);
const e4=core.saveRecord({type:'experts',draft:{zh:{name:'排序专家甲',identity:'顾问',tagline:'一句话'}}},owner);core.publish(e4.id,owner);
const e5=core.saveRecord({type:'experts',draft:{zh:{name:'排序专家乙',identity:'顾问',tagline:'一句话'}}},owner);core.publish(e5.id,owner);
const e6=core.saveRecord({type:'experts',draft:{shared:{image:img('有照片专家.png')},zh:{name:'有照片专家',identity:'顾问',tagline:'一句话'}}},owner);core.publish(e6.id,owner);

const port=6400+Math.floor(Math.random()*300),base='http://127.0.0.1:'+port+'/';
const shots=path.resolve('D:/data网站数据保存/后台改造验收-2026-10-29/第4步');fs.mkdirSync(shots,{recursive:true});
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,ADMIN_PORT:String(port)};
const server=spawn(process.execPath,[path.join(__dirname,'..','后台服务器.js')],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rec=name=>core.read().records.find(r=>r.draft?.zh?.name===name||r.published?.zh?.name===name);
const waitFor=async(fn,label,timeout=20000)=>{const end=Date.now()+timeout;while(Date.now()<end){const v=fn();if(v)return v;await sleep(150)}throw Error('等待超时：'+label)};

let browser;
(async()=>{try{
 let ready=false;for(let i=0;i<120;i++){try{await fetch(base+'api/status');ready=true;break}catch{await sleep(100)}}assert.ok(ready,'后台服务未启动');
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.fill('#account','case-admin');await page.fill('#password','case-password-123');await page.click('#login-form button[type=submit]');
 await page.getByRole('heading',{name:'内容总览'}).waitFor({timeout:8000});

 // —— 案例新表单 ——
 await page.click('[data-action="nav:cases"]');
 await page.getByRole('button',{name:/新增案例/}).click();
 await page.waitForSelector('[data-editor-file="image"]',{state:'attached'});
 await page.setInputFiles('[data-editor-file="image"]',photo);
 await page.waitForSelector('dialog[data-media-cropper]',{timeout:20000});
 await page.screenshot({path:path.join(shots,'01-案例裁剪.png')});
 await page.click('[data-crop-confirm]');await page.waitForSelector('img.is-wide',{timeout:40000});
 await page.fill('[data-lang="name"]','新案例验收');
 await page.fill('[data-lang="industry"]','教育');
 await page.fill('[data-lang="description"]','新案例简介');
 await page.fill('[data-lang="problem"]','业务问题');
 await page.fill('[data-lang="steps"]','第一步\n第二步');
 await page.fill('[data-lang="people"]','张三、李四');
 await page.fill('[data-lang="deliverables"]','成果一\n成果二');
 await page.click('[data-action="save"]');await page.waitForTimeout(800);
 const newCase=await waitFor(()=>rec('新案例验收'),'案例保存');
 assert.equal(newCase.draft.shared.image.width,1600);assert.equal(newCase.draft.shared.image.height,1000,'案例图片 1600×1000');
 assert.equal(newCase.draft.zh.problem,'业务问题');
 // 旧案例打开内容完整
 await page.click('[data-action="nav:cases"]');await page.waitForTimeout(300);
 await page.locator('tr',{hasText:'旧案例1'}).getByRole('button',{name:'编辑'}).click();await page.waitForTimeout(400);
 assert.equal(await page.inputValue('[data-lang="industry"]'),'制造业');assert.ok((await page.locator('img.is-wide').count())>0,'旧案例图片要显示');
 console.log('案例新表单与旧案例兼容（K2）：通过');

 // —— 资质新表单 + 首页展示 ——
 await page.click('[data-action="nav:qualifications"]');
 await page.getByRole('button',{name:/新增资料/}).click();
 await page.waitForSelector('[data-editor-file="image"]',{state:'attached'});
 await page.setInputFiles('[data-editor-file="image"]',photo);
 await page.waitForSelector('dialog[data-media-cropper]',{timeout:20000});
 assert.equal(await page.locator('[data-crop-zoom]').isDisabled(),true,'资质图片不裁剪');
 await page.click('[data-crop-confirm]');await page.waitForSelector('img.is-wide',{timeout:40000});
 await page.fill('[data-lang="name"]','新资质验收');await page.fill('[data-lang="description"]','新资质说明');
 assert.equal(await page.locator('[data-featured]').isDisabled(),true,'草稿不能勾首页展示（G8）');
 await page.click('[data-action="save"]');await page.waitForTimeout(800);
 const newQual=await waitFor(()=>rec('新资质验收'),'资质保存');
 assert.ok(Math.max(newQual.draft.shared.image.width,newQual.draft.shared.image.height)<=2400,'资质长边不超过 2400');
 assert.ok(!newQual.draft.shared.image.width||newQual.draft.shared.image.width>0);
 // 发布后可以勾首页展示；已有 3 个时第 4 个保存会提示
 await page.click('[data-action="publish-edit"]');await page.waitForSelector('dialog[open]');await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(500);
 await page.check('[data-featured]');
 await page.click('[data-action="save"]');await page.waitForTimeout(700);
 assert.match(await page.locator('#toast').innerText(),/最多展示 3/, '勾第 4 个要提示最多 3 个');
 console.log('资质新表单、不裁剪、首页展示上限（G8）：通过');

 // —— 选项设置 ——
 await page.click('[data-action="nav:options"]');await page.waitForTimeout(300);
 if(await page.locator('#modal[open]').count()){await page.click('#modal [data-answer="discard"]');await page.waitForTimeout(400)}
 assert.ok(await page.getByRole('heading',{name:'选项设置'}).isVisible());
 await page.click('[data-action="option-add:courseCategories"]');await page.waitForTimeout(200);
 const index=(await page.locator('[data-option-item^="courseCategories:"]').count())-1;
 await page.fill(`[data-opt="courseCategories:${index}:zh"]`,'AI Agent 课程');
 await page.fill(`[data-opt="courseCategories:${index}:vi"]`,'Khóa học AI Agent');
 await page.fill(`[data-opt="courseCategories:${index}:en"]`,'AI Agent Courses');
 await page.click('[data-action="option-save"]');await page.waitForTimeout(700);
 assert.ok((await page.locator('#toast').innerText()).includes('选项已保存'));
 await page.click('[data-action="nav:courses"]');await page.getByRole('button',{name:/新增课程/}).click();await page.waitForTimeout(300);
 let optionsText=await page.locator('[data-shared-select="category"]').innerText();
 assert.match(optionsText,/AI Agent 课程/,'新分类要出现在课程下拉（A1）');
 await page.click('[data-action="nav:options"]');await page.waitForTimeout(300);
 await page.check(`[data-opt-disabled="courseCategories:${index}"]`);
 await page.click('[data-action="option-save"]');await page.waitForTimeout(700);
 await page.click('[data-action="nav:courses"]');await page.getByRole('button',{name:/新增课程/}).click();await page.waitForTimeout(300);
 optionsText=await page.locator('[data-shared-select="category"]').innerText();
 assert.doesNotMatch(optionsText,/AI Agent 课程/,'停用后下拉里不应再出现');
 console.log('选项设置：新增分类、三种语言、停用后课程下拉：通过');

 // —— 列表三语状态 / 筛选 / 调整顺序 ——
 await page.click('[data-action="nav:experts"]');await page.waitForTimeout(400);
 const rowText=async name=>page.locator('tr',{hasText:name}).innerText();
 assert.match(await rowText('完整专家'),/ZH 会显示/);assert.match(await rowText('完整专家'),/VI 没填/);assert.match(await rowText('完整专家'),/缺照片/);
 assert.match(await rowText('半填专家'),/ZH 填了一半/);
 assert.match(await rowText('未命名内容'),/ZH 没填/);
 await page.selectOption('#status-filter','incomplete');await page.waitForTimeout(300);
 assert.ok((await page.locator('tr',{hasText:'半填专家'}).count())>0);
 assert.equal(await page.locator('tr',{hasText:'完整专家'}).count(),0,'有语言没填完筛选应排除完整专家');
 await page.selectOption('#status-filter','missing-photo');await page.waitForTimeout(300);
 assert.ok((await page.locator('tr',{hasText:'完整专家'}).count())>0);
 assert.ok((await page.locator('tr',{hasText:'半填专家'}).count())>0,'半填专家也没有照片，应出现在缺照片里');
 assert.equal(await page.locator('tr',{hasText:'有照片专家'}).count(),0,'缺照片筛选不应包含有照片的专家');
 await page.selectOption('#status-filter','');await page.waitForTimeout(300);
 // 清掉草稿，只留已发布专家做排序
 core.remove(e2.id,owner);core.remove(e3.id,owner);
 await page.click('[data-action="nav:experts"]');await page.waitForTimeout(300);
 const before=core.list(true).filter(r=>r.type==='experts').map(r=>r.id);
 await page.click('[data-action="order-start"]');await page.waitForTimeout(300);
 const orderRows=page.locator('[data-order-id]');const firstId=await orderRows.nth(0).getAttribute('data-order-id');
 const secondId=await orderRows.nth(1).getAttribute('data-order-id');
 await page.dragAndDrop(`[data-order-id="${secondId}"]`,`[data-order-id="${firstId}"]`);await page.waitForTimeout(300);
 await page.screenshot({path:path.join(shots,'02-调整顺序.png')});
 await page.click('[data-action="order-save"]');await page.waitForTimeout(800);
 const after=core.list(true).filter(r=>r.type==='experts').map(r=>r.id);
 assert.equal(after[0],before[1],'保存后 list(true) 顺序要变（F1）');
 assert.equal(after[1],before[0]);
 console.log('列表三语状态、筛选、调整顺序（C6/F1）：通过');

 const width=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
 assert.ok(width.sw<=width.iw,'1366 宽不应横向滚动');
 assert.deepEqual(errors,[],'页面不应出现脚本错误');
 console.log('\n第 4 步案例、资质、选项与列表全部验证通过');
}catch(error){console.error(error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});server.kill();fs.rmSync(temp,{recursive:true,force:true});process.exit(process.exitCode||0)}})();
