const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {render}=require('../views.cjs');
const publicRoot=path.join(__dirname,'..','public');
const zh={id:'course-language-test',name:'中文课程',intro:'中文简介',category:'分类',cover:'/cover-zh.png',languages:{zh:true,en:false,vi:false},translations:{}};
const db={courses:[zh],teachers:[],qualifications:[]};
const cn=render('zh','courses',null,db,publicRoot).body,en=render('en','courses',null,db,publicRoot).body;
assert.match(cn,/中文课程/);assert.doesNotMatch(en,/中文课程/);
// 英文页面只显示英文填写的内容：英文没填的大纲、职务不能用中文补上
const both={id:'both-test',name:'中文名',intro:'中文简介',role:'中文职务',outline:['中文大纲'],languages:{zh:true,en:true,vi:false},translations:{en:{name:'English name',intro:'English intro',role:'',outline:[]}}};
const db2={courses:[both],teachers:[both],qualifications:[]};
for(const type of ['courses','teachers']){const page=render('en',type,'both-test',db2,publicRoot).body;assert.match(page,/English name/);assert.doesNotMatch(page,/中文职务|中文大纲|中文简介/)}
// 语言切换：列表页和详情页切到同一页面的其他语言；该语言没有内容时切到列表页
const list=render('zh','courses',null,db2,publicRoot).body;assert.match(list,/href="\/en\/courses\/" lang="en"/);assert.match(list,/https:\/\/www\.evoldream\.tech\/vi\/courses\/"/);
const detail=render('zh','courses','both-test',db2,publicRoot).body;assert.match(detail,/href="\/en\/courses\/both-test\/" lang="en"/);assert.match(detail,/href="\/vi\/courses\/" lang="vi"/);
console.log('前台语言隔离、三语字段与语言切换验证通过');
