const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'evoldream-e2e-'));
process.env.ADMIN_DATA_DIR=root;process.env.ADMIN_PORT='4291';process.env.PORT='4292';
const core=require('../后台服务.cjs');core.initialize('tester','test-password-123');
require('../后台服务器.js');require('../server.js');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,options={}){const response=await fetch(url,options);const data=await response.json();assert(response.ok,data.error);return {data,response}}
(async()=>{try{
 await wait(120);
 const login=await request('http://127.0.0.1:4291/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'tester',password:'test-password-123'})});
 const cookies=login.response.headers.get('set-cookie'),session=cookies.match(/admin_session=[^;]+/)[0],csrf=cookies.match(/admin_csrf=[^;]+/)[0],csrfValue=decodeURIComponent(csrf.split('=').slice(1).join('='));
 const headers={'Content-Type':'application/json','Cookie':`${session}; ${csrf}`,'X-CSRF-Token':csrfValue};
 const upload=await request('http://127.0.0.1:4291/api/upload',{method:'POST',headers,body:JSON.stringify({name:'cover.png',mime:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg=='})});
 const routes={
  '资质证书':['certificates','证书资料'],
  '认证文件':['certifications','认证资料'],
  '合作资料':['partnerships','合作资料']
 };
 for(const [category,[route,name]] of Object.entries(routes)){
  const record=await request('http://127.0.0.1:4291/api/records',{method:'POST',headers,body:JSON.stringify({id:`qua-${Math.random().toString(36).slice(2,12)}`,type:'qualifications',category,order:1,revision:0,draft:{zh:{name,org:'测试机构',description:'测试说明',image:upload.data.file,attachments:[]},en:{},vi:{}}})});
  await request(`http://127.0.0.1:4291/api/records/${record.data.record.id}/publish`,{method:'POST',headers});
  const html=await (await fetch(`http://127.0.0.1:4292/zh/qualifications/${route}/`)).text();
  assert(html.includes(name),`${route} 未显示对应资料`);
 }
 const expert=await request('http://127.0.0.1:4291/api/records',{method:'POST',headers,body:JSON.stringify({id:'exp-qaexpert1',type:'experts',order:1,revision:0,draft:{zh:{name:'验收专家',org:'验收机构',description:'专家简介',image:upload.data.file,attachments:[]},en:{},vi:{}}})});
 await request(`http://127.0.0.1:4291/api/records/${expert.data.record.id}/publish`,{method:'POST',headers});
 const video=await request('http://127.0.0.1:4291/api/upload',{method:'POST',headers,body:JSON.stringify({name:'preview.mp4',mime:'video/mp4',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Y6QAAAABJRU5ErkJggg=='})});
 const course=await request('http://127.0.0.1:4291/api/records',{method:'POST',headers,body:JSON.stringify({id:'cou-qacourse1',type:'courses',order:1,experts:[expert.data.record.id],revision:0,draft:{zh:{name:'验收课程',description:'课程简介',audience:'验收对象',outline:'课程大纲',image:upload.data.file,attachments:[],clips:[{title:'验收预览片段',video:video.data.file,cover:upload.data.file}]},en:{},vi:{}}})});
 await request(`http://127.0.0.1:4291/api/records/${course.data.record.id}/publish`,{method:'POST',headers});
 const courseHtml=await (await fetch(`http://127.0.0.1:4292/zh/courses/${course.data.record.id}/`)).text();
 assert(courseHtml.includes('验收课程'),`课程前台页未显示已发布课程：${course.data.record.id} / ${courseHtml.slice(0,300)}`);
 assert(courseHtml.includes(`/zh/teachers/${expert.data.record.id}/`),'课程前台页未关联已发布专家');
 assert(courseHtml.includes(`/admin-media/${video.data.file.id}`),'课程前台页未输出已发布预览视频地址');
 console.log('真实登录、上传、发布、三类资料页面与课程专家关联：通过');
}finally{fs.rmSync(root,{recursive:true,force:true});setTimeout(()=>process.exit(0),20)}})().catch(error=>{console.error(error);fs.rmSync(root,{recursive:true,force:true});process.exit(1)});
