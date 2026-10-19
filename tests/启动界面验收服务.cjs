const fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'evoldream-ui-qa-'));
process.env.ADMIN_DATA_DIR=root;process.env.ADMIN_PORT='4391';process.env.PORT='4392';
const core=require('../后台服务.cjs');
core.initialize('qa-admin','qa-password-123');
require('../后台服务器.js');require('../server.js');
console.log(`界面验收后台：http://127.0.0.1:4391/（临时数据：${root}）`);
const close=()=>{try{fs.rmSync(root,{recursive:true,force:true})}finally{process.exit(0)}};
process.on('SIGINT',close);process.on('SIGTERM',close);
