const core=require('./后台服务.cjs');
const {ask}=require('./管理员终端输入.cjs');
(async()=>{try{const account=(await ask('管理员账号：')).trim(),password=(await ask('管理员密码（至少10位，输入不会显示）：',{hidden:true})).trim();core.initialize(account,password);console.log('管理员已创建。请启动后台服务器。')}catch(e){console.error(e.message);process.exitCode=1}})();
