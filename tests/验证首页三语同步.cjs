const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
// 使用临时后台数据，测试结果不依赖真实数据里有哪些已发布案例
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'evol-home-'));process.env.ADMIN_DATA_DIR=temp;process.env.MVP_DATA_DIR=temp;
const core=require('../后台服务.cjs');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const chineseStaticHome=fs.readFileSync(path.join(root,'public','zh','index.html'),'utf8');

assert.doesNotMatch(server,/homeSections=lang==='zh'/,'首页不得再按中文单独选择结构');
assert.doesNotMatch(chineseStaticHome,/company-introduction-section|const data=\{training/,'中文静态首页不得保留旧的专属首页模块');

const caseText=(name,lang)=>({name:`${name} ${lang}`,industry:`行业 ${lang}`,description:'简介',image:core.file('case.png',Buffer.from([137,80,78,71,13,10,26,10]),'image/png'),problem:'问题',steps:'步骤',people:'分工',deliverables:'成果一\n成果二',attachments:[],clips:[]});
const slugs=['cas-home-one','cas-home-two','cas-home-three'].map(id=>{const r=core.saveRecord({id,type:'cases',draft:{zh:caseText(id,'zh'),en:caseText(id,'en'),vi:caseText(id,'vi')}});core.publish(r.id);return core.list().find(x=>x.id===r.id).slug});
const {render}=require('../homepage-sections.cjs');

try{
 for(const language of ['zh','en','vi']){
  const html=render(language);
  for(const marker of ['company-introduction-section','data-triad-home','business-scenarios','data-triad-label','data-triad-list'])assert.ok(html.includes(marker),`${language} 缺少共享首页结构：${marker}`);
  for(const route of ['training','agents','implementation','cases',...slugs.map(slug=>`cases/${slug}`)])assert.ok(html.includes(`/${language}/${route}/`),`${language} 缺少本语言跳转：${route}`);
  assert.strictEqual((html.match(/data-triad=/g)||[]).length,3,`${language} 缺少三项服务交互入口`);
  if(language!=='zh')assert.ok(!html.includes('/zh/'),`${language} 首页不应链接到中文路径`);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true})}

console.log('首页三语结构、交互与跳转同步验证通过');
