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
// 页面固定文字：英文、越南语页面不能出现中文标签或中文标点，越南语不能借用英文标签
const fields=(name,extra={})=>({name,intro:'Intro',audience:'Leads',researchAreas:['Agents','Knowledge'],...extra});
const trilingual={id:'tri-test',teacherId:'tri-teacher',...fields('课程'),languages:{zh:true,en:true,vi:true},translations:{en:fields('Course'),vi:fields('Khóa học')}};
const teacher={id:'tri-teacher',...fields('专家'),languages:{zh:true,en:true,vi:true},translations:{en:fields('Expert'),vi:fields('Chuyên gia')}};
const db3={courses:[trilingual],teachers:[teacher],qualifications:[]};
const strip=html=>html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<a[^>]*\blang="zh[^"]*"[^>]*>[\s\S]*?<\/a>/g,'');
for(const language of ['en','vi'])for(const [type,id] of [['courses',null],['courses','tri-test'],['teachers',null],['teachers','tri-teacher']]){const page=strip(render(language,type,id,db3,publicRoot).body);assert.doesNotMatch(page,/[一-鿿　-〿！-～]/,`${language} ${type} ${id||'列表'} 不应出现中文文字或标点`)}
const viCourse=render('vi','courses','tri-test',db3,publicRoot).body;assert.match(viCourse,/Đối tượng: Leads/);assert.match(viCourse,/Giảng viên: /);assert.match(viCourse,/aria-label="Đường dẫn điều hướng"><a href="\/vi\/">Trang chủ/);assert.doesNotMatch(viCourse,/Audience|Instructor|>Home</);
assert.match(render('en','courses','tri-test',db3,publicRoot).body,/Audience: Leads/);
// 方案第 5 步：旧的所属机构、学历、专业背景、研究方向不再显示（去掉 teacherBackground）
assert.doesNotMatch(render('en','teachers','tri-teacher',db3,publicRoot).body,/Agents, Knowledge|Agents、Knowledge/, '旧的研究方向不应再显示');
console.log('英文、越南语页面固定文字与标点：通过');
