const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Transform,pipeline}=require('stream');
const core=require('./后台服务.cjs');
const schema=require('./内容栏位.cjs');
const media=require('./媒体信息.cjs');
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
const cookie=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
// 旧版 JSON 请求体（留言、保存内容等）；上传已改成流式，这里的 42MB 只给旧格式的 base64 兼容接口用
const body=req=>new Promise((resolve,reject)=>{let a=[],n=0;req.on('data',b=>{n+=b.length;if(n>42*1024*1024)reject(Object.assign(Error('请求内容过大。'),{status:413}));else a.push(b)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)});
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
const session=(res,t,user)=>{const csrf=crypto.randomBytes(24).toString('base64url');return json(res,200,{ok:true,csrf,user},{'Set-Cookie':[`admin_session=${encodeURIComponent(t)}; HttpOnly; SameSite=Strict; Path=/`,`admin_csrf=${encodeURIComponent(csrf)}; SameSite=Strict; Path=/`]})};
const loginAttempts=new Map();
function loginKey(req,account){return `${req.socket.remoteAddress||'local'}:${String(account||'').slice(0,120)}`}
function limited(req,account){const now=Date.now(),entry=loginAttempts.get(loginKey(req,account));if(!entry||now-entry.started>15*60*1000)return false;return entry.count>=5&&now-entry.last<5*60*1000}
function failed(req,account){const now=Date.now(),key=loginKey(req,account),entry=loginAttempts.get(key);if(!entry||now-entry.started>15*60*1000)loginAttempts.set(key,{started:now,last:now,count:1});else{entry.last=now;entry.count++}}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);if(p==='/api/status')return json(res,200,{initialized:core.read().users.length>0});
 if(p==='/api/setup'&&req.method==='POST'){if(core.read().users.length)return json(res,403,{error:'主管理员已经创建，请直接登录。'});const d=JSON.parse((await body(req)).toString()||'{}');core.initialize(String(d.account||'').trim(),d.password,d.name);const t=core.login(String(d.account||'').trim(),d.password);return session(res,t,core.auth(t))}
 if(p==='/api/login'&&req.method==='POST'){const d=JSON.parse((await body(req)).toString()||'{}');if(limited(req,d.account))return json(res,429,{error:'登录尝试过多，请 5 分钟后再试。'});const t=core.login(d.account,d.password);if(!t){failed(req,d.account);return json(res,401,{error:'账号或密码错误，或账号已停用。'})}loginAttempts.delete(loginKey(req,d.account));return session(res,t,core.auth(t))}
 if(p==='/api/logout'&&req.method==='POST'){if(!protectWrite(req,res))return;core.logout(token(req));return json(res,200,{ok:true},{'Set-Cookie':['admin_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/','admin_csrf=; Max-Age=0; SameSite=Strict; Path=/']})}
 if(p==='/api/me'&&req.method==='GET'){const user=protect(req,res);if(!user)return;return json(res,200,{user})}
 if(p==='/api/password'&&req.method==='POST'){if(!protectWrite(req,res))return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{user:core.changePassword(token(req),d.oldPassword,d.newPassword)})}
 if(p==='/api/users'&&req.method==='GET'){const user=protect(req,res);if(!user)return;return json(res,200,{users:core.listUsers(user)})}
 if(p==='/api/users'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;return json(res,201,{user:core.createUser(user,JSON.parse((await body(req)).toString()||'{}'))})}
 let u=p.match(/^\/api\/users\/([^/]+)(\/password)?$/);if(u&&['POST','DELETE'].includes(req.method)){const user=protectWrite(req,res);if(!user)return;if(req.method==='DELETE'){core.removeUser(user,u[1]);return json(res,200,{ok:true})}const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{user:u[2]?core.resetUserPassword(user,u[1],d.password):core.updateUser(user,u[1],d)})}
 if(p==='/api/leads'&&req.method==='GET'){const user=protect(req,res);if(!user)return;return json(res,200,{leads:core.listLeads(user)})}
 let l=p.match(/^\/api\/leads\/([^/]+)$/);if(l&&['POST','DELETE'].includes(req.method)){const user=protectWrite(req,res);if(!user)return;if(req.method==='DELETE'){core.removeLead(user,l[1]);return json(res,200,{ok:true})}return json(res,200,{lead:core.updateLead(user,l[1],JSON.parse((await body(req)).toString()||'{}'))})}
 if(p==='/api/records'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{records:core.list()})}
 if(p==='/api/backup'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;if(!core.can(user,'backup'))return json(res,403,{error:'你的账号没有备份权限。'});return json(res,200,{ok:true,path:core.backup()})}
 if(p==='/api/records'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{record:core.saveRecord(d,user)})}
 let m=p.match(/^\/api\/records\/([^/]+)\/(publish|offline)$/);if(m&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;return json(res,200,{record:m[2]==='publish'?core.publish(m[1],user):core.offline(m[1],user)})}
 m=p.match(/^\/api\/records\/([^/]+)$/);if(m&&req.method==='DELETE'){const user=protectWrite(req,res);if(!user)return;core.remove(m[1],user);return json(res,200,{ok:true})}
 if(p==='/api/schema'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{schema:{LANGS:schema.LANGS,TYPES:schema.TYPES}})}
 if(p==='/api/options'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{options:core.listOptions()})}
 if(p==='/api/options'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{options:core.saveOptions(user,d)})}
 if(p==='/api/order'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{records:core.setOrder(user,d.type,d.ids)})}
 if(p==='/api/upload'&&req.method==='POST'){const user=protectWrite(req,res);if(!user)return;const type=String(req.headers['content-type']||'');if(!type.includes('application/json'))return streamUpload(req,res);const d=JSON.parse((await body(req)).toString()||'{}');const bytes=Buffer.from(String(d.base64||''),'base64');return json(res,201,{file:core.file(d.name,bytes)})}
 m=p.match(/^\/media\/([^/]+)$/);if(m){const f=core.filePath(m[1]);if(!fs.existsSync(f))return json(res,404,{error:'文件不存在。'});if(!protect(req,res))return;const ext=path.extname(f).toLowerCase(),mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext]||'application/octet-stream';const headers={'Content-Type':mime,'X-Content-Type-Options':'nosniff'};if(!['.jpg','.jpeg','.png','.webp','.mp4','.pdf'].includes(ext))headers['Content-Disposition']='attachment';res.writeHead(200,headers);return fs.createReadStream(f).pipe(res)}
 if(assets[p]){const [type,data]=assets[p];res.writeHead(200,{'Content-Type':type});return res.end(data)}json(res,404,{error:'不存在。'});
}catch(e){json(res,e.status||400,{error:e.message||'请求失败。'})}});
// 启动时清理一次没用的上传文件，之后每天一次（M10）
const cleanupUploads=()=>{try{const result=core.cleanupUploads();if(result.removed.length)console.log(`已清理 ${result.removed.length} 个没被用到的上传文件`)}catch(error){console.error('清理上传文件失败：'+error.message)}};
server.listen(port,'127.0.0.1',()=>{console.log(`后台 http://127.0.0.1:${port}`);cleanupUploads()});
setInterval(cleanupUploads,24*60*60*1000).unref();
