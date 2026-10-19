const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {render}=require('../views.cjs');
const publicRoot=path.join(__dirname,'..','public');
const zh={id:'course-language-test',name:'中文课程',intro:'中文简介',category:'分类',cover:'/cover-zh.png',languages:{zh:true,en:false,vi:false},translations:{}};
const db={courses:[zh],teachers:[],qualifications:[]};
const cn=render('zh','courses',null,db,publicRoot).body,en=render('en','courses',null,db,publicRoot).body;
assert.match(cn,/中文课程/);assert.doesNotMatch(en,/中文课程/);
console.log('前台语言隔离验证通过');
