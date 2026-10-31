const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Transform,pipeline}=require('stream');
const core=require('./后台服务.cjs');
const schema=require('./内容栏位.cjs');
const media=require('./媒体信息.cjs');
const deploy=require('./部署环境.cjs');
const port=Number(process.env.ADMIN_PORT||4181);
const html=fs.readFileSync(path.join(__dirname,'admin-demo','index.html'),'utf8');
const assets={
 '/': ['text/html; charset=utf-8',html], '/index.html':['text/html; charset=utf-8',html],
 '/demo.css':['text/css; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','demo.css'))],
 '/demo.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','demo.js'))],
 '/store.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','store.js'))],
 '/media.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','media.js'))],
 '/editor.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','editor.js'))],
 '/favicon.svg':['image/svg+xml',fs.readFileSync(path.join(__dirname,'public','favicon.svg'))]
};
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))};
// 逐段容错解析（和前台预览同一个版本）：坏段跳过而不是让整个请求报错；等号只切第一刀，保留值里的 '='
const cookie=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>{const t=x.trim(),i=t.indexOf('=');if(i<1)return null;try{return[decodeURIComponent(t.slice(0,i)),decodeURIComponent(t.slice(i+1))]}catch{return null}}).filter(Boolean));
// 请求体上限按路由收紧：账号/留言等小 JSON 用默认 64KB，保存内容用 2MB，只有旧版 base64 上传兼容接口保留 42MB
const body=(req,limit=64*1024)=>new Promise((resolve,reject)=>{let a=[],n=0;req.on('data',b=>{n+=b.length;if(n>limit)reject(Object.assign(Error('请求内容过大。'),{status:413}));else a.push(b)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)});
// 流式上传（M9）：边收边写临时文件，超过该类型的上限立刻中断并删除，不转 base64
function streamUpload(req,res){
 const raw=String(req.headers['x-file-name']||'');let name=raw;try{name=decodeURIComponent(raw)}catch{}
 name=name.replace(/[\\/:*?"<>|]/g,'_').slice(0,160);
 const ext=media.extOf(name);
 if(media.HEIC_EXTS.includes(ext))return json(res,400,{error:'HEIC 照片（苹果手机格式）浏览器无法处理，请先转成 JPG 再上传。'});
 const kind=media.kindOfExt(ext);
 if(!kind)return json(res,400,{error:'不支持的文件类型。图片用 JPG、PNG、WebP，视频用 MP4，附件用 PDF、DOCX、XLSX、PPTX。'});
 const limit=media.LIMITS[kind],mb=Math.round(limit/media.MB),declared=Number(req.headers['content-length']||0);
 if(declared>limit){res.setHeader('Connection','close');return json(res,413,{error:`文件不能超过 ${mb}MB。`})}
 const tmp=core.tempUploadFile(ext);let received=0;
 const guard=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>limit)return callback(Object.assign(Error(`文件不能超过 ${mb}MB。`),{status:413}));callback(null,chunk)}});
 const reply=(status,data)=>{try{if(!res.headersSent)json(res,status,data)}catch{}};
 pipeline(req,guard,fs.createWriteStream(tmp),error=>{
  if(error){fs.rmSync(tmp,{force:true});reply(error.status||400,{error:error.status?error.message:'上传中断，请重试。'});return}
  let saved;
  try{saved=core.file(name,fs.readFileSync(tmp))}catch(e){fs.rmSync(tmp,{force:true});return reply(400,{error:e.message||'文件校验失败。'})}
  fs.rmSync(tmp,{force:true});
  reply(201,{file:saved});
 });
}
const token=req=>cookie(req).admin_session||'';
// 首次登录（或被重置密码）的账号必须先改密码，在此之前只能查看自己、改密码和退出
const firstLoginPaths=['/api/me','/api/password','/api/logout'];
const protect=(req,res)=>{const user=core.auth(token(req));if(!user){json(res,401,{error:'请先登录。'});return null}if(user.mustChange&&!firstLoginPaths.includes(new URL(req.url,'http://localhost').pathname)){json(res,403,{error:'请先修改初始密码。'});return null}return user};
const protectWrite=(req,res)=>{const user=protect(req,res);if(!user)return null;const csrf=cookie(req).admin_csrf||'';if(!csrf||req.headers['x-csrf-token']!==csrf){json(res,403,{error:'安全校验失效，请重新登录。'});return null}return user};
// Cookie 属性：HTTPS 下补 Secure（反代终结 TLS 时按 X-Forwarded-Proto 判断，本地 HTTP 调试不受影响）
const cookieFlags = req => (deploy.secure(req) ? ' Secure' : '');
const session=(req,res,t,user)=>{const csrf=crypto.randomBytes(24).toString('base64url'),flags=cookieFlags(req);return json(res,200,{ok:true,csrf,user},{'Set-Cookie':[`admin_session=${encodeURIComponent(t)}; HttpOnly; SameSite=Strict; Path=/${flags}`,`admin_csrf=${encodeURIComponent(csrf)}; SameSite=Strict; Path=/${flags}`]})};
// 登录失败限流两条线：同一「IP+账号」15 分钟内失败 5 次锁 5 分钟；
// 同一 IP 不管换多少账号，15 分钟内失败 30 次也锁 5 分钟，防止换账号名绕过并把 Map 刷大
const loginAttempts=new Map(),loginIpAttempts=new Map();
const attemptWindow=15*60*1000,lockTime=5*60*1000;
function loginKey(req,account){return `${deploy.ip(req)}:${String(account||'').slice(0,120)}`}
const attemptGet=(map,key)=>{const entry=map.get(key);return !entry||Date.now()-entry.started>attemptWindow?null:entry};
function bump(map,key){const now=Date.now(),entry=attemptGet(map,key);if(!entry){if(map.size>20000)for(const [k,v] of map)if(now-v.started>attemptWindow)map.delete(k);map.set(key,{started:now,last:now,count:1})}else{entry.last=now;entry.count++}}
function limited(req,account){const now=Date.now(),byAccount=attemptGet(loginAttempts,loginKey(req,account)),byIp=attemptGet(loginIpAttempts,deploy.ip(req));return !!(byAccount&&byAccount.count>=5&&now-byAccount.last<lockTime)||!!(byIp&&byIp.count>=30&&now-byIp.last<lockTime)}
function failed(req,account){bump(loginAttempts,loginKey(req,account));bump(loginIpAttempts,deploy.ip(req))}
// 定期清掉过期的失败记录，Map 不会越积越大
setInterval(()=>{const now=Date.now();for(const map of [loginAttempts,loginIpAttempts])for(const [k,v] of map)if(now-v.started>attemptWindow)map.delete(k)},10*60*1000).unref();
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);if(p==='/api/status')return json(res,200,{initialized:core.read().users.length>0});
 if(p==='/healthz'){try{core.read();return json(res,200,{ok:true})}catch{return json(res,503,{ok:false})}}
 if(p==='/api/setup'&&req.method==='POST'){if(core.read().users.length)return json(res,403,{error:'主管理员已经创建，请直接登录。'});const d=JSON.parse((await body(req)).toString()||'{}');core.initialize(String(d.account||'').trim(),d.password,d.name);const t=await core.loginAsync(String(d.account||'').trim(),d.password);return session(req,res,t,core.auth(t))}
 if(p==='/api/login'&&req.method==='POST'){const d=JSON.parse((await body(req)).toString()||'{}');if(limited(req,d.account))return json(res,429,{error:'登录尝试过多，请 5 分钟后再试。'});const t=await core.loginAsync(d.account,d.password);if(!t){failed(req,d.account);return json(res,401,{error:'账号或密码错误，或账号已停用。'})}loginAttempts.delete(loginKey(req,d.account));loginIpAttempts.delete(deploy.ip(req));return session(req,res,t,core.auth(t))}
 if(p==='/api/logout'&&req.method==='POST'){if(!protectWrite(req,res))return;core.logout(token(req));const flags=cookieFlags(req);return json(res,200,{ok:true},{'Set-Cookie':[`admin_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/${flags}`,`admin_csrf=; Max-Age=0; SameSite=Strict; Path=/${flags}`]})}
 if(p==='/api/me'&&req.method==='GET'){const user=protect(req,res);if(!user)return;return json(res,200,{user})}
 if(p==='/api/password'&&req.method==='POST'){if(!protectWrite(req,res))return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{user:core.changePassword(token(req),d.oldPassword,d.newPassword)})}
 if(p==='/api/users'&&req.method==='GET'){const user=protect(req,res);if(!user)return;return json(res,200,{users:core.listUsers(user)})}
 if(p==='/api/users'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;return json(res,201,{user:core.createUser(user,JSON.parse((await body(req)).toString()||'{}'))})}
 let u=p.match(/^\/api\/users\/([^/]+)(\/password)?$/);if(u&&['POST','DELETE'].includes(req.method)){const user=protectWrite(req,res);if(!user)return;if(req.method==='DELETE'){core.removeUser(user,u[1]);return json(res,200,{ok:true})}const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{user:u[2]?core.resetUserPassword(user,u[1],d.password):core.updateUser(user,u[1],d)})}
 if(p==='/api/leads'&&req.method==='GET'){const user=protect(req,res);if(!user)return;return json(res,200,{leads:core.listLeads(user)})}
 let l=p.match(/^\/api\/leads\/([^/]+)$/);if(l&&['POST','DELETE'].includes(req.method)){const user=protectWrite(req,res);if(!user)return;if(req.method==='DELETE'){core.removeLead(user,l[1]);return json(res,200,{ok:true})}return json(res,200,{lead:core.updateLead(user,l[1],JSON.parse((await body(req)).toString()||'{}'))})}
 if(p==='/api/records'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{records:core.list()})}
 if(p==='/api/backup'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;if(!core.can(user,'backup'))return json(res,403,{error:'你的账号没有备份权限。'});return json(res,200,{ok:true,path:core.backup()})}
 if(p==='/api/records'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const d=JSON.parse((await body(req,2*1024*1024)).toString()||'{}');return json(res,200,{record:core.saveRecord(d,user)})}
 let m=p.match(/^\/api\/records\/([^/]+)\/(publish|offline|revert)$/);if(m&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;return json(res,200,{record:m[2]==='publish'?core.publish(m[1],user):m[2]==='offline'?core.offline(m[1],user):core.revert(m[1],user)})}
 m=p.match(/^\/api\/records\/([^/]+)$/);if(m&&req.method==='DELETE'){const user=protectWrite(req,res);if(!user)return;core.remove(m[1],user);return json(res,200,{ok:true})}
 if(p==='/api/schema'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{schema:{LANGS:schema.LANGS,TYPES:schema.TYPES}})}
 if(p==='/api/options'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{options:core.listOptions()})}
 if(p==='/api/options'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{options:core.saveOptions(user,d)})}
 if(p==='/api/order'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{records:core.setOrder(user,d.type,d.ids)})}
 if(p==='/api/upload'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const type=String(req.headers['content-type']||'');if(!type.includes('application/json'))return streamUpload(req,res);const d=JSON.parse((await body(req,42*1024*1024)).toString()||'{}');const bytes=Buffer.from(String(d.base64||''),'base64');return json(res,201,{file:core.file(d.name,bytes)})}
 // 先鉴权再判断文件是否存在：否则任何人都能靠 404/401 的差别探测有哪些文件编号
 m=p.match(/^\/media\/([^/]+)$/);if(m){if(!protect(req,res))return;const f=core.filePath(m[1]);if(!fs.existsSync(f))return json(res,404,{error:'文件不存在。'});const ext=path.extname(f).toLowerCase(),mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext]||'application/octet-stream';const headers={'Content-Type':mime,'X-Content-Type-Options':'nosniff'};if(!['.jpg','.jpeg','.png','.webp','.mp4','.pdf'].includes(ext))headers['Content-Disposition']='attachment';res.writeHead(200,headers);return fs.createReadStream(f).pipe(res)}
 if(assets[p]){const [type,data]=assets[p];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});return res.end(data)}json(res,404,{error:'不存在。'});
}catch(e){if(!e.status||e.status>=500)console.error(e);json(res,e.status||400,{error:e.message||'请求失败。'})}});
// 启动时清理一次没用的上传文件，之后每天一次（M10）
const cleanupUploads=()=>{try{const result=core.cleanupUploads();if(result.removed.length)console.log(`已清理 ${result.removed.length} 个没被用到的上传文件`)}catch(error){console.error('清理上传文件失败：'+error.message)}};
server.listen(port,process.env.HOST||'127.0.0.1',()=>{console.log(`后台 http://127.0.0.1:${port}`);cleanupUploads()});
setInterval(cleanupUploads,24*60*60*1000).unref();
