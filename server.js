const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {render}=require('./views.cjs');
const adminCore=require('./后台服务.cjs');
const frontData=require('./前台数据.cjs');
const schema=require('./内容栏位.cjs');
const deploy=require('./部署环境.cjs');
const casesModule=require('./cases.cjs');
const root=__dirname,publicRoot=path.join(root,'public'),dataRoot=path.resolve(process.env.MVP_DATA_DIR||path.join(root,'data')),leadFile=path.join(dataRoot,'mvp-leads.json');
const read=(f,fallback)=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):fallback;
function write(f,v){const temp=f+'.tmp';fs.writeFileSync(temp,JSON.stringify(v,null,2));fs.renameSync(temp,f)}
// 前台取数统一走 前台数据.cjs（方案第 5 步）
function content(){return frontData.content()}
function staticBackLink(pathname){const parts=pathname.split('/').filter(Boolean),language=parts[0];if(parts.length<2||!['zh','en','vi'].includes(language))return '';const homeSection={training:'services',agents:'services',implementation:'services',cases:'scenarios'}[parts[1]],href=parts.length===2?(homeSection?`/${language}/#${homeSection}`:`/${language}/`):`/${parts.slice(0,-1).join('/')}/`,label={zh:'返回上一页',en:'Back',vi:'Quay lại'}[language];return `<a class="v2-back" href="${href}" onclick="if(document.referrer.indexOf(location.origin+'/')===0&&history.length>1){event.preventDefault();history.back()}"><span aria-hidden="true">←</span> ${label}</a>`}
function addStaticBackLink(html,pathname){const link=staticBackLink(pathname);if(!link)return html;const breadcrumbs=/(<nav class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>)/;return breadcrumbs.test(html)?html.replace(breadcrumbs,`<div class="v2-crumbs">${link}$1</div>`):html.replace('<main id="main">',`<main id="main"><div class="container v2-crumbs is-solo">${link}</div>`)}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf','.mp4':'video/mp4','.webm':'video/webm','.ogg':'video/ogg','.txt':'text/plain; charset=utf-8','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.zip':'application/zip','.woff2':'font/woff2'};
function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(body):body)}
// 三语 404 页面：用“关于我们”页面的页头页脚作外框，按地址里的语言显示；没有语言前缀时用越南语（根地址默认语言）
const notFoundText={zh:['页面不存在','您访问的页面不存在，可能已被移动或删除。','返回首页','联系我们'],en:['Page not found','The page you are looking for does not exist or may have been moved.','Back to home','Contact us'],vi:['Không tìm thấy trang','Trang bạn tìm không tồn tại hoặc đã được chuyển đi.','Về trang chủ','Liên hệ']};
function notFoundPage(pathname){const lang=['zh','en','vi'].find(l=>pathname.startsWith(`/${l}/`))||'vi',[title,intro,home,contact]=notFoundText[lang];let html=fs.readFileSync(path.join(publicRoot,lang,'about','index.html'),'utf8');for(const l of ['zh','en','vi'])html=html.split(`href="/${l}/about/" lang=`).join(`href="/${l}/" lang=`);return html.replace(/<link rel="(?:canonical|alternate)"[^>]*>\s*/g,'').replace(/<meta property="og:url"[^>]*>\s*/,'').replace('</head>','<meta name="robots" content="noindex"></head>').replace(/<title>.*?<\/title>/,`<title>${title} | EVOL DREAM</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${intro}">`).replace(/ class="active" aria-current="page"/g,'').replace(/<main id="main">[\s\S]*<\/main>/,`<main id="main"><section class="page-hero"><div class="container"><p class="eyebrow">404</p><h1>${title}</h1><p class="intro">${intro}</p><div class="hero-actions"><a class="button primary" href="/${lang}/">${home}</a><a class="button outline" href="/${lang}/contact/">${contact}</a></div></div></section></main>`)}
const text=value=>typeof value==='string'?value.trim():'';
// 留言频率限制：同一来源 10 分钟内最多新增 5 条（重复提交同一 requestId 不计入）
// 来源地址经 部署环境.cjs 解析：本机 Nginx 反代时取真实访客 IP，直接访问时才用 socket 地址
const leadHits=new Map();
function leadLimited(req){const key=deploy.ip(req),now=Date.now(),recent=t=>now-t<10*60*1000;if(leadHits.size>5000)for(const [k,v] of leadHits)if(!v.some(recent))leadHits.delete(k);const hits=(leadHits.get(key)||[]).filter(recent);if(hits.length>=5){leadHits.set(key,hits);return true}hits.push(now);leadHits.set(key,hits);return false}
function body(req,limit=1024*1024){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',b=>{size+=b.length;if(size>limit){reject(Object.assign(Error('提交内容过大。'),{status:413}));chunks=[]}else chunks.push(b)});req.on('end',()=>{if(size>limit)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch{reject(Object.assign(Error('请求格式不正确。'),{status:400}))}});req.on('error',reject)})}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(u.pathname);
// 跨站提交拦截：只接受同源表单。反代后浏览器看到的域名可能和本机 Host 不同，
// 这里用 部署环境.host()（反代时优先 X-Forwarded-Host）比对，同时兜住 Origin 非法的情况
if(!['GET','HEAD'].includes(req.method)&&req.headers.origin){let origin=null;try{origin=new URL(req.headers.origin)}catch{}if(!origin||origin.host!==deploy.host(req))return send(res,403,{error:'请求来源校验未通过，请刷新页面后重试。'})}
let protectedMedia=pathname.match(/^\/admin-media\/([^/]+)$/);if(protectedMedia){let media=adminCore.publicFile(protectedMedia[1]);if(!media||!fs.existsSync(media))return send(res,404,'404 Not Found','text/plain');const ext=path.extname(media).toLowerCase(),type=mime[ext]||'application/octet-stream',stat=fs.statSync(media),headers={'Content-Type':type,'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};if(!['.png','.jpg','.jpeg','.webp','.mp4'].includes(ext))headers['Content-Disposition']='attachment';const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;if(start>=stat.size||start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end()}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});return fs.createReadStream(media,{start,end}).pipe(res)}res.writeHead(200,{...headers,'Content-Length':stat.size});return fs.createReadStream(media).pipe(res)}
if(pathname==='/api/leads'&&req.method==='POST'){let p=await body(req,32*1024),language=['zh','vi','en'].includes(p.language)?p.language:'zh',messages={zh:['请完整填写咨询信息并同意隐私政策。','请输入有效邮箱或电话号码。','提交过于频繁，请稍后再试。'],en:['Please complete the required fields and consent.','Enter a valid email or phone number.','Too many submissions. Please try again later.'],vi:['Vui lòng điền đủ thông tin và đồng ý chính sách.','Nhập email hoặc số điện thoại hợp lệ.','Bạn đã gửi quá nhiều lần, vui lòng thử lại sau.']}[language];if(p.website)return send(res,400,{error:messages[0]});const name=text(p.name),company=text(p.company),contact=text(p.contact),message=text(p.message),requestId=text(p.requestId).slice(0,100);if(!name||!company||!contact||!['training','agents','implementation','partnerships'].includes(p.service)||p.consent!==true)return send(res,400,{error:messages[0]});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&!(/^\+?[\d\s().-]{7,30}$/.test(contact)&&contact.replace(/\D/g,'').length>=7))return send(res,400,{error:messages[1]});if(name.length>60||company.length>120||contact.length>120||message.length>2000)return send(res,400,{error:messages[0]});let leads=read(leadFile,[]),old=requestId&&leads.find(x=>x.requestId===requestId);if(old)return send(res,200,{id:old.id,notification:'local'});if(leadLimited(req))return send(res,429,{error:messages[2]});
// 只保存表单定义的字段，其余字段一律丢弃
let item={name,company,contact,service:p.service,message,consent:true,language,source:text(p.source).slice(0,200),campaign:Object.fromEntries(['utm_source','utm_medium','utm_campaign'].filter(k=>typeof p.campaign?.[k]==='string').map(k=>[k,p.campaign[k].slice(0,100)])),requestId,id:'L-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'),createdAt:new Date().toISOString()};leads.unshift(item);write(leadFile,leads);return send(res,201,{id:item.id,notification:'local'})}
if(pathname.startsWith('/api/'))return send(res,404,{error:'接口不存在。'});
if(pathname==='/'){res.writeHead(302,{Location:'/vi/'});return res.end()}
// /zh/index.html 等地址统一跳到目录地址，避免直接打开未经处理的旧版静态模板
if(/\/index\.html$/i.test(pathname)){res.writeHead(301,{Location:u.pathname.replace(/index\.html$/i,'')+u.search});return res.end()}
const caseRoute=pathname.match(/^\/(zh|en|vi)\/cases(?:\/([^/]+))?\/?$/);if(caseRoute){if(!pathname.endsWith('/')){res.writeHead(302,{Location:pathname+'/'+u.search});return res.end()}let page=require('./cases.cjs').render(caseRoute[1],caseRoute[2],publicRoot);return send(res,page.status,addStaticBackLink(page.body,pathname),'text/html; charset=utf-8')}
const dynamic=pathname.match(/^\/(zh|en|vi)\/(courses|teachers)(?:\/([^/]+))?\/?$/);if(dynamic){if(!pathname.endsWith('/')){res.writeHead(302,{Location:pathname+'/'+u.search});return res.end()}let html=render(dynamic[1],dynamic[2],dynamic[3],content(),publicRoot);return send(res,html.status||200,html.body,'text/html; charset=utf-8')}
function homePage(lang,override=null){let file=path.join(publicRoot,lang,'index.html'),html=fs.readFileSync(file,'utf8'),sharedHome=require('./homepage-sections.cjs').render(lang),faqMatch=html.match(/<section class="faq-section">([\s\S]*?)<\/section>(?=<section class="contact-section")/),faqContent=faqMatch?faqMatch[1]:'',trustHome=require('./homepage-trust-production.cjs').render(lang,faqContent,override)+`<script>(()=>{const section=document.querySelector('.home-qualifications'),all=section?.querySelector('.home-view-all'),dialog=document.querySelector('.home-qualification-dialog'),image=dialog?.querySelector('img'),closeButton=dialog?.querySelector('button');let previousBodyOverflow='',previousDocumentOverflow='',scale=1;const renderScale=()=>{if(image)image.style.transform='scale('+scale+')'};const lockPage=()=>{previousBodyOverflow=document.body.style.overflow;previousDocumentOverflow=document.documentElement.style.overflow;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden'};const unlockPage=()=>{document.body.style.overflow=previousBodyOverflow;document.documentElement.style.overflow=previousDocumentOverflow};if(closeButton){closeButton.textContent='×';closeButton.setAttribute('aria-label',${JSON.stringify({zh:'关闭图片预览',en:'Close image preview',vi:'Đóng ảnh xem trước'}[lang])});Object.assign(closeButton.style,{position:'absolute',top:'14px',right:'14px',zIndex:'3',display:'grid',placeItems:'center',width:'40px',height:'40px',padding:'0',border:'0',borderRadius:'50%',background:'#1a0d0e',color:'#fff',fontSize:'30px',lineHeight:'1',cursor:'pointer',boxShadow:'0 3px 12px rgba(0,0,0,.25)'})}if(image){image.style.transformOrigin='center center';image.style.transition='transform .12s ease'}all?.addEventListener('click',()=>{const expanded=all.getAttribute('aria-expanded')==='true';section.querySelectorAll('.is-extra').forEach(card=>card.hidden=expanded);all.setAttribute('aria-expanded',String(!expanded));all.querySelector('span').textContent=expanded?all.dataset.openLabel:all.dataset.closeLabel;all.querySelector('i').textContent=expanded?'↓':'↑'});section?.querySelectorAll('[data-home-qualification-preview]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();scale=1;renderScale();dialog.querySelector('strong').textContent=button.dataset.previewTitle;image.src=button.dataset.previewSrc;image.alt=button.querySelector('img').alt;lockPage();dialog.showModal()}));closeButton?.addEventListener('click',()=>dialog.close());dialog?.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});dialog?.addEventListener('close',()=>{scale=1;renderScale();unlockPage()});window.addEventListener('wheel',event=>{if(!dialog?.open||!event.ctrlKey)return;event.preventDefault();scale=Math.min(3,Math.max(.6,scale+(event.deltaY<0?.15:-.15)));renderScale()},{passive:false})})()<\/script>`,homeSections=/(?:<section class="section company-introduction-section"[\s\S]*?)?<section class="section services-section"[\s\S]*?(?=<section class="section process-section")/;html=html.replace(homeSections,sharedHome).replace(/<section class="section process-section"[\s\S]*?<\/section>(?=<section class="faq-section">)/,'').replace(/<section class="faq-section">[\s\S]*?<\/section>(?=<section class="contact-section")/,trustHome).replace('</head>','<link rel="stylesheet" href="/v2-home.css"><script src="/v2-home.js" defer></script></head>');return html}
const home=pathname.match(/^\/(zh|en|vi)\/$/);if(home){let lang=home[1];return send(res,200,homePage(home[1]),'text/html; charset=utf-8')}
// ===== 后台预览（第 6 步）：要登录；同一套前台模板；这一条用草稿，其余用发布版 =====
const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const previewCookie=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const previewUser=req=>adminCore.auth(previewCookie(req).admin_session||'');
const previewLangName={zh:'中文',vi:'越南语',en:'英文'};
const previewSegmentName={teachers:'专家及讲师',courses:'课程',cases:'应用案例',qualifications:'公司资质','':'首页'};
function previewBar(req,lang,segment,id,record){
 const host=String(deploy.host(req)||'127.0.0.1').split(':')[0];
 const links=Object.entries(previewLangName).map(([l,name])=>{
  let visible=!record;
  if(record){const draft=frontData.normalize({...record,published:record.draft});visible=frontData.languageComplete(record,draft,l)}
  const path=segment?`/${segment}/`:'/';
  return `<a style="color:#fff;text-decoration:underline" href="/preview/${l}${path}${id&&visible?encodeURIComponent(id)+'/':''}">${name}</a>`;
 }).join(' · ');
 // 上线后后台与前台同域，挂在 /admin/ 下（见 部署/nginx.conf），设 ADMIN_BASE_PATH=/admin/ 即可；
 // 没设时退回“同主机前台端口+后台端口”的本地调试地址
 const adminPort=process.env.ADMIN_PORT||(String(process.env.PORT||'')==='4373'?'4381':'4181');
 const adminBase=process.env.ADMIN_BASE_PATH||`http://${host}:${adminPort}/`;
 return `<div class="preview-bar" style="position:sticky;top:0;z-index:99999;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 18px;background:#1a0d0e;color:#fff;font:13px/1.5 system-ui,-apple-system,'Microsoft YaHei',sans-serif"><strong style="color:#f5c451">预览 · 未发布</strong><span>${previewSegmentName[segment]||''}</span><span>${links}</span><a style="color:#fff;margin-left:auto;text-decoration:underline" href="${adminBase}">返回编辑</a></div>`;
}
function previewChrome(html,req,lang,segment,id,record){
 html=html.replace(/<meta name="robots"[^>]*>/gi,'').replace('</head>','<meta name="robots" content="noindex"></head>');
 html=html.replace(/\/admin-media\//g,'/preview-media/');
 return html.replace('<body>','<body>'+previewBar(req,lang,segment,id,record));
}
function previewPrompt(req,lang,segment,id,record,missing){
 const body=`<main id="main"><section class="v2-group"><div class="container"><h1>这种语言还没填完</h1><p>${previewLangName[lang]}还缺：${escHtml(missing.join('、')||'必填项')}。发布后这种语言不会显示。</p><p><a class="text-link" href="/preview/${lang}/${segment}/">返回预览列表</a></p></div></section></main>`;
 const html=`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>预览 · 未发布</title><link rel="stylesheet" href="/v2.css"><link rel="stylesheet" href="/v2-courses.css"></head><body>${previewBar(req,lang,segment,id,record)}${body}</body></html>`;
 return html;
}
const previewMedia=pathname.match(/^\/preview-media\/([^/]+)$/);
if(previewMedia){
 if(!previewUser(req))return send(res,401,'请先登录后台再预览。','text/html; charset=utf-8');
 const file=adminCore.filePath(previewMedia[1]);
 if(!fs.existsSync(file))return send(res,404,'Not found','text/plain; charset=utf-8');
 const ext=path.extname(file).toLowerCase(),type=mime[ext]||'application/octet-stream';
 const stat=fs.statSync(file);
 res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Content-Length':stat.size});
 return fs.createReadStream(file).pipe(res);
}
const preview=pathname.match(/^\/preview\/(zh|en|vi)(?:\/(teachers|courses|cases|qualifications)(?:\/([^/]+))?)?\/?$/);
if(preview){
 if(!previewUser(req))return send(res,401,'请先登录后台再预览。','text/html; charset=utf-8');
 const lang=preview[1],segment=preview[2]||'',id=preview[3]?decodeURIComponent(preview[3]):null;
 if(!segment)return send(res,200,previewChrome(homePage(lang),req,lang,'',null,null),'text/html; charset=utf-8');
 const record=id?adminCore.list().find(r=>r.id===id):null;
 if(id&&!record)return send(res,404,'这条内容不存在。','text/plain; charset=utf-8');
 if(record){
  const draft=frontData.normalize({...record,published:record.draft});
  if(!frontData.languageComplete(record,draft,lang)){
   const missing=schema.langComplete(record.type,record.draft?.[lang]||{}).missing;
   return send(res,200,previewPrompt(req,lang,segment,id,record,missing),'text/html; charset=utf-8');
  }
 }
 let page;
 if(segment==='cases')page=casesModule.render(lang,record?(record.slug||record.id):null,publicRoot,record?{id:record.id,draft:record.draft}:null);
 else if(segment==='qualifications'){
  if(!record)return send(res,404,'资质没有列表页。','text/plain; charset=utf-8');
  page={status:200,body:homePage(lang,{id:record.id,draft:record.draft})};
 } else page=render(lang,segment,id,frontData.content(record?{id:record.id,draft:record.draft}:null),publicRoot);
 if(!page)return send(res,404,'预览失败。','text/plain; charset=utf-8');
 return send(res,page.status||200,previewChrome(page.body,req,lang,segment,id,record),'text/html; charset=utf-8');
}
let file=path.resolve(publicRoot,pathname.slice(1));if(!file.startsWith(publicRoot+path.sep))return send(res,404,notFoundPage(pathname),'text/html; charset=utf-8');if(fs.existsSync(file)&&fs.statSync(file).isDirectory()){if(!pathname.endsWith('/')){res.writeHead(302,{Location:pathname+'/'+u.search});return res.end()}file=path.join(file,'index.html')}if(!fs.existsSync(file)||!fs.statSync(file).isFile())return send(res,404,notFoundPage(pathname),'text/html; charset=utf-8');if(path.extname(file).toLowerCase()==='.html'&&req.method==='GET')return send(res,200,addStaticBackLink(fs.readFileSync(file,'utf8'),pathname),'text/html; charset=utf-8');let stat=fs.statSync(file),headers={'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){let start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end()}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});return fs.createReadStream(file,{start,end}).pipe(res)}res.writeHead(200,{...headers,'Content-Length':stat.size});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)
}catch(error){if(res.headersSent)return res.end();if(error instanceof URIError)return send(res,400,'400 Bad Request','text/plain; charset=utf-8');send(res,error.status||500,{error:error.status&&error.status<500?error.message:'本地服务暂时不可用，请重试。'})}});
// 默认只监听本机回环，由同机 Nginx 反代对外；如需容器内监听全部网卡，设 HOST=0.0.0.0
server.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('EVOL DREAM MVP http://127.0.0.1:'+(process.env.PORT||4173)+'/zh/'));
