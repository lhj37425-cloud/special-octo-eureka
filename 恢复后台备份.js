const path=require('path');
const core=require('./后台服务.cjs');
const source=process.argv[2];
if(!source){console.error('用法：node 恢复后台备份.js "data/admin-backend/backups/备份目录名"');process.exitCode=1}else{try{core.restore(path.resolve(source));console.log('恢复完成。请重新启动后台服务器并重新登录。')}catch(error){console.error(error.message);process.exitCode=1}}
