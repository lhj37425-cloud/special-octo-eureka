const readline=require('readline');
const core=require('./后台服务.cjs');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(r=>rl.question(q,r));
(async()=>{try{const account=(await ask('管理员账号：')).trim();const password=(await ask('管理员密码（至少10位）：')).trim();core.initialize(account,password);console.log('管理员已创建。请启动后台服务器。')}catch(e){console.error(e.message);process.exitCode=1}finally{rl.close()}})();
