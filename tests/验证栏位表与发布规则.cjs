const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
// 第 1 步验收：栏位表、字数算法、填完/发布判断、双写兼容（K1/K2）、选项设置、排序、删专家联动
// 全程使用临时数据目录，不读写真实 data；退出时（包括断言失败）删除临时文件夹
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-schema-test-'));process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
const schema=require('../内容栏位.cjs'),core=require('../后台服务.cjs');
const owner={id:'usr-owner',name:'主管理员',role:'owner'},editor={id:'usr-e',name:'编辑员',role:'editor',perms:{}};

// —— 字数算法（B3）——
assert.equal(schema.count('AIGC 技术应用与教学实践（教师班）'),17,'方案算例应为 17');
assert.equal(schema.count('Agent 落地'),5,'半角算 ½');
assert.equal(schema.count('e\u0301'),1,'越南语组合声调符号不另算');
console.log('字数算法算例验证通过');

// —— 栏位表结构 ——
assert.deepEqual(Object.keys(schema.TYPES).sort(),[...core.types].sort(),'栏位表四类内容与后台类型一致');
const empty=schema.emptyDraft('courses');
assert.deepEqual(Object.keys(empty.shared),['image','category','experts','factLabels','clips','attachments']);
assert.ok(empty.zh.name===''&&Array.isArray(empty.zh.outcomes)&&empty.vi.name===''&&empty.en.name==='');
console.log('栏位表结构验证通过');

// —— 语言填完判断（C2）——
const miss=schema.langComplete('courses',{});
assert.ok(miss.missing.includes('课程名')&&miss.missing.includes('课程大纲')&&!miss.complete);
const done=schema.langComplete('courses',{name:'课',goals:'目标',description:'介',audience:'人',outline:['一']});
assert.ok(done.complete);
console.log('语言填完判断验证通过');

// —— 超上限检查（B3、D4）——
const over=schema.overLimit('experts',{zh:{name:'郑'.repeat(21),highlights:['亮'.repeat(25)]}});
assert.ok(over.some(x=>x.label==='姓名'&&x.max===20)&&over.some(x=>x.label==='亮点第 1 条'&&x.max===24));
console.log('超上限检查验证通过');

// —— 发布校验（D3、D4、E7）——
core.initialize('admin','1234567890');
let course=core.saveRecord({type:'courses',draft:{}},owner);
let check=schema.publishCheck(core.read().records.find(r=>r.id===course.id));
assert.ok(check.errors.some(x=>x.includes('封面'))&&check.errors.some(x=>x.includes('分类'))&&check.errors.some(x=>x.includes('授课专家'))&&check.errors.some(x=>x.includes('至少把一种语言的必填项填完')));
console.log('发布校验缺项验证通过');

// —— K2 旧数据兼容 + K1 双写（专家）——
const expertOld=core.saveRecord({type:'experts',draft:{zh:{name:'老专家',role:'咨询顾问',description:'老简介',image:{id:'old.png'}}}},owner);
assert.equal(expertOld.draft.zh.identity,'咨询顾问');assert.equal(expertOld.draft.zh.bio,'老简介');
assert.equal(expertOld.draft.zh.role,'咨询顾问','旧栏位一律保留（K1）');assert.equal(expertOld.draft.shared.image.id,'old.png');
assert.throws(()=>core.saveRecord({type:'experts',id:expertOld.id,revision:expertOld.revision,draft:{zh:{highlights:['一','二','三','四']}}},owner),/最多 3 条/,'列表超条数上限直接报错（B4）');
const expert=core.saveRecord({type:'experts',id:expertOld.id,revision:expertOld.revision,draft:{zh:{name:'郑毅',identity:'Agent 落地 · 主讲',tagline:'十年一线落地',bio:'简介',highlights:['带过 30 个项目']},shared:{bigCard:false}}},owner);
console.log('专家旧数据兼容与双写验证通过');

// —— K2 旧数据兼容 + K1 双写（课程）——
const courseOld=core.saveRecord({type:'courses',experts:[expert.id],draft:{zh:{name:'AIGC 课',goals:'会用',description:'介绍',audience:'零基础',outline:['第一章'],category:'AIGC 课程',image:{id:'cover.png'},clips:[{title:'开场',video:{id:'v.mp4'},cover:{id:'c.png'}}],attachments:[{id:'a.pdf',name:'讲义.pdf'}]}}},owner);
assert.ok(courseOld.draft.shared.category,'旧分类名自动登记为选项（K2）');
const catId=courseOld.draft.shared.category;
assert.equal(courseOld.draft.shared.image.id,'cover.png','旧图片推导为共用封面');
assert.deepEqual(courseOld.draft.shared.clips.map(c=>c.video.id),['v.mp4'],'旧片段合并进共用区');
assert.equal(courseOld.draft.zh.clipTitles[0],'开场');
assert.deepEqual(courseOld.draft.shared.attachments[0].langs,['zh'],'旧附件按语言归入共用区');
assert.equal(courseOld.draft.zh.category,'AIGC 课程','双写回旧栏位（K1）');
assert.equal(courseOld.draft.vi.clips[0].video.id,'v.mp4','共用视频对其他语言可见');
console.log('课程旧数据兼容与双写验证通过');

// —— 发布成功 + 三语显示报告 ——
const published=core.publish(courseOld.id,owner);
assert.ok(published.report.languages.zh.show&&published.report.languages.vi.show===false&&published.report.languages.en.show===false);
assert.deepEqual(published.publishedSettings.experts,[expert.id]);
console.log('发布校验通过并返回三语显示报告');

// —— 授课专家规则（B4、E1）——
assert.throws(()=>core.saveRecord({type:'courses',id:courseOld.id,revision:courseOld.revision,experts:['不存在的专家'],draft:{}},owner),/授课专家不存在/);
const c2=core.saveRecord({type:'courses',id:courseOld.id,revision:courseOld.revision,experts:[expert.id],draft:{}},owner);
assert.deepEqual(c2.draft.shared.experts,[expert.id]);
assert.throws(()=>core.saveRecord({type:'courses',draft:{},experts:Array(7).fill(expert.id)},owner),/最多 6 位/);
console.log('授课专家规则验证通过');

// —— 大卡最多 4 位（B4）——
for(let i=0;i<4;i++){const e=core.saveRecord({type:'experts',draft:{zh:{name:'大卡'+i,identity:'顾问',tagline:'一句话'},shared:{bigCard:true}}},owner);core.publish(e.id,owner)}
const fifth=core.saveRecord({type:'experts',draft:{zh:{name:'第五位',identity:'顾问',tagline:'一句话'},shared:{bigCard:true}}},owner);
assert.throws(()=>core.publish(fifth.id,owner),/大卡已有 4 位/);
console.log('大卡最多 4 位验证通过');

// —— 选项设置（4.6、H2）——
assert.throws(()=>core.saveOptions(editor,{courseCategories:[]}),e=>e.status===403,'没有发布权限不能改选项');
const withNew=core.saveOptions(owner,{courseCategories:[...core.listOptions().courseCategories,{zh:'Agent 部署课程'}]});
assert.equal(withNew.courseCategories.length,2,'新增分类不用改代码');
assert.throws(()=>core.saveOptions(owner,{courseCategories:withNew.courseCategories.filter(o=>o.id!==catId)}),/正在被课程使用.*AIGC 课/,'在用分类不能删');
const afterDel=core.saveOptions(owner,{courseCategories:withNew.courseCategories.filter(o=>!o.zh.includes('Agent'))});
assert.equal(afterDel.courseCategories.length,1,'没被使用的可以删');
const disabled=core.saveOptions(owner,{courseCategories:afterDel.courseCategories.map(o=>({...o,disabled:true}))});
assert.throws(()=>core.saveRecord({type:'courses',draft:{zh:{name:'新课'},shared:{category:catId}}},owner),/已停用/,'停用后新课程不能选');
console.log('选项设置验证通过');

// —— 排序（B5、H2）——
assert.throws(()=>core.setOrder(editor,'cases',[]),e=>e.status===403,'没有发布权限不能排序');
const cases=['a','b'].map(()=>core.saveRecord({type:'cases',draft:{zh:{name:'案例',industry:'业',description:'介',problem:'题',steps:'步',people:'人',deliverables:'果'},shared:{image:{id:'i.png'}}}},owner));
const orderIds=core.setOrder(owner,'cases',cases.map(c=>c.id).reverse()).map(x=>x.id);
assert.deepEqual(orderIds,[...cases.map(c=>c.id)].reverse(),'顺序直接写进 order');
assert.throws(()=>core.setOrder(owner,'cases',[cases[0].id]),/不一致/,'提交顺序必须完整');
console.log('排序验证通过');

// —— 删专家联动（E6）——
const victim=core.saveRecord({type:'experts',draft:{zh:{name:'要删的',identity:'顾问',tagline:'一句话'}}},owner);
core.saveRecord({type:'courses',id:courseOld.id,revision:c2.revision,experts:[victim.id],draft:{}},owner);
core.publish(courseOld.id,owner);
core.remove(victim.id,owner);
const after=core.read().records.find(r=>r.id===courseOld.id);
assert.deepEqual(after.experts,[],'删除专家后从课程授课名单去掉（E6）');
assert.deepEqual(after.draft.shared.experts,[]);
assert.deepEqual(after.publishedSettings.experts,[]);
console.log('删除专家联动验证通过');

// —— 栏位表只收认识的键（B1）——
const strict=core.saveRecord({type:'qualifications',draft:{zh:{name:'资质',description:'说明',hack:'注入'},shared:{image:{id:'q.png'}}}},owner);
assert.equal(strict.draft.zh.hack,undefined,'栏位表和旧栏位以外的键丢弃');
console.log('未知键丢弃验证通过');

console.log('\n栏位表与发布规则全部验证通过');
