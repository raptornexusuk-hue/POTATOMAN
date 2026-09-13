import {mkdir,cp,rm,readdir} from 'node:fs/promises';
await rm('dist/client',{recursive:true,force:true});await mkdir('dist/client',{recursive:true});
for(const f of await readdir('dist',{withFileTypes:true}))if((f.isFile()&&/\.(html|js|css)$/.test(f.name))||f.name==='assets')await cp(`dist/${f.name}`,`dist/client/${f.name}`,{recursive:true});
await mkdir('dist/server',{recursive:true});await cp('server/index.js','dist/server/index.js');await cp('server/profiles.js','dist/server/profiles.js');
await mkdir('dist/.openai',{recursive:true});await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built game assets, online room Worker and database migrations.');
