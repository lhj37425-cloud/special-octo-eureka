const assert=require('assert/strict'),path=require('path');
const {render}=require('../views.cjs'),publicRoot=path.join(__dirname,'..','public');
const course={id:'course-fixed-id',name:'中文课程',intro:'课程简介',cover:'/cover.png',teacherId:'expert-fixed-id',languages:{zh:true,en:true,vi:false},translations:{en:{name:'English course',intro:'English introduction',cover:'/cover-en.png'}}};
const expert={id:'expert-fixed-id',name:'中文专家',intro:'专家简介',photo:'/expert.png',languages:{zh:true,en:false,vi:false},translations:{}};
const db={courses:[course],teachers:[expert],qualifications:[]};
const zh=render('zh','courses',course.id,db,publicRoot).body,en=render('en','courses',course.id,db,publicRoot).body;
assert.match(zh,/href="\/zh\/teachers\/expert-fixed-id\//);assert.doesNotMatch(en,/href="\/en\/teachers\/expert-fixed-id\//);console.log('课程专家固定 ID 与语言失效链接验证通过');
