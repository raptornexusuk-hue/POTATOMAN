// Portable deployment: Node 22.13+ and a persistent disk; no third-party runtime packages.
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import worker from './index.js';
import {openDatabase} from './sqlite-adapter.mjs';
const dataDir=resolve(process.env.POTATOMAN_DATA_DIR||'data');await mkdir(dataDir,{recursive:true});
const DB=await openDatabase(resolve(dataDir,'rooms.sqlite'));
const publicRoot=resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.txt':'text/plain','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const ASSETS={async fetch(request){const pathname=decodeURIComponent(new URL(request.url).pathname),path=resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(publicRoot+sep)||!types[extname(path)]||path.includes(sep+'server'+sep)||path.includes(sep+'.openai'+sep))return new Response('Not found',{status:404});try{return new Response(await readFile(path),{headers:{'content-type':types[extname(path)],'cache-control':'no-cache'}});}catch{return new Response('Not found',{status:404});}}};
createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>110000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}const origin=process.env.POTATOMAN_PUBLIC_ORIGIN||`http://${req.headers.host}`,url=new URL(req.url,origin);const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await worker.fetch(request,{DB,ASSETS});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Server error');}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Potatoman server ready.'));
