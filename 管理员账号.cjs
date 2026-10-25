const readline=require('readline');
const core=require('./后台服务.cjs');

const action=process.argv[2];
if(!['初始化','重置','查看'].includes(action)){
  console.log('用法：');
  console.log('  npm run 管理员:创建');
  console.log('  npm run 管理员:重置密码');
  console.log('  npm run 管理员:查看');
  process.exitCode=1;
  return;
}
if(action==='查看'){
  const users=core.read().users;
  console.log(users.length?users.map(u=>`${u.role==='owner'?'主管理员':'子账号'}：${u.account}（${u.name||u.account}）${u.disabled?' · 已停用':''}`).join('\n'):'尚未创建管理员账号。');
  return;
}
if(!process.stdin.isTTY){
  console.error('请在本机交互式终端中运行此命令，以避免密码被记录。');
  process.exitCode=1;
  return;
}

const prompt=text=>new Promise(resolve=>{
  const input=readline.createInterface({input:process.stdin,output:process.stdout});
  input.question(text,value=>{input.close();resolve(value.trim())});
});
const secret=text=>new Promise((resolve,reject)=>{
  let value='',done=false;
  const finish=(error,result)=>{
    if(done)return;
    done=true;
    process.stdin.removeListener('data',onData);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
    error?reject(error):resolve(result);
  };
  const onData=chunk=>{
    for(const char of String(chunk)){
      if(char==='\u0003')return finish(Error('操作已取消。'));
      if(char==='\r'||char==='\n')return finish(null,value);
      if(char==='\u007f'||char==='\b'){value=value.slice(0,-1);continue}
      value+=char;
    }
  };
  process.stdout.write(text);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data',onData);
});

(async()=>{
  try{
    const account=await prompt('管理员账号：');
    const password=await secret('密码（至少 10 位，输入不回显）：');
    const confirm=await secret('再次输入密码：');
    if(password!==confirm)throw Error('两次密码不一致，未修改任何账号。');
    if(action==='初始化')core.initialize(account,password);
    else core.reset(account,password);
    console.log(action==='初始化'?'管理员账号创建成功。':'密码已重置，所有已登录浏览器均需重新登录。');
  }catch(error){
    console.error(`操作未完成：${error.message}`);
    process.exitCode=1;
  }
})();
