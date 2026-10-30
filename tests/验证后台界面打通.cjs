const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// 第 8 步 / 方案 6.3：浏览器走查（像真人一样点），每一步截图
let chromium;
try { ({ chromium } = require('D:/项目/node_modules/playwright')); } catch { console.error('缺少 Playwright'); process.exit(1); }
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const photo=path.join(__dirname,'素材','测试专家照片.jpg'),video=path.join(__dirname,'素材','测试视频.mp4');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-ui-e2e-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');
core.initialize('ui-admin','ui-password-123');const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');const img=n=>core.file(n,png,'image/png');
const other=core.saveRecord({type:'experts',draft:{shared:{image:img('另一位.png')},zh:{name:'另一位讲师',identity:'讲师',tagline:'一句话'}}},owner);core.publish(other.id,owner);
const frontPort=8100+Math.floor(Math.random()*150),adminPort=8300+Math.floor(Math.random()*150),front='http://127.0.0.1:'+frontPort,admin='http://127.0.0.1:'+adminPort;
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,PORT:String(frontPort),ADMIN_PORT:String(adminPort)};
const servers=[spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'}),spawn(process.execPath,['后台服务器.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'})];
const shots=path.resolve('D:/data网站数据保存/后台改造验收-2026-10-29/第8步/界面走查');fs.mkdirSync(shots,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function closeDialogs(page){for(let i=0;i<3;i++){if(!(await page.locator('#modal[open]').count()))return;await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(300)}}
async function publishEditor(page){await page.click('[data-action="publish-edit"]');await page.waitForSelector('dialog[open]',{timeout:15000});await page.screenshot({path:path.join(shots,`publish-${Date.now()}.png`)});await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(700);await closeDialogs(page)}
let browser;
(async()=>{try{
 let ready=false;for(let i=0;i<120;i++){try{await fetch(front+'/zh/');await fetch(admin+'/api/status');ready=true;break}catch{await sleep(100)}}assert.ok(ready);
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(admin);await page.screenshot({path:path.join(shots,'01-登录.png')});
 await page.fill('#account','ui-admin');await page.fill('#password','ui-password-123');await page.click('#login-form button[type=submit]');await page.getByRole('heading',{name:'内容总览'}).waitFor({timeout:8000});

 // 新专家 + 照片 + 预览 + 发布
 await page.click('[data-action="nav:experts"]');await page.getByRole('button',{name:/新增专家/}).click();await page.waitForSelector('[data-editor-file="image"]',{state:'attached'});
 await page.fill('[data-lang="name"]','界面测试讲师');await page.fill('[data-lang="identity"]','讲师');await page.fill('[data-lang="tagline"]','界面走查用');
 await page.setInputFiles('[data-editor-file="image"]',photo);await page.waitForSelector('dialog[data-media-cropper]',{timeout:15000});await page.click('[data-crop-confirm]');
 await page.waitForFunction(()=>(document.querySelector('#toast')?.textContent||'').includes('图片已上传'),null,{timeout:60000});await page.click('[data-action="save"]');await page.waitForTimeout(900);
 await page.screenshot({path:path.join(shots,'02-专家表单.png'),fullPage:true});
 const popupPromise=page.waitForEvent('popup');await page.click('[data-action="preview-edit"]');const popup=await popupPromise;await popup.waitForLoadState('load');await popup.screenshot({path:path.join(shots,'03-真页面预览.png'),fullPage:true});await popup.close();
 await publishEditor(page);
 assert.match(await (await fetch(front+'/zh/teachers/')).text(),/界面测试讲师/);
 // 越南语补完并发布
 await page.click('[data-editor-action="tab:vi"]');await page.waitForTimeout(300);
 await page.fill('[data-lang="name"]','Giảng viên giao diện');await page.fill('[data-lang="identity"]','Giảng viên');await page.fill('[data-lang="tagline"]','Một câu');
 await page.click('[data-action="save"]');await page.waitForTimeout(800);await publishEditor(page);
 assert.match(await (await fetch(front+'/vi/teachers/')).text(),/Giảng viên giao diện/);
 console.log('新专家、照片、预览、三语发布：通过');

 // 新课程：封面、两位专家、片段
 await page.click('[data-action="nav:courses"]');await page.getByRole('button',{name:/新增课程/}).click();await page.waitForTimeout(300);
 await page.selectOption('[data-shared-select="category"]','cat-aigc');
 await page.setInputFiles('[data-editor-file="image"]',photo);await page.waitForSelector('dialog[data-media-cropper]',{timeout:15000});await page.click('[data-crop-confirm]');
 await page.waitForFunction(()=>(document.querySelector('#toast')?.textContent||'').includes('图片已上传'),null,{timeout:60000});
 await page.check(`[data-expert-check="${other.id}"]`);await page.waitForTimeout(300);
 const testExpert=core.read().records.find(r=>r.type==='experts'&&r.draft?.zh?.name==='界面测试讲师');
 await page.check(`[data-expert-check="${testExpert.id}"]`);await page.waitForTimeout(300);
 await page.click('[data-editor-action="expert-down:0"]');await page.waitForTimeout(300);
 await page.fill('[data-lang="name"]','界面测试课程');await page.fill('[data-lang="goals"]','目标');await page.fill('[data-lang="description"]','课程介绍');await page.fill('[data-lang="audience"]','零基础');
 await page.click('[data-editor-action="list-add:outline"]');await page.waitForTimeout(200);await page.fill('[data-lang-list="outline"][data-index="0"]','第一章');
 await page.click('[data-editor-action="clip-add"]');await page.waitForTimeout(250);await page.setInputFiles('[data-editor-file="clip-video"][data-clip="0"]',video);await page.waitForSelector('.clip-media video',{timeout:60000});await page.fill('[data-clip-title="0"]','开场');
 await page.screenshot({path:path.join(shots,'04-课程表单.png'),fullPage:true});await page.click('[data-action="save"]');await page.waitForTimeout(1200);await publishEditor(page);
 const courseRecord=core.read().records.find(r=>r.type==='courses'&&r.draft?.zh?.name==='界面测试课程');
 assert.match(await (await fetch(front+'/zh/courses/'+courseRecord.id+'/')).text(),/另一位讲师|界面测试讲师/);
 console.log('新课程、两位专家、片段、发布：通过');

 // 调整专家顺序；下架、删除测试讲师
 await page.click('[data-action="nav:experts"]');await page.waitForTimeout(400);await page.click('[data-action="order-start"]');await page.waitForTimeout(300);
 const rows=page.locator('[data-order-id]');if(await rows.count()>1){const a=await rows.nth(0).getAttribute('data-order-id'),b=await rows.nth(1).getAttribute('data-order-id');await page.dragAndDrop(`[data-order-id="${b}"]`,`[data-order-id="${a}"]`);await page.waitForTimeout(300)}
 await page.screenshot({path:path.join(shots,'05-调整顺序.png')});await page.click('[data-action="order-save"]');await page.waitForTimeout(800);
 await page.locator('tr',{hasText:'界面测试讲师'}).getByRole('button',{name:'编辑'}).click();await page.waitForTimeout(400);
 await page.click('[data-action="offline-edit"]');await page.waitForSelector('dialog[open]');await page.screenshot({path:path.join(shots,'06-下架清单.png')});await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(700);
 assert.doesNotMatch(await (await fetch(front+'/zh/courses/'+courseRecord.id+'/')).text(),/界面测试讲师/);
 assert.equal((await fetch(front+'/zh/teachers/'+testExpert.id+'/')).status,404);
 await page.click('[data-action="delete-edit"]');await page.waitForSelector('dialog[open]');await page.screenshot({path:path.join(shots,'07-删除清单.png')});await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(800);
 assert.equal((await fetch(front+'/zh/teachers/'+testExpert.id+'/')).status,404);
 console.log('排序、下架、删除：通过');

 // 案例、资质
 async function makeCaseOrQual(kind){
  await page.click(`[data-action="nav:${kind}"]`);await page.getByRole('button',{name:kind==='cases'?/新增案例/:/新增资料/}).click();await page.waitForTimeout(300);
  await page.setInputFiles('[data-editor-file="image"]',photo);await page.waitForSelector('dialog[data-media-cropper]',{timeout:15000});await page.click('[data-crop-confirm]');
  await page.waitForFunction(()=>(document.querySelector('#toast')?.textContent||'').includes('图片已上传'),null,{timeout:60000});
  if(kind==='cases'){await page.fill('[data-lang="name"]','界面测试案例');await page.fill('[data-lang="industry"]','行业');await page.fill('[data-lang="description"]','简介');await page.fill('[data-lang="problem"]','问题');await page.fill('[data-lang="steps"]','一\n二');await page.fill('[data-lang="people"]','人');await page.fill('[data-lang="deliverables"]','成果')}
  else{await page.fill('[data-lang="name"]','界面测试资质');await page.fill('[data-lang="description"]','说明')}
  await page.click('[data-action="save"]');await page.waitForTimeout(800);await publishEditor(page);
  await page.check('[data-featured]');await page.click('[data-action="save"]');await page.waitForTimeout(700);await publishEditor(page);
 }
 await makeCaseOrQual('cases');assert.match(await (await fetch(front+'/zh/cases/')).text(),/界面测试案例/);
 await makeCaseOrQual('qualifications');assert.match(await (await fetch(front+'/zh/')).text(),/界面测试资质/);
 console.log('案例、资质发布并出现在前台：通过');

 assert.deepEqual(errors,[],'页面不应出现脚本错误');
 console.log('\n第 8 步浏览器走查全部通过');
}catch(error){console.error(error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});for(const s of servers)s.kill();fs.rmSync(temp,{recursive:true,force:true});process.exit(process.exitCode||0)}})();
