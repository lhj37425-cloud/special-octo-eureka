const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'evoldream-cases-test-'));
process.env.ADMIN_DATA_DIR=root;process.env.MVP_DATA_DIR=root;
const core=require('../后台服务.cjs');
const cases=require('../cases.cjs'),home=require('../business-scenarios.cjs');
const publicRoot=path.join(__dirname,'..','public');
try{
 core.initialize('tester','test-password-123');
 const image={id:'case.webp',name:'case.webp'};
 const full=n=>({name:`案例${n}`,industry:`行业${n}`,description:`简介${n}`,problem:'问题',steps:'第一步\n第二步',people:'分工',deliverables:'成果一\n成果二\n成果三\n成果四',highlight:'',evaluation:'',image,attachments:[],clips:[]});
 // 必填项不全不能发布
 const half=core.saveRecord({type:'cases',revision:0,draft:{zh:{name:'只有标题',attachments:[],clips:[]},en:{},vi:{}}});
 assert.throws(()=>core.publish(half.id),/行业.*简介.*案例图片.*业务问题.*应用方式.*人员分工.*交付成果/);
 core.remove(half.id);
 // 新案例自动获得网址和顺序编号
 const ids=[1,2,3,4].map(n=>{const r=core.saveRecord({type:'cases',revision:0,draft:{zh:full(n),en:{},vi:{}}});core.publish(r.id);return r.id});
 const recs=core.list().filter(r=>r.type==='cases');
 assert.deepEqual(recs.map(r=>r.order),[1,2,3,4]);
 assert(recs.every(r=>r.slug===r.id));
 // 列表页、详情页读取后台已发布案例；只有中文的案例不出现在英文页面
 let list=cases.render('zh',undefined,publicRoot);assert.equal(list.status,200);assert(list.body.includes('案例4'));
 const detail=cases.render('zh',recs[1].slug,publicRoot);assert.equal(detail.status,200);assert(detail.body.includes('第二步'));assert(!detail.body.includes('case-hero2-quote'));
 assert(!cases.render('en',undefined,publicRoot).body.includes('案例1'));
 assert.equal(cases.render('en',recs[0].slug,publicRoot).status,404);
 // 首页：未勾选时显示前 3 个；勾选后显示勾选的；最多 3 个；交付成果最多显示 3 项
 let h=home.render('zh');assert(h.includes('案例1')&&h.includes('案例3')&&!h.includes('案例4'));assert(h.includes('4 个行业应用案例'));assert(!h.includes('成果四'));
 core.saveRecord({...core.list().find(r=>r.id===ids[3]),featured:true});
 h=home.render('zh');assert(h.includes('案例4')&&!h.includes('案例1'));
 for(const id of ids.slice(0,2))core.saveRecord({...core.list().find(r=>r.id===id),featured:true});
 assert.throws(()=>core.saveRecord({...core.list().find(r=>r.id===ids[2]),featured:true}),/最多展示 3 个案例/);
 // 下架：取消首页展示，详情页 404
 core.offline(ids[3]);assert.equal(core.list().find(r=>r.id===ids[3]).featured,false);
 assert.equal(cases.render('zh',recs[3].slug,publicRoot).status,404);
 console.log('应用案例必填、网址编号、列表详情、首页展示与下架：通过');
}finally{fs.rmSync(root,{recursive:true,force:true})}
