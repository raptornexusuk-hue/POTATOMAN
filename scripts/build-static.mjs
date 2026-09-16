// Produce a folder that can be uploaded as-is to ordinary web hosting (IONOS webspace, or any
// other plain file host). No build step is applied to the game itself: dist/ is the source, the
// browser loads it as ES modules, so this only selects the files a visitor needs and adds the
// server configuration a shared Apache host understands.
import {mkdir,cp,rm,readdir,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';

const OUT='build/web';
await rm(OUT,{recursive:true,force:true});await mkdir(OUT,{recursive:true});
for(const entry of await readdir('dist',{withFileTypes:true})){
 if(entry.name==='client')continue;
 if(entry.isDirectory()?entry.name==='assets':/\.(html|js|css)$/.test(entry.name))await cp(join('dist',entry.name),join(OUT,entry.name),{recursive:true});
}
// Long-lived caching for the fingerprint-free asset folder would strand visitors on a stale build,
// so assets are cached for a day and the code is revalidated every load.
await writeFile(join(OUT,'.htaccess'),`# Potatoman — plain web hosting
Options -Indexes
DirectoryIndex index.html
AddType text/javascript .js
AddType audio/mpeg .mp3
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/json image/svg+xml
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/png "access plus 1 day"
  ExpiresByType image/jpeg "access plus 1 day"
  ExpiresByType audio/mpeg "access plus 1 day"
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(html|js|css)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`);
let bytes=0,files=0;
const walk=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);
 if(entry.isDirectory())await walk(path);else{files++;bytes+=(await stat(path)).size;}}};
await walk(OUT);
console.log(`Static site ready in ${OUT}: ${files} files, ${(bytes/1048576).toFixed(1)} MB.`);
console.log('Upload the CONTENTS of that folder to the web root for your domain.');
