const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const workbench=fs.readFileSync(path.join(root,'admin-demo','demo.js'),'utf8');
const store=fs.readFileSync(path.join(root,'admin-demo','store.js'),'utf8');
const server=fs.readFileSync(path.join(root,'后台服务器.js'),'utf8');

// 正式工作台必须使用真实接口，而不是浏览器演示缓存。
assert.doesNotMatch(store,/indexedDB|localStorage/);
assert.match(store,/fetch\(url,\{credentials:'same-origin'/);
assert.match(store,/request\('\/api\/records'/);
assert.match(store,/request\(`\/api\/records\/\$\{encodeURIComponent\(saved\.id\)\}\/publish`/);
assert.match(store,/request\(`\/api\/records\/\$\{encodeURIComponent\(saved\.id\)\}\/offline`/);
assert.match(store,/request\('\/api\/upload'/);
assert.ok(server.includes("'/demo.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','demo.js'))]"));

// 每一类可操作按钮都必须有明确处理器，且落到真实保存、上传或本地前台地址。
for(const operation of [
  "act==='public'", "act==='logout'", "act==='nav'||act==='back'",
  "act==='new'", "act==='edit'", "act==='tab'", "act==='save'",
  "act==='publish-edit'", "act==='publish'", "act==='offline'",
  "act==='delete'", "act==='upload'", "act==='remove-media'",
  "act==='remove-file'", "act==='clip-add'", "act==='clip-delete'",
  "act==='clip-up'||act==='clip-down'", "act==='preview'||act==='preview-edit'"
]) assert.match(workbench,new RegExp(operation.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));

assert.match(workbench,/window\.open\(PUBLIC/);
assert.match(workbench,/await logoutRequest\(\)/);
assert.match(workbench,/await saveEditing\(\)/);
assert.match(workbench,/copy\._action='publish'/);
assert.match(workbench,/record\._action='offline'/);
assert.match(workbench,/if\(!await persist\(\)\)/);
assert.match(workbench,/pickFile\(arg,arg2===undefined\?null:\+arg2\)/);
assert.match(workbench,/await uploadRequest\(file\)/);
assert.doesNotMatch(workbench,/data-action="reset/);

console.log('管理工作台按钮均已映射到真实本地动作：通过');
