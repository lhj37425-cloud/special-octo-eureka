const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {render}=require('../homepage-sections.cjs');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const chineseStaticHome=fs.readFileSync(path.join(root,'public','zh','index.html'),'utf8');

assert.doesNotMatch(server,/homeSections=lang==='zh'/,'首页不得再按中文单独选择结构');
assert.doesNotMatch(chineseStaticHome,/company-introduction-section|const data=\{training/,'中文静态首页不得保留旧的专属首页模块');

for(const language of ['zh','en','vi']){
 const html=render(language);
 for(const marker of ['company-introduction-section','data-triad-home','business-scenarios','data-triad-label','data-triad-list'])assert.ok(html.includes(marker),`${language} 缺少共享首页结构：${marker}`);
 for(const route of ['training','agents','implementation','scenarios/content','scenarios/knowledge','scenarios/recruitment'])assert.ok(html.includes(`/${language}/${route}/`),`${language} 缺少本语言跳转：${route}`);
 assert.strictEqual((html.match(/data-triad=/g)||[]).length,3,`${language} 缺少三项服务交互入口`);
 if(language!=='zh')assert.ok(!html.includes('/zh/'),`${language} 首页不应链接到中文路径`);
}

console.log('首页三语结构、交互与跳转同步验证通过');
