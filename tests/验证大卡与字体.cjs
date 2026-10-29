const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// 第 5 步验收（F6、D12）：3 位大卡最后一张居中、4 位大卡两行各 2 张；网页宋体按片加载
// 真实 Chrome；临时数据；不读写 D:\项目\data
let chromium;
try { ({ chromium } = require('D:/项目/node_modules/playwright')); } catch { console.error('缺少 Playwright'); process.exit(1); }
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-cards-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');
const image=name=>core.file(name,png,'image/png');
const makeExpert=name=>{const r=core.saveRecord({type:'experts',draft:{shared:{bigCard:true,image:image(name+'.png')},zh:{name,identity:'顾问',tagline:'一句话介绍',highlights:['亮点一']}}},owner);core.publish(r.id,owner);return r};
const big=[makeExpert('大卡甲'),makeExpert('大卡乙'),makeExpert('大卡丙')];
for(let i=1;i<=5;i++){const r=core.saveRecord({type:'experts',draft:{shared:{image:image('小卡'+i+'.png')},zh:{name:'小卡'+i,identity:'讲师',tagline:'一句话'}}},owner);core.publish(r.id,owner)}
const port=6700+Math.floor(Math.random()*200),base='http://127.0.0.1:'+port;
const shots=path.resolve('D:/data网站数据保存/后台改造验收-2026-10-29/第5步');fs.mkdirSync(shots,{recursive:true});
const server=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,PORT:String(port)},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
(async()=>{try{
 for(let i=0;i<100;i++){try{await fetch(base+'/zh/');break}catch{await sleep(100)}}
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900}});
 const page=await context.newPage();
 const fontResponses=[];
 page.on('response',async response=>{
  if(!/\/fonts\/[^/]+\.woff2/.test(response.url()))return;
  let size=Number(response.headers()['content-length']||0);
  if(!size){try{size=(await response.body()).length}catch{}}
  fontResponses.push({url:new URL(response.url()).pathname,size});
 });
 await page.goto(base+'/zh/teachers/',{waitUntil:'load'});
 await page.evaluate(()=>document.fonts.ready);
 const single=await page.locator('.v2-lead-grid.is-single').count();assert.equal(single,1,'3 位大卡最后一行居中（F6）');
 const box=await page.locator('.v2-lead-grid.is-single .v2-lead2').first().boundingBox();
 const grid=await page.locator('.v2-lead-grid.is-single').first().boundingBox();
 assert.ok(Math.abs((box.x+box.width/2)-(grid.x+grid.width/2))<6,'单张大卡要水平居中');
 await page.screenshot({path:path.join(shots,'03-大卡3位.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.fonts.check('700 16px "EVOL Serif"','大卡甲')),'页面用上网页宋体');
 assert.ok(fontResponses.length>0,'应下载宋体分片');
 const total=fontResponses.reduce((n,x)=>n+x.size,0);
 console.log(`3 位大卡居中；宋体下载 ${fontResponses.length} 片，共 ${(total/1024).toFixed(0)}KB：${fontResponses.map(x=>x.url.split('/').pop()+' '+Math.round(x.size/1024)+'KB').join('、')}`);

 // 加第 4 位大卡：两行各 2 张，不再居中
 const fourth=makeExpert('大卡丁');
 await page.reload({waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.v2-lead-grid.is-single').count(),0,'4 位大卡两行各 2 张');
 assert.equal(await page.locator('.v2-lead2').count(),4);
 await page.screenshot({path:path.join(shots,'04-大卡4位.png'),fullPage:true});
 console.log('4 位大卡两行各 2 张：通过');

 // D12：常用字里有、原网站字表里没有的字（“阿”）应触发额外字体分片，并用网页宋体显示
 const newChar=core.saveRecord({type:'experts',order:-1,draft:{shared:{image:image('阿福.png')},zh:{name:'阿福',identity:'顾问',tagline:'一句话'}}},owner);core.publish(newChar.id,owner);
 fontResponses.length=0;
 await page.reload({waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.evaluate(()=>document.fonts.check('700 16px "EVOL Serif"','阿福')),'新常用字要用网页宋体');
 assert.ok(fontResponses.some(x=>!x.url.endsWith('-1.woff2')),'新字应触发额外字体分片');
 console.log('原字表没有、常用字里有的字：“阿”触发额外分片并用网页宋体：通过');
}catch(error){console.error(error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});server.kill();fs.rmSync(temp,{recursive:true,force:true});process.exit(process.exitCode||0)}})();
