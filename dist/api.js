// A game served from plain web hosting (IONOS webspace and the like) can serve every file the game
// needs but cannot run the small service behind /api, so rooms and shared scores have nowhere to
// go. Pointing the game at a host that can run it is the whole fix: set POTATOMAN_API in config.js,
// or a <meta name="potatoman-api"> tag. With neither, the game talks to its own origin as before.
const declared=()=>{
 if(typeof globalThis.POTATOMAN_API==='string')return globalThis.POTATOMAN_API;
 try{return document.querySelector('meta[name="potatoman-api"]')?.content??'';}catch{return '';}
};
// A trailing slash, a bare hostname or a stray path would all silently produce unreachable URLs.
export function apiBase(){const raw=String(declared()??'').trim().replace(/\/+$/,'');return /^https?:\/\/[^/]/.test(raw)?raw:'';}
export const apiURL=path=>`${apiBase()}/api/${String(path).replace(/^\/+/,'')}`;
// True when the service lives somewhere other than the page itself, which is what the operator has
// to allow on the server side and what the menus explain when a room cannot be reached.
export function apiRemote(){const base=apiBase();if(!base)return false;try{return base!==location.origin;}catch{return true;}}
