const core=require('./后台服务.cjs');
const {ask}=require('./管理员终端输入.cjs');
(async()=>{try{const account=(await ask('管理员账号：')).trim(),password=(await ask('新密码（至少10位，输入不会显示）：',{hidden:true})).trim();core.reset(account,password);console.log('密码已重置，已有登录会话已失效。')}catch(e){console.error(e.message);process.exitCode=1}})();
