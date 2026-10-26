// 浏览器验证：子账号首次登录必须能进入“设置新密码”页，改密前不请求业务接口，改密后正常进入工作台
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('缺少 Playwright：请先运行 npm install --no-save playwright 和 npx playwright install chromium，再执行本验证。');process.exit(1)}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-first-login-'));process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;process.env.ADMIN_PORT='4393';
const core=require('../后台服务.cjs');
core.initialize('qa-admin','qa-password-123');const owner=core.auth(core.login('qa-admin','qa-password-123'));
core.createUser(owner,{account:'qa-repro',name:'复现子账号',password:'qa-repro-pass-123',perms:{publish:false,backup:false,leads:true}});
require('../后台服务器.js');
const base='http://127.0.0.1:4393/';
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage(),errors=[],business=[];let changed=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{const p=new URL(r.url()).pathname;if(!changed&&['/api/records','/api/leads'].includes(p))business.push(`${p} ${r.status()}`)});
await page.goto(base);await page.fill('#account','qa-repro');await page.fill('#password','qa-repro-pass-123');await page.click('#login-form button[type=submit]');
await page.getByRole('heading',{name:'设置新密码'}).waitFor({timeout:5000});
// 刷新页面也应回到改密页，而不是退回登录页
await page.reload();await page.getByRole('heading',{name:'设置新密码'}).waitFor({timeout:5000});
assert.deepEqual(business,[],'改密前不应请求业务接口');
changed=true;
await page.fill('#old-password','qa-repro-pass-123');await page.fill('#new-password','qa-repro-new-pass-123');await page.fill('#confirm-password','qa-repro-new-pass-123');await page.click('#login-form button[type=submit]');
await page.getByRole('heading',{name:'内容总览'}).waitFor({timeout:5000});
assert.deepEqual(errors,[],'页面不应出现脚本错误');
assert.equal(core.auth(core.login('qa-repro','qa-repro-new-pass-123')).mustChange,false);
// 主管理员不需要改密，登录后直接进入工作台
const ownerPage=await browser.newPage();ownerPage.on('pageerror',e=>errors.push(e.message));await ownerPage.goto(base);await ownerPage.fill('#account','qa-admin');await ownerPage.fill('#password','qa-password-123');await ownerPage.click('#login-form button[type=submit]');
await ownerPage.getByRole('heading',{name:'内容总览'}).waitFor({timeout:5000});assert.deepEqual(errors,[],'主管理员登录不应出现脚本错误');
console.log('子账号首次登录界面验证通过');
}catch(e){console.error(e);process.exitCode=1}finally{await browser.close();fs.rmSync(temp,{recursive:true,force:true});process.exit(process.exitCode||0)}})();
