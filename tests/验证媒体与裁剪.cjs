const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn,spawnSync}=require('child_process');
// 第 2 步验收（M2–M7、M9）：浏览器里裁图、压缩、小图提醒、HEIC 提示、视频信息与首帧、封面、上传进度
// 真实 Chrome + Playwright；临时数据目录；不读写 D:\项目\data
let chromium;
try { ({ chromium } = require('D:/项目/node_modules/playwright')); } catch { console.error('缺少 Playwright：D:/项目/node_modules/playwright'); process.exit(1); }
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(fs.existsSync(chrome),'找不到本机 Chrome：'+chrome);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-media-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const port=5600+Math.floor(Math.random()*300),base='http://127.0.0.1:'+port+'/';
const shots=path.resolve('D:/data网站数据保存/后台改造验收-2026-10-29/第2步');
fs.mkdirSync(shots,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MB=1024*1024;

// 生成 18MB 左右的真实 MP4（1080p、20 秒、H.264 + AAC）
const bigVideo=path.join(temp,'十八兆视频.mp4');
const ffmpeg=spawnSync(process.platform==='win32'?'ffmpeg.exe':'ffmpeg',['-version'],{encoding:'utf8'});
assert.equal(ffmpeg.status,0,'需要本机 ffmpeg 生成测试视频');
spawnSync(process.platform==='win32'?'ffmpeg.exe':'ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30','-f','lavfi','-i','sine=frequency=440','-t','20','-c:v','libx264','-preset','ultrafast','-b:v','6.6M','-c:a','aac','-b:a','128k','-movflags','+faststart',bigVideo],{stdio:'inherit'});
const bigVideoSize=fs.statSync(bigVideo).size;
assert.ok(bigVideoSize>10*MB,'测试视频应大于 10MB，实际 '+(bigVideoSize/MB).toFixed(1)+'MB');
const big60=path.join(temp,'超限视频.mp4');fs.writeFileSync(big60,Buffer.alloc(60*MB,1));
const fakeVideo=path.join(temp,'改了后缀.mp4');fs.writeFileSync(fakeVideo,'这不是视频，只是改了后缀名。');

const core=require('../后台服务.cjs'),media=require('../媒体信息.cjs');
core.initialize('media-admin','media-password-123');
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,ADMIN_PORT:String(port)};
const server=spawn(process.execPath,[path.join(__dirname,'..','后台服务器.js')],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
let browser;
(async()=>{try{
 let ready=false;
 for(let i=0;i<120;i++){try{await fetch(base+'api/status');ready=true;break}catch{await sleep(100)}}
 assert.ok(ready,'后台服务未启动');
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.evaluate(async({account,password})=>{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,password})});if(!r.ok)throw Error(await r.text())},{account:'media-admin',password:'media-password-123'});
 await page.evaluate(async()=>{window.__media=await import('/media.js')});

 const takePrepared=async()=>page.evaluate(async()=>{const r=window.__prepared;const buf=await r.blob.arrayBuffer();const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,i+0x8000));return{size:r.blob.size,width:r.width,height:r.height,warn:r.warn||'',name:r.name,base64:btoa(s)}});
 const startPrep=(preset,fileExpr)=>page.evaluate(({preset,fileExpr})=>{window.__prepared=null;window.__prepError=null;const file=eval(fileExpr);window.__media.prepareImage(file,{preset}).then(r=>window.__prepared=r).catch(e=>window.__prepError=e.message)},{preset,fileExpr});
 const waitPrep=async()=>{await page.waitForFunction(()=>window.__prepared||window.__prepError,null,{timeout:60000});return page.evaluate(()=>({error:window.__prepError}))};

 // —— M2/M3：3000×4000 大照片裁成 1000×1000、≤500KB ——
 const bigSize=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=3000;c.height=4000;const ctx=c.getContext('2d'),data=ctx.createImageData(3000,4000);
  for(let i=0;i<data.data.length;i+=4){const v=(Math.random()*255)|0;data.data[i]=v;data.data[i+1]=(v*7)&255;data.data[i+2]=(v*13)&255;data.data[i+3]=255}
  ctx.putImageData(data,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.85));
  window.__big=new File([blob],'大照片.jpg',{type:'image/jpeg'});return blob.size;
 });
 assert.ok(bigSize>3*MB,'大照片应超过 3MB，实际 '+(bigSize/MB).toFixed(1)+'MB');
 await startPrep('expert','window.__big');
 await page.waitForSelector('dialog[data-media-cropper]');
 assert.equal(await page.locator('[data-crop-warning]').isHidden(),true,'3000×4000 不应提示偏小');
 await page.screenshot({path:path.join(shots,'01-专家照片裁剪.png')});
 await page.click('[data-crop-confirm]');
 assert.equal((await waitPrep()).error,null);
 const big=await takePrepared();
 assert.equal(big.width,1000);assert.equal(big.height,1000);
 assert.ok(big.size<=500*1024,`裁完应不超过 500KB，实际 ${(big.size/1024).toFixed(0)}KB`);
 const bigInfo=media.inspect('输出.jpg',Buffer.from(big.base64,'base64'));
 assert.deepEqual([bigInfo.width,bigInfo.height],[1000,1000],'保存下来的文件确实是 1000×1000');
 console.log(`3000×4000 照片裁成 1000×1000：通过（${(big.size/1024).toFixed(0)}KB）`);

 // —— M4：600×600 小图黄字提醒，不拦 ——
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const x=c.getContext('2d');x.fillStyle='#7aa';x.fillRect(0,0,600,600);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));window.__small=new File([blob],'小照片.jpg',{type:'image/jpeg'})});
 await startPrep('expert','window.__small');
 await page.waitForSelector('dialog[data-media-cropper]');
 const smallWarning=await page.locator('[data-crop-warning]').textContent();
 assert.match(smallWarning,/偏小/,'600×600 应黄字提醒偏小');
 await page.screenshot({path:path.join(shots,'02-小图提醒.png')});
 await page.click('[data-crop-confirm]');
 assert.equal((await waitPrep()).error,null);
 const small=await takePrepared();
 assert.ok(small.warn.includes('偏小'),'提醒要带回给表单');
 assert.equal(small.width,1000);
 console.log('600×600 小图提醒但仍可使用：通过');

 // —— M5：HEIC 提示转 JPG，不上传 ——
 const heicMessage=await page.evaluate(async()=>{const header=new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99,0,0,0,0]);try{await window.__media.prepareImage(new File([header],'苹果照片.heic',{type:'image/heic'}),{preset:'expert'});return''}catch(e){return e.message}});
 assert.match(heicMessage,/HEIC/,'HEIC 要提示先转 JPG');
 assert.equal(await page.locator('dialog[data-media-cropper]').count(),0,'HEIC 不应弹出裁剪框');
 console.log('HEIC 提示先转 JPG：通过');

 // —— M6：18MB 视频的信息、首帧、上传进度 ——
 await page.evaluate(()=>{const i=document.createElement('input');i.type='file';i.id='__file';document.body.appendChild(i)});
 await page.setInputFiles('#__file',bigVideo);
 const meta=await page.evaluate(async()=>window.__media.probeVideo(document.querySelector('#__file').files[0]));
 assert.deepEqual([meta.width,meta.height],[1920,1080]);
 assert.ok(meta.duration>19&&meta.duration<21,'时长应在 20 秒左右，实际 '+meta.duration);
 const frame=await page.evaluate(async()=>{const r=await window.__media.captureFrame(document.querySelector('#__file').files[0],1);const buf=await r.blob.arrayBuffer();const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,i+0x8000));return{size:r.blob.size,width:r.width,height:r.height,time:r.time,base64:btoa(s)}});
 assert.deepEqual([frame.width,frame.height],[1920,1080]);
 fs.writeFileSync(path.join(shots,'03-视频第一帧.jpg'),Buffer.from(frame.base64,'base64'));
 const later=await page.evaluate(async()=>{const r=await window.__media.captureFrame(document.querySelector('#__file').files[0],5);return{time:r.time,size:r.blob.size}});
 assert.ok(later.time>=4.9&&later.time<=5.1,'可以拖到第 5 秒取封面');assert.ok(later.size>0);
 const defaultCover=await page.evaluate(async()=>{const r=await window.__media.prepareVideo(document.querySelector('#__file').files[0]);return{time:r.coverTime,width:r.cover.width,height:r.cover.height,size:r.cover.blob.size}});
 assert.ok(defaultCover.time>=0.95&&defaultCover.time<=1.05,'默认用第 1 秒做封面（M7）');
 assert.deepEqual([defaultCover.width,defaultCover.height],[1920,1080]);assert.ok(defaultCover.size>0);
 await page.evaluate(()=>{window.__events=[];window.__upload=null;window.__uploadError=null;const f=document.querySelector('#__file').files[0];window.__media.uploadMedia(f,{onProgress:p=>window.__events.push(p)}).then(r=>window.__upload=r).catch(e=>window.__uploadError=e.message)});
 await page.waitForFunction(()=>window.__upload||window.__uploadError,null,{timeout:90000});
 const uploaded=await page.evaluate(()=>({file:window.__upload,error:window.__uploadError,events:window.__events}));
 assert.equal(uploaded.error,null);
 assert.ok(uploaded.file.duration>19&&uploaded.file.width===1920&&uploaded.file.height===1080,'上传记录带时长和分辨率');
 assert.equal(uploaded.file.size,bigVideoSize,'上传的就是原文件字节');
 assert.ok(uploaded.events.length>=1&&uploaded.events.at(-1)===100,'要有上传进度，最后到 100%');
 console.log(`18MB 视频：第一帧、时长 ${meta.duration}s、分辨率 1920×1080、上传进度 ${uploaded.events.length} 次：通过`);

 // —— M6/M9：60MB 选文件时就提示；改后缀的非视频文件拒收 ——
 await page.setInputFiles('#__file',big60);
 const tooBig=await page.evaluate(()=>{const r=window.__media.validateMediaFile(document.querySelector('#__file').files[0],'video');return r.ok?null:r.error});
 assert.match(tooBig,/50MB/,'选文件时就应提示超过 50MB');
 await page.setInputFiles('#__file',fakeVideo);
 const fakeProbe=await page.evaluate(async()=>{try{await window.__media.probeVideo(document.querySelector('#__file').files[0]);return''}catch(e){return e.message}});
 assert.match(fakeProbe,/放不了|MP4/,'放了不的视频要给说明');
 const fakeUpload=await page.evaluate(async()=>{const f=document.querySelector('#__file').files[0];try{await window.__media.uploadMedia(f);return''}catch(e){return e.message}});
 assert.match(fakeUpload,/MP4/,'服务端也要拒收改了后缀名的非视频文件');
 console.log('60MB 选文件即提示、假视频拒收：通过');

 // —— M7：另传一张图做封面，裁 16:9 ——
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=2000;c.height=1000;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,2000,1000);g.addColorStop(0,'#123');g.addColorStop(1,'#7ab');x.fillStyle=g;x.fillRect(0,0,2000,1000);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));window.__cover=new File([blob],'封面图.jpg',{type:'image/jpeg'})});
 await startPrep('clip','window.__cover');
 await page.waitForSelector('dialog[data-media-cropper]');
 await page.screenshot({path:path.join(shots,'04-视频封面裁剪.png')});
 await page.click('[data-crop-confirm]');
 assert.equal((await waitPrep()).error,null);
 const cover=await takePrepared();
 assert.deepEqual([cover.width,cover.height],[1600,900],'视频封面按 16:9 存 1600×900');
 console.log('另传图片做视频封面（16:9）：通过');

 // —— M2/M3：案例图 16:10、资质图不裁且长边 2400 ——
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=2000;c.height=1200;const x=c.getContext('2d');x.fillStyle='#246';x.fillRect(0,0,2000,1200);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));window.__case=new File([blob],'案例图.jpg',{type:'image/jpeg'})});
 await startPrep('case','window.__case');
 await page.waitForSelector('dialog[data-media-cropper]');
 await page.click('[data-crop-confirm]');
 assert.equal((await waitPrep()).error,null);
 const caseImage=await takePrepared();
 assert.deepEqual([caseImage.width,caseImage.height],[1600,1000],'案例图片按 16:10 存 1600×1000');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,3000,2000);g.addColorStop(0,'#f7e9c8');g.addColorStop(1,'#9a7b45');x.fillStyle=g;x.fillRect(0,0,3000,2000);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));window.__qual=new File([blob],'资质图.jpg',{type:'image/jpeg'})});
 await startPrep('qualification','window.__qual');
 await page.waitForSelector('dialog[data-media-cropper]');
 assert.equal(await page.locator('[data-crop-zoom]').isDisabled(),true,'资质图片不裁剪');
 await page.screenshot({path:path.join(shots,'05-资质图片不裁.png')});
 await page.click('[data-crop-confirm]');
 assert.equal((await waitPrep()).error,null);
 const qualification=await takePrepared();
 assert.deepEqual([qualification.width,qualification.height],[2400,1600],'资质图片长边压到 2400，比例不变');
 console.log('案例 16:10、资质不裁（长边 2400）：通过');

 assert.deepEqual(errors,[],'页面不应出现脚本错误');
 console.log('\n浏览器端裁剪、压缩、视频与上传全部验证通过');
}catch(error){console.error(error);process.exitCode=1}
finally{
 if(browser)await browser.close().catch(()=>{});
 server.kill();
 fs.rmSync(temp,{recursive:true,force:true});
 process.exit(process.exitCode||0);
}})();
