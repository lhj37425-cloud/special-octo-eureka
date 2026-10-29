const assert=require('assert/strict'),child=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const root=path.join(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-snapshot-')),admin=path.join(temp,'admin'),mvp=path.join(temp,'mvp'),port=5000+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
process.env.ADMIN_DATA_DIR=admin;process.env.MVP_DATA_DIR=mvp;const corePath=path.join(root,'后台服务.cjs');delete require.cache[require.resolve(corePath)];const core=require(corePath);
core.initialize('test-admin','1234567890');const png=name=>core.file(name,Buffer.from([137,80,78,71,13,10,26,10]),'image/png');
const expert=name=>{const r=core.saveRecord({type:'experts',draft:{zh:{name,identity:'主讲',tagline:'一句话',description:'专家简介',image:png(`${name}.png`),attachments:[],clips:[]}}});core.publish(r.id);return r.id};
const first=expert('快照专家甲'),second=expert('快照专家乙');
let course=core.saveRecord({type:'courses',order:1,experts:[first],draft:{shared:{category:'cat-aigc'},zh:{name:'快照课程',goals:'目标',description:'课程简介',audience:'零基础',outline:['第一章'],image:png('课程.png'),attachments:[],clips:[]}}});course=core.publish(course.id);
const server=child.spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ADMIN_DATA_DIR:admin,MVP_DATA_DIR:mvp,PORT:String(port)},stdio:'ignore'});
const wait=async()=>{for(let i=0;i<100;i++){try{return await fetch(base+'/zh/')}catch{await new Promise(resolve=>setTimeout(resolve,100))}}throw Error('前台未启动')};
const teacherLink=async()=>((await (await fetch(base+`/zh/courses/${course.id}/`)).text()).match(/href="\/zh\/teachers\/(exp-[^/"]+)\/"/)||[])[1];
(async()=>{try{await wait();assert.equal(await teacherLink(),first);
// 只保存草稿：改关联专家和排序，前台仍按发布时的快照显示
course=core.saveRecord({...course,experts:[second],order:99});assert.equal(await teacherLink(),first,'未发布的关联专家修改不应出现在前台');
course=core.publish(course.id);assert.equal(await teacherLink(),second,'发布后前台应显示新的关联专家');
console.log('前台只使用发布快照中的排序与关联专家：通过');
// 数据文件损坏时必须报错，不能当成空后台被重新初始化
const stateFile=path.join(admin,'state.json'),broken='{"users":[{"account":"test-admin"';fs.writeFileSync(stateFile,broken);
assert.throws(()=>core.read(),/state\.json/);assert.throws(()=>core.initialize('intruder','1234567890'),/state\.json/);assert.throws(()=>core.login('test-admin','1234567890'),/state\.json/);
assert.equal(fs.readFileSync(stateFile,'utf8'),broken,'损坏的数据文件不应被覆盖');
const page=await fetch(base+'/zh/courses/');assert.equal(page.status,500);
console.log('数据文件损坏时拒绝初始化且不覆盖原文件：通过')}catch(error){console.error(error);process.exitCode=1}finally{server.kill();fs.rmSync(temp,{recursive:true,force:true})}})();
