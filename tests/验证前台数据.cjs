const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
// 第 5 步验收：前台只读后台发布快照（A2、A3、A4、C2、C3、C9、C10、E2、E3、E4、F3、F4、F5、F6）
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-front-data-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
const core=require('../后台服务.cjs'),frontData=require('../前台数据.cjs'),schema=require('../内容栏位.cjs'),{render}=require('../views.cjs'),casePages=require('../cases.cjs');
const publicRoot=path.join(__dirname,'..','public');
core.initialize('front-admin','front-password-123');const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');
const image=name=>core.file(name,png,'image/png');
const videoFile=core.file('片段.mp4',fs.readFileSync(path.join(__dirname,'素材','测试视频.mp4')));
const pdf=core.file('讲义.pdf',Buffer.from('%PDF-1.4\n% test\n'));
const expert=(name,{big=false,vi=false}={})=>{
 const draft={shared:{bigCard:big,image:image(name+'.png')},zh:{name,identity:'顾问',tagline:'一句话介绍',highlights:['亮点一'],bio:'第一段\n\n第二段',experience:['经历一']}};
 if(vi)draft.vi={name:name+' VI',identity:'Cố vấn',tagline:'Một câu',highlights:[],bio:'',experience:[]};
 const r=core.saveRecord({type:'experts',draft},owner);core.publish(r.id,owner);return r;
};
const big1=expert('大卡一',{big:true}),big2=expert('大卡二',{big:true}),big3=expert('大卡三',{big:true});
const viExpert=expert('越语专家',{vi:true});
const small=[viExpert];for(let i=1;i<=4;i++)small.push(expert('小卡'+i));
// 课程：中文完整，越南语也完整；两位授课专家（大卡一、越语专家），片段中越各一个标题，附件只中文
const course=core.saveRecord({type:'courses',experts:[big1.id,viExpert.id],draft:{
 shared:{category:'cat-aigc',image:image('课程封面.png'),factLabels:['fact-hours','fact-format'],clips:[{video:videoFile,cover:image('片段封面.png'),duration:5}],attachments:[{file:pdf,langs:['zh']}]},
 zh:{name:'前台验收课程',goals:'学完能独立落地',description:'课程介绍正文',audience:'零基础',outline:['第一章','第二章'],factValues:['54 课时','线上直播'],outcomes:[{title:'能独立落地',text:'完成一个真实任务'}],clipTitles:['中文片段'],attachmentNames:['中文讲义']},
 vi:{name:'Khóa kiểm thử',goals:'Tự tin triển khai',description:'Giới thiệu khóa học',audience:'Người mới',outline:['Chương một','Chương hai'],factValues:['54 giờ','Trực tuyến'],outcomes:[{title:'Tự triển khai',text:'Hoàn thành một nhiệm vụ'}],clipTitles:['Đoạn tiếng Việt'],attachmentNames:['Tài liệu']}
}},owner);core.publish(course.id,owner);
// 案例：两条中文，其中一条有越南语；资质：四条，前两条首页展示
const caseFields={industry:'制造业',description:'案例简介',problem:'业务问题',steps:'第一步\n第二步',people:'甲、乙',deliverables:'成果一\n成果二'};
const c1=core.saveRecord({type:'cases',draft:{shared:{image:image('案例一.png')},zh:{name:'案例一',...caseFields},vi:{name:'Tình huống một',industry:'Sản xuất',description:'Mô tả',problem:'Vấn đề',steps:'Bước một\nBước hai',people:'A, B',deliverables:'Kết quả một'}}},owner);core.publish(c1.id,owner);
const c2=core.saveRecord({type:'cases',draft:{shared:{image:image('案例二.png')},zh:{name:'案例二',...caseFields}}},owner);core.publish(c2.id,owner);
const quals=[];for(let i=1;i<=4;i++){const q=core.saveRecord({type:'qualifications',draft:{shared:{image:image('资质'+i+'.png')},zh:{name:'资质'+i,description:'说明'+i}}},owner);core.publish(q.id,owner);quals.push(q)}
for(const q of [quals[1],quals[0]]){const cur=core.read().records.find(x=>x.id===q.id);core.saveRecord({...cur,featured:true},owner)}

// —— 语言隔离、大卡/小卡、顺序 ——
const data=frontData.content();
assert.equal(data.teachers.length,8);
assert.ok(data.teachers.find(t=>t.name==='越语专家').languages.vi,'越南语填完的专家在越南语可见');
assert.equal(data.teachers.find(t=>t.name==='大卡一').languages.vi,false,'没填越南语的专家不在越南语显示（C2）');
const zhTeachers=render('zh','teachers',null,data,publicRoot).body;
const viTeachers=render('vi','teachers',null,data,publicRoot).body;
assert.match(zhTeachers,/大卡一/);assert.doesNotMatch(viTeachers,/大卡一/,'越南语专家页不显示只有中文的专家（E4）');
assert.match(viTeachers,/越语专家 VI/,'越南语只显示本地语言内容');
assert.equal((zhTeachers.match(/v2-lead-grid/g)||[]).length,2,'3 位大卡分两行（F3）');
assert.match(zhTeachers,/v2-lead-grid is-single/,'大卡单数时最后一行居中（F6）');
assert.match(zhTeachers,/查看全部（共 5 位）/,'5 位小卡出现查看全部');
console.log('专家大卡/小卡、语言隔离、单数居中、查看全部：通过');

// —— 课程：授课专家顺序、课程信息、学完你能做到、片段标题/时长、附件语言 ——
const viCourse=render('vi','courses',course.id,data,publicRoot).body;
assert.match(viCourse,/Khóa kiểm thử/);
assert.match(viCourse,/54 giờ/);assert.match(viCourse,/Trực tuyến/,'课程信息名称和内容都来自后台选项');
assert.match(viCourse,/Tự triển khai/);assert.match(viCourse,/Hoàn thành một nhiệm vụ/,'学完你能做到来自后台');
assert.match(viCourse,/Đoạn tiếng Việt/);assert.match(viCourse,/0:05/,'片段时长来自上传记录');
assert.doesNotMatch(viCourse,/中文片段|中文讲义|课程介绍正文|第一章/,'越南语页面不混中文（C9）');
const zhCourse=render('zh','courses',course.id,data,publicRoot).body;
assert.match(zhCourse,/中文片段/);assert.match(zhCourse,/中文讲义/);assert.match(zhCourse,/能独立落地/);
assert.match(zhCourse,/大卡一/);assert.match(zhCourse,/越语专家/);
const courseList=render('zh','courses',null,data,publicRoot).body;
assert.match(courseList,/大卡一/,'课程卡显示主讲（E2）');
console.log('课程信息、学完你能做到、片段时长、附件语言、授课专家：通过');

// —— 案例编号、语言隔离；资质首页展示顺序 ——
const zhCases=frontData.cases('zh'),viCases=frontData.cases('vi');
assert.equal(zhCases.length,2);assert.deepEqual(zhCases.map(c=>c.no),['01','02'],'案例编号跟着顺序（F5）');
assert.equal(viCases.length,1);assert.equal(viCases[0].no,'01');assert.match(casePages.render('vi',null,publicRoot).body,/Tình huống một/);
const viCaseList=casePages.render('vi',null,publicRoot).body;assert.doesNotMatch(viCaseList,/案例二/,'越南语没填的案例不显示');
const qs=frontData.qualifications('zh');assert.equal(qs.length,4);assert.deepEqual(new Set(qs.slice(0,2).map(x=>x[0])),new Set(['资质1','资质2']),'首页展示的排在前面（F4）');
console.log('案例编号与语言隔离、资质首页顺序：通过');

// —— 4 位大卡时两行各 2 张，不再居中；旧记录没有共用区也能显示（K2） ——
const big4=expert('大卡四',{big:true});
const data4=frontData.content();const page4=render('zh','teachers',null,data4,publicRoot).body;
assert.doesNotMatch(page4,/v2-lead-grid is-single/,'4 位大卡两行各 2 张');
const legacy={type:'courses',published:{zh:{name:'旧课程',description:'旧简介',goals:'旧目标',audience:'旧对象',outline:'第一章\n第二章',category:'AIGC 课程',image:{id:'old.png'},clips:[{title:'旧片段',video:{id:'old.mp4'},cover:null}],attachments:[]},vi:{},en:{}},publishedSettings:{order:9,experts:[]},order:9};
const legacyDraft=frontData.normalize(legacy);
assert.equal(legacyDraft.shared.image.id,'old.png');assert.equal(legacyDraft.shared.clips[0].video.id,'old.mp4');
assert.equal(frontData.languageComplete(legacy,legacyDraft,'zh'),true,'旧课程用旧栏位也能显示');
console.log('4 位大卡排版、旧记录兼容（K2）：通过');

// —— A3：前台代码不再引用 team.cjs / course-extra.cjs ——
for(const file of ['server.js','views.cjs','course-detail.cjs','cases.cjs','homepage-trust-production.cjs','business-scenarios.cjs']){
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 assert.doesNotMatch(source,/require\(['"]\.\/team\.cjs['"]\)|require\(['"]\.\/course-extra\.cjs['"]\)/,`${file} 仍引用旧资料文件`);
}
console.log('前台代码不再引用 team.cjs / course-extra.cjs（A3）：通过');

// —— D12：字表外的字在发布检查里提醒 ——
const rare=core.saveRecord({type:'experts',draft:{zh:{name:'龘专家',identity:'顾问',tagline:'一句话'}}},owner);
const rareCheck=schema.publishCheck(core.read().records.find(r=>r.id===rare.id));
assert.ok(rareCheck.warnings.some(x=>x.includes('龘')),'姓名里的字表外字要提醒');
assert.ok(!rareCheck.warnings.some(x=>x.includes('专')),'常用字不应提醒');
console.log('网页宋体字表外字提醒（D12）：通过');
console.log('\n第 5 步前台数据全部验证通过');
