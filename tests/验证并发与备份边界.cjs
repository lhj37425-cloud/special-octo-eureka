// 第三轮补充验收：跨进程文件锁、restore 与保留策略的边界。
// 全部使用临时目录，不读写 D:\项目\data。
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-concurrency-'));
process.env.ADMIN_DATA_DIR=path.join(temp,'admin-backend');
process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');
const lock=require('../文件锁.cjs');

function runChild(script){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[script],{stdio:'inherit'});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(Error('子进程退出码 '+code)));
  });
}

(async()=>{
  try{
    core.initialize('owner','password-123');

    // 1. 四个进程各加 25 次：没有锁会丢更新，有锁结果必须是 100
    const counter=path.join(temp,'counter.txt'),lockFile=path.join(temp,'counter.lock'),childScript=path.join(temp,'child.cjs');
    fs.writeFileSync(counter,'0');
    fs.writeFileSync(childScript,`
      const fs=require('fs');
      const {withLock}=require(${JSON.stringify(path.resolve(__dirname,'..','文件锁.cjs'))});
      for(let i=0;i<25;i++)withLock(${JSON.stringify(lockFile)},()=>{
        const n=Number(fs.readFileSync(${JSON.stringify(counter)},'utf8'));
        fs.writeFileSync(${JSON.stringify(counter)},String(n+1));
      });
    `);
    await Promise.all([1,2,3,4].map(()=>runChild(childScript)));
    assert.equal(fs.readFileSync(counter,'utf8'),'100','跨进程锁没有生效');

    // 2. 旧备份不能被 restore 里的 pruneBackups 提前删掉
    const state=path.join(process.env.ADMIN_DATA_DIR,'state.json');
    const backups=path.join(process.env.ADMIN_DATA_DIR,'backups');
    fs.mkdirSync(backups,{recursive:true});
    for(let i=0;i<12;i++){
      const dir=path.join(backups,`2020-01-${String(i+1).padStart(2,'0')}T00-00-00-000Z`);
      fs.mkdirSync(dir,{recursive:true});
      fs.copyFileSync(state,path.join(dir,'state.json'));
    }
    const oldest=path.join(backups,'2020-01-01T00-00-00-000Z');
    core.restore(oldest);
    assert.ok(fs.readdirSync(backups).length<=10,'保留策略没有收敛到 10 份');

    console.log('并发写入与备份边界验证通过');
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
