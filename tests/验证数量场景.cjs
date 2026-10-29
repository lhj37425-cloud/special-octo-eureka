const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
// 第 8 步 / 方案 6.2 数量场景（23–32）：空列表、大卡/小卡数量、课程分类、大纲、目标、片段、案例/资质数量
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-quantity-test-'));
process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
const core=require('../后台服务.cjs'),{render}=require('../views.cjs'),home=require('../homepage-trust-production.cjs'),scenarios=require('../business-scenarios.cjs');
const publicRoot=path.join(__dirname,'..','public');
core.initialize('qty-admin','qty-password-123');const owner={role:'owner',name:'主管理员'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg==','base64');const img=n=>core.file(n,png,'image/png');
const teacher=(name,big,order=0)=>({id:name,name,order,bigCard:big,languages:{zh:true,vi:false,en:false},translations:{},identity:'顾问',tagline:'一句话',highlights:[],bio:[],experience:[],photo:'',published:true});
const db=teachers=>({courses:[],teachers,qualifications:[]});
const count=(html,re)=>(html.match(re)||[]).length;

// 23 专家 0 位
assert.match(render('zh','teachers',null,db([]),publicRoot).body,/暂无已上架内容/);
// 24 大卡 1 位、3 位
let html=render('zh','teachers',null,db([teacher('一',true)]),publicRoot).body;
assert.equal(count(html,/<a class="v2-lead2"/g),1);assert.equal(count(html,/v2-lead-grid is-single/g),1);
html=render('zh','teachers',null,db([teacher('一',true),teacher('二',true),teacher('三',true)]),publicRoot).body;
assert.equal(count(html,/<a class="v2-lead2"/g),3);assert.equal(count(html,/v2-lead-grid is-single/g),1,'3 位时最后一张居中');
// 25 小卡 4 位、5 位
assert.doesNotMatch(render('zh','teachers',null,db([1,2,3,4].map(i=>teacher('小'+i,false))),publicRoot).body,/查看全部/);
html=render('zh','teachers',null,db([1,2,3,4,5].map(i=>teacher('小'+i,false))),publicRoot).body;
assert.match(html,/查看全部（共 5 位）/);
console.log('23–25 专家数量场景：通过');

const course=(id,name,category,outline,outcomes,videos)=>({id,name,intro:'介绍',audience:'人',order:1,languages:{zh:true,vi:false,en:false},translations:{},cover:'/assets/course-workshop.png',teacherIds:[],teacherId:'',category,outline,goals:'目标',materials:[],facts:[],outcomes,videos,teacher:''});
// 26 课程 0 门
html=render('zh','courses',null,{courses:[],teachers:[],qualifications:[]},publicRoot).body;
assert.match(html,/暂无已上架内容/);assert.match(html,/企业内部团队培训/);
// 27 分类 1 个 / 2 个
const c1=course('c1','课程一','AIGC 课程',['一'],[],[]),c2=course('c2','课程二','其他课程',['一'],[],[]);
assert.doesNotMatch(render('zh','courses',null,{courses:[c1],teachers:[],qualifications:[]},publicRoot).body,/filter-bar/);
assert.match(render('zh','courses',null,{courses:[c1,c2],teachers:[],qualifications:[]},publicRoot).body,/filter-bar/);
// 28 大纲 1 条 / 9 条
const one=course('one','大纲一','A',['一'],[],[]), nine=course('nine','大纲九','A',Array.from({length:9},(_,i)=>'第'+(i+1)+'章'),[],[]);
assert.doesNotMatch(render('zh','courses','one',{courses:[one],teachers:[],qualifications:[]},publicRoot).body,/v2-outline is-two/);
assert.match(render('zh','courses','nine',{courses:[nine],teachers:[],qualifications:[]},publicRoot).body,/v2-outline is-two/);
// 29 学完你能做到 0/1/3 条
const outcome=(n)=>({...one,id:'o'+n,outcomes:Array.from({length:n},(_,i)=>['标题'+(i+1),'说明'+(i+1)])});
assert.doesNotMatch(render('zh','courses','o0',{courses:[outcome(0)],teachers:[],qualifications:[]},publicRoot).body,/id="course-objectives"/);
assert.match(render('zh','courses','o1',{courses:[outcome(1)],teachers:[],qualifications:[]},publicRoot).body,/v2-goal-grid n1/);
assert.match(render('zh','courses','o3',{courses:[outcome(3)],teachers:[],qualifications:[]},publicRoot).body,/v2-goal-grid n3/);
// 30 片段 0/1/2/7 个
const vids=(n)=>Array.from({length:n},(_,i)=>({title:'片段'+(i+1),name:'片段'+(i+1),url:'/v'+i+'.mp4',poster:'/p.jpg',duration:10}));
const videoCourse=(n)=>({...one,id:'v'+n,videos:vids(n)});
assert.doesNotMatch(render('zh','courses','v0',{courses:[videoCourse(0)],teachers:[],qualifications:[]},publicRoot).body,/id="course-preview"/);
assert.match(render('zh','courses','v1',{courses:[videoCourse(1)],teachers:[],qualifications:[]},publicRoot).body,/v2-preview-one/);
assert.match(render('zh','courses','v2',{courses:[videoCourse(2)],teachers:[],qualifications:[]},publicRoot).body,/v2-clip-grid n2/);
assert.match(render('zh','courses','v7',{courses:[videoCourse(7)],teachers:[],qualifications:[]},publicRoot).body,/v2-clip-grid n3 is-scroll/);
console.log('26–30 课程数量场景：通过');

// 31 案例首页展示 0 个 / 2 个
const caseFields={industry:'行业',description:'简介',problem:'问题',steps:'一\n二',people:'人',deliverables:'成果'};
const cases=[];for(let i=1;i<=3;i++){const r=core.saveRecord({type:'cases',draft:{shared:{image:img('案例'+i+'.png')},zh:{name:'数量案例'+i,...caseFields}}},owner);core.publish(r.id,owner);cases.push(r)}
assert.match(scenarios.render('zh'),/数量案例1/);assert.match(scenarios.render('zh'),/数量案例3/,'未勾首页展示时取前 3 个');
for(const r of cases.slice(1)){const cur=core.read().records.find(x=>x.id===r.id);core.saveRecord({...cur,featured:true},owner)}
const homeHtml=scenarios.render('zh');assert.match(homeHtml,/数量案例2/);assert.match(homeHtml,/数量案例3/);
// 32 资质 3 张 / 4 张
const quals=[];for(let i=1;i<=3;i++){const r=core.saveRecord({type:'qualifications',draft:{shared:{image:img('资质'+i+'.png')},zh:{name:'数量资质'+i,description:'说明'}}},owner);core.publish(r.id,owner);quals.push(r)}
assert.doesNotMatch(home.render('zh'),/查看全部资质/);
const q4=core.saveRecord({type:'qualifications',draft:{shared:{image:img('资质4.png')},zh:{name:'数量资质4',description:'说明'}}},owner);core.publish(q4.id,owner);
assert.match(home.render('zh'),/查看全部资质/);
console.log('31–32 案例/资质数量场景：通过');
console.log('\n第 8 步数量场景（23–32）全部验证通过');
