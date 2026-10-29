const assert=require('assert/strict'),child=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
// 第 2 步验收（M1、M3–M6、M8–M10）：上传类型/大小校验、宽高时长记录、清理没用的文件、备份不打包没用的文件
// 全程使用临时数据目录，不读写真实 data；退出时（包括断言失败）删除临时文件夹
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-upload-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
const media=require('../媒体信息.cjs'),core=require('../后台服务.cjs');
const fixture=fs.readFileSync(path.join(__dirname,'素材','测试视频.mp4'));
const MB=1024*1024;

// —— 真实文件识别（M5、M6）——
const videoInfo=media.inspect('片段.mp4',fixture);
assert.equal(videoInfo.kind,'video');assert.equal(videoInfo.width,160);assert.equal(videoInfo.height,90);assert.ok(videoInfo.duration>0.4&&videoInfo.duration<1,'时长约 0.6 秒，实际 '+videoInfo.duration);
assert.throws(()=>media.inspect('假的.mp4',Buffer.from('not a video')),/MP4/,'改了后缀名的非视频文件要拒收');
assert.throws(()=>media.inspect('缺moov.mp4',Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0])),/完整的 MP4/);
assert.throws(()=>media.inspect('照片.heic',Buffer.from('whatever')),/HEIC/,'HEIC 提示先转 JPG');
const heicBytes=Buffer.concat([Buffer.from([0,0,0,24,102,116,121,112]),Buffer.from('heic'),Buffer.alloc(32)]);
assert.throws(()=>media.inspect('改了名字.jpg',heicBytes),/HEIC/,'苹果照片改了扩展名也要认出来');
assert.throws(()=>media.inspect('假的.jpg',Buffer.from('not an image')),/有效的图片/);
assert.throws(()=>media.inspect('假的.pdf',Buffer.from('not a pdf')),/PDF/);
console.log('真实文件识别、HEIC 与假视频拒收：通过');

// —— 图片尺寸从文件头读取（M3）——
function pngOf(width,height){const head=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(head,0);head.writeUInt32BE(13,8);head.write('IHDR',12,'latin1');head.writeUInt32BE(width,16);head.writeUInt32BE(height,20);return head}
function jpegOf(width,height){const head=Buffer.from([0xff,0xd8,0xff,0xc0,0,17,8,0,0,0,0,0,0,0,0,0,0,0,0]);head.writeUInt16BE(height,7);head.writeUInt16BE(width,9);return head}
let info=media.inspect('照片.png',pngOf(3000,4000));
assert.deepEqual([info.width,info.height],[3000,4000]);
info=media.inspect('照片.jpg',jpegOf(3000,4000));
assert.deepEqual([info.width,info.height],[3000,4000]);
console.log('图片宽高读取：通过');

// —— 大小上限（M5、M6、M8）——
assert.throws(()=>core.file('大图.png',Buffer.concat([pngOf(1,1),Buffer.alloc(21*MB,1)])),/20MB/);
assert.throws(()=>core.file('大视频.mp4',Buffer.concat([fixture,Buffer.alloc(50*MB,1)])),/50MB/);
const bigPdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(31*MB,0x20)]);
assert.throws(()=>core.file('大附件.pdf',bigPdf),/30MB/);
console.log('图片 20MB、视频 50MB、附件 30MB 上限：通过');

// —— 保存上传记录，带宽高时长 ——
core.initialize('admin','1234567890');
const cover=core.file('封面.png',pngOf(3000,4000));
assert.ok(cover.id&&cover.width===3000&&cover.height===4000&&cover.size>0);
const clip=core.file('片段.mp4',fixture);
assert.ok(clip.duration>0&&clip.width===160,'上传记录要带视频时长和分辨率');

// 草稿引用 cover；已发布课程引用 clip 和另一张封面
const draftExpert=core.saveRecord({type:'experts',draft:{shared:{image:cover},zh:{name:'草稿专家',identity:'顾问',tagline:'一句话'}}});
assert.equal(draftExpert.draft.vi.image.id,cover.id);assert.equal(draftExpert.draft.en.image.id,cover.id,'照片三语共用，只传一次（M1）');
const publishedCover=core.file('课程封面.png',pngOf(1600,900));
const pdf=core.file('课程讲义.pdf',Buffer.from('%PDF-1.4\n% 测试讲义\n'));
assert.equal(pdf.kind,'attachment');
assert.ok(core.file('课程讲义.docx',Buffer.from([0x50,0x4b,0x03,0x04,0x14,0,0,0])).kind==='attachment','DOCX 按 ZIP 头识别');
const course=core.saveRecord({type:'courses',experts:[draftExpert.id],draft:{shared:{category:'cat-aigc',image:publishedCover,clips:[{video:clip,cover:null,duration:0}],attachments:[{file:pdf,langs:['zh']}]},zh:{name:'上传验收课',goals:'目标',description:'介绍',audience:'零基础',outline:['第一章']}}});
assert.ok(course.draft.shared.clips[0].duration>0,'旧片段没记时长时，保存要自动读视频补上');
core.publish(course.id);
assert.equal(course.draft.zh.attachments[0].id,pdf.id);
assert.equal(course.draft.vi.attachments.length,0,'附件只出现在勾选的语言（M8）');
console.log('上传记录宽高时长：通过');

// —— 清理（M10）：没引用且超过 24 小时才删；引用中的、刚传的都保留 ——
const unusedOld=core.file('旧的.jpg',jpegOf(800,800));
const unusedNew=core.file('刚传的.jpg',jpegOf(800,800));
const old=Date.now()/1000-25*60*60;
fs.utimesSync(core.filePath(unusedOld.id),old,old);
const stalePart=path.join(temp,'uploads','.tmp','中断的上传.part');
fs.writeFileSync(stalePart,'x');fs.utimesSync(stalePart,old,old);
const cleaned=core.cleanupUploads();
assert.ok(cleaned.removed.includes(unusedOld.id),'没人用且超过 24 小时的文件要删');
assert.ok(!cleaned.removed.includes(unusedNew.id),'刚上传 1 小时内的文件要保留');
assert.ok(!cleaned.removed.includes(cover.id)&&!cleaned.removed.includes(clip.id)&&!cleaned.removed.includes(publishedCover.id),'被草稿或发布版引用的文件要保留');
assert.ok(fs.existsSync(core.filePath(unusedNew.id))&&fs.existsSync(core.filePath(cover.id))&&!fs.existsSync(core.filePath(unusedOld.id)));
assert.ok(!fs.existsSync(stalePart),'中断上传留下的临时文件也要清理');
console.log('清理没用的上传文件（M10）：通过');

// —— 备份只打包被引用的文件（M10）——
const backupDir=core.backup();
const backed=fs.readdirSync(path.join(backupDir,'uploads')).sort(),referenced=[cover.id,clip.id,publishedCover.id,pdf.id].sort();
assert.deepEqual(backed.filter(x=>!x.startsWith('.')),referenced,'备份只包含草稿和发布版引用的文件');
assert.ok(!backed.includes(unusedNew.id),'没被引用的文件不进备份');
console.log('备份不打包没用到的上传：通过');

// —— 接口：流式上传（M9）、超限立刻拒收、没有残留临时文件 ——
const startupOld=core.file('启动时该删.jpg',jpegOf(800,800));fs.utimesSync(core.filePath(startupOld.id),old,old);
const port=5400+Math.floor(Math.random()*200);
const env={...process.env,ADMIN_DATA_DIR:temp,MVP_DATA_DIR:temp,ADMIN_PORT:String(port)};
const server=child.spawn(process.execPath,[path.join(__dirname,'..','后台服务器.js')],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
 let res;
 for(let i=0;i<100;i++){try{res=await fetch(base+'/api/status');break}catch{await sleep(100)}}
 assert.ok(res,'后台服务未启动');
 assert.ok(!fs.existsSync(core.filePath(startupOld.id)),'后台启动时要清理没人用且超过 24 小时的文件（M10）');
 assert.ok(fs.existsSync(core.filePath(cover.id)),'启动清理不能删被草稿或发布版引用的文件');
 res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'admin',password:'1234567890'})});
 const login=await res.json(),cookie=res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const headers={'Content-Type':'video/mp4',cookie,'x-csrf-token':login.csrf,'x-file-name':encodeURIComponent('接口视频.mp4')};
 res=await fetch(base+'/api/upload',{method:'POST',headers,body:fixture});
 assert.equal(res.status,201,'流式上传真实 MP4 应成功');
 const up=(await res.json()).file;
 assert.ok(up.duration>0&&up.width===160&&up.height===90&&up.size===fixture.length,'接口返回的宽高时长大小');
 res=await fetch(base+'/api/upload',{method:'POST',headers,body:Buffer.alloc(51*MB,1)});
 assert.equal(res.status,413);assert.match((await res.json()).error,/不能超过 50MB/);
 res=await fetch(base+'/api/upload',{method:'POST',headers:{...headers,'x-file-name':encodeURIComponent('假的.mp4')},body:Buffer.from('not a video')});
 assert.equal(res.status,400);assert.match((await res.json()).error,/MP4/);
 res=await fetch(base+'/api/upload',{method:'POST',headers:{...headers,'x-file-name':encodeURIComponent('照片.heic')},body:Buffer.from('x')});
 assert.equal(res.status,400);assert.match((await res.json()).error,/HEIC/);
 const leftovers=fs.readdirSync(path.join(temp,'uploads','.tmp'));
 assert.deepEqual(leftovers,[],'上传成功、失败或超限都不能留下临时文件');
 console.log('流式上传接口、50MB 上限、HEIC 与临时文件清理：通过');
 console.log('\n上传、清理与备份全部验证通过');
}finally{server.kill()}})().catch(error=>{console.error(error);server.kill();process.exitCode=1});
