const assert=require('assert/strict'),child=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const root=path.join(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-guard-')),admin=path.join(temp,'admin'),mvp=path.join(temp,'mvp');fs.mkdirSync(mvp,{recursive:true});
process.env.ADMIN_DATA_DIR=admin;process.env.MVP_DATA_DIR=mvp;const core=require('../后台服务.cjs');
// 已创建的内容不能更改类型（否则没有发布权限的账号也能把已发布内容挪到别的栏目）
core.initialize('guard-admin','1234567890');const course=core.saveRecord({type:'courses',draft:{zh:{name:'类型测试',description:'说明',image:null,attachments:[],clips:[]}}});
assert.throws(()=>core.saveRecord({...course,type:'experts'}),/不能更改类型/);
// 导出留言表格时，以 = + - @ 开头的内容要加 ' 防止被 Excel 当成公式
assert.match(fs.readFileSync(path.join(root,'admin-demo','demo.js'),'utf8'),/\/\^\[=\+\\-@\\t\\r\]\/\.test\(s\)\?`'\$\{s\}`/);
const frontPort=5200+Math.floor(Math.random()*100),adminPort=5300+Math.floor(Math.random()*100),front=`http://127.0.0.1:${frontPort}`,back=`http://127.0.0.1:${adminPort}`;
const env={...process.env,ADMIN_DATA_DIR:admin,MVP_DATA_DIR:mvp,PORT:String(frontPort),ADMIN_PORT:String(adminPort)};
const servers=[child.spawn(process.execPath,['server.js'],{cwd:root,env,stdio:'ignore'}),child.spawn(process.execPath,['后台服务器.js'],{cwd:root,env,stdio:'ignore'})];
const wait=async url=>{for(let i=0;i<100;i++){try{return await fetch(url)}catch{await new Promise(resolve=>setTimeout(resolve,100))}}throw Error('服务未启动：'+url)};
const lead=(extra={})=>fetch(front+'/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'测试客户',company:'测试公司',contact:'qa@example.com',service:'training',consent:true,language:'en',message:'你好',...extra})});
(async()=>{try{await wait(front+'/zh/');await wait(back+'/api/status');
 // 留言：只保存表单字段；类型不对返回 400；请求过大返回 413
 let res=await lead({requestId:'req-1',source:'/en/contact/',campaign:{utm_source:'google',other:'x'},extra:'x'.repeat(10000)});assert.equal(res.status,201);
 const saved=JSON.parse(fs.readFileSync(path.join(mvp,'mvp-leads.json'),'utf8'))[0];assert.equal(saved.extra,undefined);assert.deepEqual(saved.campaign,{utm_source:'google'});assert.equal(saved.source,'/en/contact/');assert.equal(saved.name,'测试客户');
 res=await lead({name:123});assert.equal(res.status,400);
 res=await lead({message:'x'.repeat(40*1024)});assert.equal(res.status,413);
 // 频率限制：同一来源 10 分钟内最多新增 5 条；重复提交同一 requestId 不计入
 res=await lead({requestId:'req-1'});assert.equal(res.status,200);
 for(let i=2;i<=5;i++){res=await lead({requestId:`req-${i}`});assert.equal(res.status,201)}
 res=await lead({requestId:'req-6'});assert.equal(res.status,429);assert.match((await res.json()).error,/Too many/);
 console.log('留言字段白名单、类型校验与频率限制：通过');
 // 页面：index.html 跳到目录地址；地址编码错误返回 400
 res=await fetch(front+'/en/index.html?x=1',{redirect:'manual'});assert.equal(res.status,301);assert.equal(res.headers.get('location'),'/en/?x=1');
 res=await fetch(front+'/zh/%E0%A4%A/');assert.equal(res.status,400);
 console.log('index.html 跳转与错误地址：通过');
 // 上传：30MB 以内的视频可以上传，超过 30MB 给出明确提示
 res=await fetch(back+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'guard-admin',password:'1234567890'})});const data=await res.json();
 const h={'Content-Type':'application/json',cookie:res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),'x-csrf-token':data.csrf};
 const upload=size=>fetch(back+'/api/upload',{method:'POST',headers:h,body:JSON.stringify({name:'video.mp4',mime:'video/mp4',base64:Buffer.alloc(size,1).toString('base64')})});
 res=await upload(29*1024*1024);assert.equal(res.status,201);
 res=await upload(31*1024*1024);assert.equal(res.status,400);assert.match((await res.json()).error,/不能超过 30MB/);
 console.log('上传 30MB 上限：通过')}catch(error){console.error(error);process.exitCode=1}finally{for(const s of servers)s.kill();setTimeout(()=>fs.rmSync(temp,{recursive:true,force:true}),300)}})();
