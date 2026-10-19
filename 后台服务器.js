const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const core=require('./后台服务.cjs');
const port=Number(process.env.ADMIN_PORT||4181);
const html=fs.readFileSync(path.join(__dirname,'admin-demo','index.html'),'utf8');
const assets={
 '/': ['text/html; charset=utf-8',html], '/index.html':['text/html; charset=utf-8',html],
 '/demo.css':['text/css; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','demo.css'))],
 '/demo.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'后台管理界面.js'))],
 '/store.js':['text/javascript; charset=utf-8',fs.readFileSync(path.join(__dirname,'admin-demo','store.js'))]
};
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))};
const cookie=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const body=req=>new Promise((resolve,reject)=>{let a=[],n=0;req.on('data',b=>{n+=b.length;if(n>35*1024*1024)reject(Error('请求过大'));else a.push(b)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)});
const token=req=>cookie(req).admin_session||'';
const protect=(req,res)=>{if(!core.auth(token(req))){json(res,401,{error:'请先登录。'});return false}return true};
const protectWrite=(req,res)=>{if(!protect(req,res))return false;const csrf=cookie(req).admin_csrf||'';if(!csrf||req.headers['x-csrf-token']!==csrf){json(res,403,{error:'安全校验失效，请重新登录。'});return false}return true};
const loginAttempts=new Map();
function loginKey(req,account){return `${req.socket.remoteAddress||'local'}:${String(account||'').slice(0,120)}`}
function limited(req,account){const now=Date.now(),entry=loginAttempts.get(loginKey(req,account));if(!entry||now-entry.started>15*60*1000)return false;return entry.count>=5&&now-entry.last<5*60*1000}
function failed(req,account){const now=Date.now(),key=loginKey(req,account),entry=loginAttempts.get(key);if(!entry||now-entry.started>15*60*1000)loginAttempts.set(key,{started:now,last:now,count:1});else{entry.last=now;entry.count++}}
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);if(p==='/api/status')return json(res,200,{initialized:!!core.read().admin});
 if(p==='/api/login'&&req.method==='POST'){const d=JSON.parse((await body(req)).toString()||'{}');if(limited(req,d.account))return json(res,429,{error:'登录尝试过多，请 5 分钟后再试。'});const t=core.login(d.account,d.password),csrf=crypto.randomBytes(24).toString('base64url');if(!t){failed(req,d.account);return json(res,401,{error:'账号或密码错误。'})}loginAttempts.delete(loginKey(req,d.account));return json(res,200,{ok:true,csrf},{'Set-Cookie':[`admin_session=${encodeURIComponent(t)}; HttpOnly; SameSite=Strict; Path=/`,`admin_csrf=${encodeURIComponent(csrf)}; SameSite=Strict; Path=/`]})}
 if(p==='/api/logout'&&req.method==='POST'){if(!protectWrite(req,res))return;core.logout(token(req));return json(res,200,{ok:true},{'Set-Cookie':['admin_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/','admin_csrf=; Max-Age=0; SameSite=Strict; Path=/']})}
 if(p==='/api/records'&&req.method==='GET'){if(!protect(req,res))return;return json(res,200,{records:core.list()})}
 if(p==='/api/backup'&&req.method==='POST'){if(!protectWrite(req,res))return;return json(res,200,{ok:true,path:core.backup()})}
 if(p==='/api/records'&&req.method==='POST'){if(!protectWrite(req,res))return;const d=JSON.parse((await body(req)).toString()||'{}');return json(res,200,{record:core.saveRecord(d)})}
 let m=p.match(/^\/api\/records\/([^/]+)\/(publish|offline)$/);if(m&&req.method==='POST'){if(!protectWrite(req,res))return;return json(res,200,{record:m[2]==='publish'?core.publish(m[1]):core.offline(m[1])})}
 m=p.match(/^\/api\/records\/([^/]+)$/);if(m&&req.method==='DELETE'){if(!protectWrite(req,res))return;core.remove(m[1]);return json(res,200,{ok:true})}
 if(p==='/api/upload'&&req.method==='POST'){if(!protectWrite(req,res))return;const d=JSON.parse((await body(req)).toString()||'{}');const bytes=Buffer.from(String(d.base64||''),'base64');return json(res,201,{file:core.file(d.name,bytes,d.mime)})}
 m=p.match(/^\/media\/([^/]+)$/);if(m){const f=core.filePath(m[1]);if(!fs.existsSync(f))return json(res,404,{error:'文件不存在。'});if(!protect(req,res))return;res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment'});return fs.createReadStream(f).pipe(res)}
 if(assets[p]){const [type,data]=assets[p];res.writeHead(200,{'Content-Type':type});return res.end(data)}json(res,404,{error:'不存在。'});
}catch(e){json(res,400,{error:e.message||'请求失败。'})}}).listen(port,'127.0.0.1',()=>console.log(`后台 http://127.0.0.1:${port}`));
