const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'evoldream-admin-test-'));
process.env.ADMIN_DATA_DIR=root;
const core=require('../后台服务.cjs');
try{
 core.initialize('tester','test-password-123');
 const ids=[];
 for(const category of core.qualificationCategories){
  const record=core.saveRecord({id:`qua-${Math.random().toString(36).slice(2,12)}`,type:'qualifications',category,order:1,revision:0,draft:{zh:{name:`${category}测试`,org:'测试机构',description:'测试说明',image:{id:'cover.png',name:'封面.png'},attachments:[]},en:{},vi:{}}});
  core.publish(record.id);ids.push(record.id);
 }
 const publicRecords=core.list(true);
 assert.equal(publicRecords.length,3);
 assert.deepEqual(new Set(publicRecords.map(x=>x.category)),new Set(core.qualificationCategories));
 const original=publicRecords.find(x=>x.category==='合作资料');
 core.saveRecord({...original,draft:{...original.draft,zh:{...original.draft.zh,description:'只保存为草稿的修改'}}});
 assert.equal(core.list(true).find(x=>x.id===original.id).published.zh.description,'测试说明');
 core.offline(original.id);
 assert(!core.list(true).some(x=>x.id===original.id));
 console.log('后台资料分类、发布快照、草稿隔离与下架：通过');
}finally{fs.rmSync(root,{recursive:true,force:true})}
