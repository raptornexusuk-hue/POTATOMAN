import {defineConfig} from 'vite';
import {mkdir} from 'node:fs/promises';
import worker from './server/index.js';
import {openDatabase} from './server/sqlite-adapter.mjs';

export default defineConfig({
 root:'dist',server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
 plugins:[{name:'potatoman-preview-api',async configureServer(server){
  await mkdir('data',{recursive:true});const DB=await openDatabase('data/preview.sqlite');
  server.httpServer?.once('close',()=>DB.close());
  server.middlewares.use(async(req,res,next)=>{
   if(!req.url.startsWith('/api/'))return next();
   try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>110000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   }catch(e){res.writeHead(500);res.end(JSON.stringify({error:'Preview request failed.'}));console.error(e.message);}
  });
 }}]
});
