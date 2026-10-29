const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'evoldream-admin-test-'));
process.env.ADMIN_DATA_DIR=root;process.env.MVP_DATA_DIR=root;
const core=require('../后台服务.cjs');
const {render}=require('../homepage-trust-production.cjs');
try{
 core.initialize('tester','test-password-123');
 const image={id:'cover.png',name:'封面.png'};
 const make=n=>core.saveRecord({type:'qualifications',revision:0,draft:{zh:{name:`资质${n}`,description:'测试说明',image,attachments:[]},en:{},vi:{}}});
 // 资质发布需要名称、简介和资质图片
 const empty=core.saveRecord({type:'qualifications',revision:0,draft:{zh:{name:'只有名称',attachments:[]},en:{},vi:{}}});
 assert.throws(()=>core.publish(empty.id),/资质图片[\s\S]*简短说明/);
 const ids=[1,2,3,4,5].map(n=>{const r=make(n);core.publish(r.id);return r.id});
 assert.equal(core.list(true).length,5);
 // 首页展示最多 3 张，未发布的不能设为首页展示
 assert.throws(()=>core.saveRecord({...core.list().find(r=>r.id===empty.id),featured:true}),/请先发布/);
 for(const id of ids.slice(2))core.saveRecord({...core.list().find(r=>r.id===id),featured:true});
 assert.throws(()=>core.saveRecord({...core.list().find(r=>r.id===ids[0]),featured:true}),/最多展示 3 张/);
 // 首页：勾选的 3 张排在最前，共 5 项
 let html=render('zh');
 const titles=[...html.matchAll(/<h3>(资质\d)<\/h3>/g)].map(m=>m[1]);
 assert.deepEqual(new Set(titles.slice(0,3)),new Set(['资质3','资质4','资质5']));
 assert.equal(titles.length,5);assert(html.includes('共 5 项'));
 // 只保存草稿不影响前台；下架后取消首页展示并从前台消失
 const original=core.list().find(r=>r.id===ids[4]);
 core.saveRecord({...original,draft:{...original.draft,zh:{...original.draft.zh,description:'只保存为草稿的修改'}}});
 assert.equal(core.list(true).find(x=>x.id===original.id).published.zh.description,'测试说明');
 core.offline(original.id);
 assert(!core.list(true).some(x=>x.id===original.id));
 assert.equal(core.list().find(x=>x.id===original.id).featured,false);
 assert(render('zh').includes('共 4 项'));
 console.log('资质发布必填、首页展示 3 张、发布快照、草稿隔离与下架：通过');
}finally{fs.rmSync(root,{recursive:true,force:true})}
