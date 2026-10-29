const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// 第 6 步验收（C7、C8、G1–G7、E5）：发布确认、撤销修改、下架/删除清单、真页面预览
// 真实 Chrome + Playwright；临时数据；不读写 D:\项目\data
let chromium;
try { ({ chromium } = require('D:/项目/node_modules/playwright')); } catch { console.error('缺少 Playwright'); process.exit(1); }
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-publish-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');
core.initialize('pub-admin','pub-password-123');const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');
const imageA=core.file('专家照片.png',png,'image/png'),imageD=core.file('独有照片.png',png,'image/png');
const expert=core.saveRecord({type:'experts',draft:{shared:{image:imageA},zh:{name:'发布验收专家',identity:'旧身份',tagline:'旧一句话'},vi:{name:'Chuyên gia',identity:'Cố vấn',tagline:'Một câu'}}},owner);core.publish(expert.id,owner);
const course=core.saveRecord({type:'courses',experts:[expert.id],draft:{shared:{category:'cat-aigc',image:imageA},zh:{name:'发布验收课程',goals:'目标',description:'介绍',audience:'零基础',outline:['第一章']}}},owner);core.publish(course.id,owner);
const draftOnly=core.saveRecord({type:'experts',draft:{shared:{image:imageD},zh:{name:'独有文件专家',identity:'顾问',tagline:'一句话'}}},owner);

const frontPort=7200+Math.floor(Math.random()*150),adminPort=7400+Math.floor(Math.random()*150);
const front='http://127.0.0.1:'+frontPort,admin='http://127.0.0.1:'+adminPort;
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,PORT:String(frontPort),ADMIN_PORT:String(adminPort)};
const servers=[spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'}),spawn(process.execPath,['后台服务器.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'})];
const shots=path.resolve('D:/data网站数据保存/后台改造验收-2026-10-29/第6步');fs.mkdirSync(shots,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,label,timeout=20000)=>{const end=Date.now()+timeout;while(Date.now()<end){const v=fn();if(v)return v;await sleep(150)}throw Error('等待超时：'+label)};
const rec=id=>core.read().records.find(r=>r.id===id);
let browser;
(async()=>{try{
 let ready=false;for(let i=0;i<120;i++){try{await fetch(front+'/zh/');await fetch(admin+'/api/status');ready=true;break}catch{await sleep(100)}}assert.ok(ready,'服务未启动');
 // 未登录预览打不开
 assert.equal((await fetch(front+`/preview/zh/teachers/${expert.id}/`)).status,401,'没登录不能预览');
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(admin);await page.fill('#account','pub-admin');await page.fill('#password','pub-password-123');await page.click('#login-form button[type=submit]');
 await page.getByRole('heading',{name:'内容总览'}).waitFor({timeout:8000});
 await page.click('[data-action="nav:experts"]');await page.locator('tr',{hasText:'发布验收专家'}).getByRole('button',{name:'编辑'}).click();await page.waitForTimeout(400);

 // —— 草稿：前台旧、预览新 ——
 await page.fill('[data-lang="identity"]','新身份');await page.click('[data-action="save"]');await page.waitForTimeout(700);
 assert.match(await (await fetch(front+`/zh/teachers/${expert.id}/`)).text(),/旧身份/,'存草稿前台仍是旧的');
 await page.goto(front+`/preview/zh/teachers/${expert.id}/`);const previewDraft=await page.content();
 assert.match(previewDraft,/新身份/,'预览用草稿');
 assert.match(previewDraft,/预览 · 未发布/);assert.match(previewDraft,/noindex/);
 assert.match(previewDraft,/\/preview-media\//,'预览图片走后台受保护地址');
 assert.match(previewDraft,/\/preview\/vi\/teachers\//);assert.match(previewDraft,/\/preview\/en\/teachers\//,'预览可切三种语言（C8）');
 await page.screenshot({path:path.join(shots,'01-预览草稿.png'),fullPage:true});

 // —— 发布确认：写清这次改了身份（中文） ——
 await page.goto(admin);await page.click('[data-action="nav:experts"]');await page.locator('tr',{hasText:'发布验收专家'}).getByRole('button',{name:'编辑'}).click();await page.waitForTimeout(300);
 await page.click('[data-action="publish-edit"]');await page.waitForSelector('dialog[open]');
 const confirmText=await page.locator('#modal').innerText();
 assert.match(confirmText,/这次改了：身份（中文）/,'发布框列出这次改的项');
 assert.match(confirmText,/中文页面：会显示/);assert.match(confirmText,/越南语页面：会显示/);
 await page.screenshot({path:path.join(shots,'02-发布确认.png')});
 await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(500);if(await page.locator('#modal[open]').count())await page.click('#modal [data-answer="ok"]');
 assert.equal(rec(expert.id).status,'published');
 assert.match(await (await fetch(front+`/zh/teachers/${expert.id}/`)).text(),/新身份/,'发布后前台是新的');

 // —— 预览和发布后的真页面只差预览条和图片地址 ——
 await page.goto(front+`/preview/zh/teachers/${expert.id}/`);const previewHtml=await page.content();
 await page.goto(front+`/zh/teachers/${expert.id}/`);const realHtml=await page.content();
 const normalize=html=>html.replace(/<div class="preview-bar"[\s\S]*?<\/div>/,'').replace(/<meta name="robots" content="noindex">/g,'').replace(/\/preview-media\//g,'/admin-media/');
 assert.equal(normalize(previewHtml),normalize(realHtml),'预览和真页面只差预览条与图片地址');
 console.log('草稿预览、发布确认、HTML 对比：通过');

 // —— 撤销修改 ——
 await page.goto(admin);await page.click('[data-action="nav:experts"]');await page.locator('tr',{hasText:'发布验收专家'}).getByRole('button',{name:'编辑'}).click();await page.waitForTimeout(300);
 await page.fill('[data-lang="identity"]','要撤销的身份');await page.click('[data-action="save"]');await page.waitForTimeout(600);
 await page.click('[data-action="revert-edit"]');await page.waitForSelector('dialog[open]');await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(600);
 assert.equal(rec(expert.id).draft.zh.identity,'新身份','撤销后草稿回到已发布内容');
 assert.equal(await page.inputValue('[data-lang="identity"]'),'新身份');
 console.log('撤销修改：通过');

 // —— 越南语原来显示、清空后发布红字提醒 ——
 await page.click('[data-editor-action="tab:vi"]');await page.waitForTimeout(300);
 await page.fill('[data-lang="identity"]','');await page.click('[data-action="save"]');await page.waitForTimeout(600);
 await page.click('[data-action="publish-edit"]');await page.waitForSelector('dialog[open]');
 const redText=await page.locator('#modal').innerText();
 assert.match(redText,/越南语页面原来显示，发布后会消失/);
 assert.equal(await page.locator('#modal li[style*="b91c1c"]').count()>0,true,'消失提醒要用红字');
 await page.screenshot({path:path.join(shots,'03-三语消失提醒.png')});
 await page.click('#modal [data-answer="cancel"]');await page.waitForTimeout(300);
 // 没填完的越南语预览显示提示页
 await page.goto(front+`/preview/vi/teachers/${expert.id}/`);assert.match(await page.content(),/这种语言还没填完/);
 console.log('三语消失红字提醒、未填完预览提示页：通过');

 // —— 下架影响清单；下架后前台消失、课程不再显示他 ——
 await page.goto(admin);await page.click('[data-action="nav:experts"]');await page.locator('tr',{hasText:'发布验收专家'}).getByRole('button',{name:'编辑'}).click();await page.waitForTimeout(300);
 await page.click('[data-action="offline-edit"]');await page.waitForSelector('dialog[open]');
 const offlineText=await page.locator('#modal').innerText();
 assert.match(offlineText,/专家列表页/);assert.match(offlineText,/他的详情页/);
 assert.match(offlineText,/发布验收课程/,'下架清单列出关联课程');
 await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(600);
 assert.equal(rec(expert.id).status,'offline');
 assert.equal((await fetch(front+`/zh/teachers/${expert.id}/`)).status,404,'下架后专家详情 404');
 assert.doesNotMatch(await (await fetch(front+`/zh/courses/${course.id}/`)).text(),/发布验收专家/,'下架后课程页不再显示他');

 // —— 删除清单、备份、文件清理 ——
 const backupDir=path.join(temp,'backups');const backupCount=fs.existsSync(backupDir)?fs.readdirSync(backupDir).length:0;
 await page.click('[data-action="delete-edit"]');await page.waitForSelector('dialog[open]');
 const deleteText=await page.locator('#modal').innerText();
 assert.match(deleteText,/会去掉的关联/);assert.match(deleteText,/删除前会自动备份一次/);
 await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(800);
 assert.equal(rec(expert.id),undefined,'删专家后记录不在');
 assert.ok(fs.existsSync(core.filePath(imageA.id)),'课程还在用的照片要保留');
 assert.ok(fs.existsSync(backupDir)&&fs.readdirSync(backupDir).length>backupCount,'删除前自动备份');
 console.log('下架影响清单、删除清单、备份与文件保留：通过');

 // 只被草稿引用的文件：删除后文件消失
 await page.goto(admin);await page.click('[data-action="nav:experts"]');await page.locator('tr',{hasText:'独有文件专家'}).getByRole('button',{name:'删除'}).click();await page.waitForSelector('dialog[open]');
 const uniqueText=await page.locator('#modal').innerText();assert.match(uniqueText,/独有照片\.png/,'删除框列出独有文件');
 await page.screenshot({path:path.join(shots,'04-删除清单.png')});
 await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(800);
 assert.equal(rec(draftOnly.id),undefined);assert.ok(!fs.existsSync(core.filePath(imageD.id)),'独有文件随记录删除');

 // 预览三语切换链接和未登录拦截已在上方验证
 assert.deepEqual(errors,[],'页面不应出现脚本错误');
 console.log('\n第 6 步发布流程与预览全部验证通过');
}catch(error){console.error(error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});for(const s of servers)s.kill();fs.rmSync(temp,{recursive:true,force:true});process.exit(process.exitCode||0)}})();
