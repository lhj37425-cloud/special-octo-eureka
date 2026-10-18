// Static assets only. No authentication, upload, content or account API.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const files={'/':'index.html','/index.html':'index.html','/demo.css':'demo.css','/demo.js':'demo.js','/store.js':'store.js','/bridge.html':'bridge.html'};
for(const port of [4186,4187]){
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=files[url.pathname];if(!file||!['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end('Not found')}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]);res.setHeader('Cache-Control','no-store');fs.readFile(path.join(__dirname,file),(err,data)=>{if(err){res.writeHead(500);return res.end('Static file unavailable')}res.end(req.method==='HEAD'?undefined:data)})});
 server.on('error',e=>{console.error(`Port ${port}: ${e.message}. Please close the conflicting demo or change both demo addresses.`);process.exit(1)});server.listen(port,'127.0.0.1',()=>console.log(`${port===4187?'ADMIN':'PUBLIC'} http://127.0.0.1:${port}`));
}
