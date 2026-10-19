const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-admin-test-'));process.env.ADMIN_DATA_DIR=temp;
const core=require('../后台服务.cjs');
assert.equal(core.login('admin','wrong'),null);assert.equal(core.initialize('admin','1234567890'),'admin');const token=core.login('admin','1234567890');assert.ok(token);assert.equal(core.auth(token),true);
let r=core.saveRecord({type:'courses',draft:{zh:{name:'测试课程',description:'用于隔离验证',image:null,attachments:[],clips:[]}}});assert.throws(()=>core.publish(r.id),/封面/);r=core.saveRecord({...r,draft:{...r.draft,zh:{...r.draft.zh,image:{id:'cover.png'}}}});core.publish(r.id);assert.equal(core.list(true).length,1);assert.equal(core.publicFile('cover.png'),path.join(temp,'uploads','cover.png'));core.offline(r.id);assert.equal(core.list(true).length,0);core.remove(r.id);assert.equal(core.list().length,0);console.log('真实后台核心验证通过');
