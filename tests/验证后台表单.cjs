const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// 第 3 步验收（B1、B3、B4、B6、C4、C5、M2、M7、E1、E3、F6、G9）：
// 新专家、课程表单；字数；三语对照与检查；共用照片/封面；片段首帧；附件；只读授课课程；离开才提示。
// 真实 Chrome + Playwright；临时数据目录；不读写 D:\项目\data
let chromium;
try { ({ chromium } = require('D:/项目/node_modules/playwright')); } catch { console.error('缺少 Playwright：D:/项目/node_modules/playwright'); process.exit(1); }
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(fs.existsSync(chrome),'找不到本机 Chrome：'+chrome);
const photo='D:/项目/public/team/zheng-yi.jpg';
assert.ok(fs.existsSync(photo),'找不到测试照片：'+photo);
const videoFixture=path.join(__dirname,'素材','测试视频.mp4');
assert.ok(fs.existsSync(videoFixture),'找不到测试视频');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-form-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');
core.initialize('form-admin','form-password-123');
const owner={role:'owner',name:'主管理员'};
const expertA=core.saveRecord({type:'experts',draft:{shared:{bigCard:true},zh:{name:'专家甲',identity:'顾问',tagline:'一句话'}}},owner);core.publish(expertA.id,owner);
const expertB=core.saveRecord({type:'experts',draft:{zh:{name:'专家乙',identity:'讲师',tagline:'一句话'}}},owner);core.publish(expertB.id,owner);
const pdf=path.join(temp,'验收讲义.pdf');fs.writeFileSync(pdf,Buffer.from('%PDF-1.4\n% 验收用的测试讲义\n'));

const port=6100+Math.floor(Math.random()*300),base='http://127.0.0.1:'+port+'/';
const shots=path.resolve('D:/data网站数据保存/后台改造验收-2026-10-29/第3步');fs.mkdirSync(shots,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,ADMIN_PORT:String(port)};
const server=spawn(process.execPath,[path.join(__dirname,'..','后台服务器.js')],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
const recordByName=(type,name)=>core.read().records.find(r=>r.type===type&&(r.draft?.zh?.name===name||r.published?.zh?.name===name));
const waitFor=async(fn,label,timeout=20000)=>{const end=Date.now()+timeout;while(Date.now()<end){const value=fn();if(value)return value;await sleep(150)}throw Error('等待超时：'+label)};

let browser;
(async()=>{try{
 let ready=false;
 for(let i=0;i<120;i++){try{await fetch(base+'api/status');ready=true;break}catch{await sleep(100)}}
 assert.ok(ready,'后台服务未启动');
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.fill('#account','form-admin');await page.fill('#password','form-password-123');await page.click('#login-form button[type=submit]');
 await page.getByRole('heading',{name:'内容总览'}).waitFor({timeout:8000});

 // —— 新专家表单 ——
 await page.click('[data-action="nav:experts"]');
 await page.getByRole('button',{name:/新增专家/}).click();
 await page.waitForSelector('[data-editor-file="image"]',{state:'attached'});
 assert.equal(await page.locator('.tabs button:has-text("基础设置")').count(),0,'不该再有“基础设置”标签');
 assert.ok((await page.locator('main').innerText()).includes('① 共用'));
 assert.ok((await page.locator('#editor-lang-check').innerText()).includes('中文'));
 await page.fill('[data-lang="name"]','新表单专家');
 await page.fill('[data-lang="identity"]','一二三四五六七八九十一二三');
 const identityCounter=page.locator('[data-count="identity"]');
 assert.match(await identityCounter.innerText(),/13 \/ 12/);
 assert.match(await identityCounter.getAttribute('class'),/over/,'超过上限要变红');
 await page.fill('[data-lang="identity"]','Agent 落地 · 主讲');
 await page.fill('[data-lang="tagline"]','十年一线落地经验');
 const bigText=await page.locator('text=已发布大卡').first().innerText();
 assert.match(bigText,/已发布大卡 1 位/);assert.match(bigText,/专家甲/);
 await page.check('[data-shared-check="bigCard"]');await page.waitForTimeout(200);
 await page.setInputFiles('[data-editor-file="image"]',photo);
 await page.waitForSelector('dialog[data-media-cropper]',{timeout:20000});
 await page.screenshot({path:path.join(shots,'01-专家照片裁剪.png')});
 await page.click('[data-crop-confirm]');
 await page.waitForSelector('img.is-round',{timeout:40000});
 for(let i=0;i<3;i++){await page.click('[data-editor-action="list-add:highlights"]');await page.fill(`[data-lang-list="highlights"][data-index="${i}"]`,['带过 30 个项目','十年教学','一线落地'][i])}
 assert.equal(await page.locator('[data-editor-action="list-add:highlights"]').isDisabled(),true,'第 3 条后添加要变灰（B4）');
 await page.click('[data-editor-action="tab:vi"]');await page.waitForTimeout(250);
 assert.ok((await page.locator('.zh-ref').count())>=3,'切越南语时每项上面要有中文对照（C5）');
 assert.equal(await page.locator('dialog[open]').count(),0,'切换语言不应弹未保存提示（G9）');
 assert.ok((await page.locator('#editor-lang-check').innerText()).includes('越南语'));
 await page.screenshot({path:path.join(shots,'02-越南语对照.png'),fullPage:true});
 await page.click('[data-editor-action="jump:en:name"]');await page.waitForTimeout(250);
 assert.match(await page.locator('.tabs .tab.active').first().innerText(),/英文/,'三语检查点一下要跳到那一项（C4）');
 await page.click('[data-editor-action="tab:zh"]');await page.waitForTimeout(150);
 await page.click('[data-action="save"]');await page.waitForTimeout(800);
 const savedExpert=await waitFor(()=>recordByName('experts','新表单专家'),'专家保存');
 assert.ok(savedExpert.draft.shared.image?.id,'照片要进共用区');
 assert.equal(savedExpert.draft.vi.image?.id,savedExpert.draft.shared.image.id,'照片三语共用');
 assert.equal(savedExpert.draft.zh.highlights.length,3);
 assert.ok(savedExpert.draft.shared.bigCard);
 assert.equal(savedExpert.draft.shared.image.width,1000);assert.equal(savedExpert.draft.shared.image.height,1000,'专家照片存 1000×1000');
 await page.click('[data-action="publish-edit"]');
 await page.waitForSelector('dialog[open]');
 const expertDialog=await page.locator('#modal').innerText();
 assert.ok(expertDialog.includes('已发布'),'中文填完、越南语/英文空着应能发布（D3）');
 assert.match(expertDialog,/越南语：不会显示/);
 assert.match(expertDialog,/英文：不会显示/);
 await page.screenshot({path:path.join(shots,'03-发布确认.png')});
 await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(400);
 assert.equal(recordByName('experts','新表单专家').status,'published');
 console.log('新专家表单：字数、大卡、照片、列表上限、三语对照、发布（D3）：通过');

 // —— 新课程表单 ——
 await page.click('[data-action="nav:courses"]');
 await page.getByRole('button',{name:/新增课程/}).click();
 await page.waitForSelector('[data-editor-file="image"]',{state:'attached'});
 await page.selectOption('[data-shared-select="category"]','cat-aigc');
 await page.setInputFiles('[data-editor-file="image"]',photo);
 await page.waitForSelector('dialog[data-media-cropper]',{timeout:20000});
 await page.click('[data-crop-confirm]');
 await page.waitForSelector('img.is-wide',{timeout:40000});
 await page.check(`[data-expert-check="${expertA.id}"]`);await page.waitForTimeout(250);
 await page.check(`[data-expert-check="${expertB.id}"]`);await page.waitForTimeout(250);
 assert.match(await page.locator('[data-expert-item]').first().innerText(),/专家甲/);
 await page.fill('[data-expert-search]','专家乙');await page.waitForTimeout(100);
 const visibleExperts=await page.locator('.expert-options label:visible').allInnerTexts();
 assert.ok(visibleExperts.some(x=>x.includes('专家乙'))&&!visibleExperts.some(x=>x.includes('专家甲')),'专家选择器要能搜索（E1）');
 await page.fill('[data-expert-search]','');
 const items=page.locator('[data-expert-item]');
 await items.nth(1).dragTo(items.nth(0));await page.waitForTimeout(400);
 assert.match(await page.locator('[data-expert-item]').first().innerText(),/专家乙/,'拖动后第一位应是专家乙（E1）');
 assert.match(await page.locator('[data-expert-item]').first().innerText(),/主讲/,'第一位自动标主讲');
 await page.check('[data-fact-check="fact-hours"]');await page.waitForTimeout(250);
 await page.check('[data-fact-check="fact-format"]');await page.waitForTimeout(250);
 await page.click('[data-editor-action="clip-add"]');await page.waitForTimeout(250);
 await page.setInputFiles('[data-editor-file="clip-video"][data-clip="0"]',videoFixture);
 await page.waitForSelector('.clip-media video',{timeout:60000});
 assert.match(await page.locator('.clip-meta').first().innerText(),/0\.6 秒/,'要显示视频时长');
 await page.fill('[data-lang-list="clipTitles"][data-index="0"]','开场演示');
 await page.fill('[data-frame-time="0"]','0');
 await page.click('[data-editor-action="clip-frame:0"]');
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('已用第'),null,{timeout:30000});
 await page.setInputFiles('[data-editor-file="attachment"]',pdf);
 await page.waitForSelector('.attach-row',{timeout:30000});
 await page.uncheck('[data-attachment-lang="0:vi"]');
 await page.uncheck('[data-attachment-lang="0:en"]');
 await page.fill('[data-lang-list="attachmentNames"][data-index="0"]','课程讲义');
 await page.fill('[data-lang="name"]','表单验收课程');
 await page.fill('[data-lang="goals"]','学完能独立落地');
 await page.fill('[data-lang="description"]','这是一门用于表单验收的课程介绍。');
 await page.fill('[data-lang="audience"]','零基础学员');
 await page.click('[data-editor-action="list-add:outline"]');await page.waitForTimeout(200);
 await page.fill('[data-lang-list="outline"][data-index="0"]','第一章 入门');
 await page.fill('[data-lang-list="factValues"][data-index="0"]','54 课时');
 await page.fill('[data-lang-list="factValues"][data-index="1"]','线上直播');
 await page.screenshot({path:path.join(shots,'04-课程表单.png'),fullPage:true});
 await page.click('[data-action="save"]');await page.waitForTimeout(900);
 const savedCourse=await waitFor(()=>recordByName('courses','表单验收课程'),'课程保存');
 assert.equal(savedCourse.draft.shared.category,'cat-aigc');
 assert.ok(savedCourse.draft.shared.image?.id,'封面要进共用区');
 assert.deepEqual(savedCourse.draft.shared.experts,[expertB.id,expertA.id],'授课专家顺序按拖动保存');
 assert.deepEqual(savedCourse.draft.shared.factLabels,['fact-hours','fact-format']);
 assert.ok(savedCourse.draft.shared.clips[0]?.video?.id,'片段视频已保存');
 assert.ok(savedCourse.draft.shared.clips[0]?.cover?.id,'片段封面已保存（M7）');
 assert.deepEqual(savedCourse.draft.shared.attachments[0]?.langs,['zh'],'附件只勾中文（M8）');
 assert.equal(savedCourse.draft.zh.outline[0],'第一章 入门');
 assert.equal(savedCourse.draft.shared.image.width,1600);assert.equal(savedCourse.draft.shared.image.height,900,'课程封面存 1600×900');
 assert.deepEqual(savedCourse.draft.zh.factValues.slice(0,2),['54 课时','线上直播']);
 await page.click('[data-action="publish-edit"]');
 await page.waitForSelector('dialog[open]');
 const courseDialog=await page.locator('#modal').innerText();
 assert.match(courseDialog,/中文：会显示/);assert.match(courseDialog,/越南语：不会显示/);
 await page.click('#modal [data-answer="ok"]');await page.waitForTimeout(400);
 assert.equal(recordByName('courses','表单验收课程').status,'published');
 console.log('新课程表单：分类、封面、专家拖动、课程信息、片段首帧、附件语言、发布：通过');

 // —— 专家表单里的只读授课课程（E3）——
 await page.click('[data-action="nav:experts"]');
 await page.locator('tr',{hasText:'专家甲'}).getByRole('button',{name:'编辑'}).click();
 await page.waitForTimeout(500);
 const relation=await page.locator('.editor-relation').innerText();
 assert.match(relation,/表单验收课程/,'专家表单要自动列出他参与的课程');
 await page.locator('.editor-relation').getByRole('button',{name:'打开'}).click();
 await page.waitForTimeout(400);
 assert.match(await page.locator('main h1').first().innerText(),/表单验收课程/);
 console.log('专家表单只读“授课课程”并可打开：通过');

 // —— 离开时才提示未保存（G9）——
 await page.fill('[data-lang="goals"]','临时改一下');
 await page.click('[data-action="back"]');
 await page.waitForSelector('dialog[open]',{timeout:5000});
 assert.match(await page.locator('#modal').innerText(),/有尚未保存的修改/);
 await page.screenshot({path:path.join(shots,'05-离开提示.png')});
 await page.click('#modal [data-answer="cancel"]');
 console.log('切换语言不提示、离开编辑页才提示未保存：通过');

 const width=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
 assert.ok(width.sw<=width.iw,'1366 宽不应横向滚动');
 assert.deepEqual(errors,[],'页面不应出现脚本错误');
 console.log('\n第 3 步后台表单全部验证通过');
}catch(error){console.error(error);process.exitCode=1}
finally{
 if(browser)await browser.close().catch(()=>{});
 server.kill();
 fs.rmSync(temp,{recursive:true,force:true});
 process.exit(process.exitCode||0);
}})();
