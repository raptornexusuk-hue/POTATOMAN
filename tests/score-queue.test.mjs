import assert from 'node:assert/strict';
import {ScoreQueue} from '../dist/score-queue.js';
const values=new Map(),storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const item=(run,revision=1)=>({run,token:'test',start:{level:0,duration:120,mode:'solo'},payload:{revision,points:10}});
let release;const sent=[];const q=new ScoreQueue(storage,async(path,payload)=>{sent.push([path,payload]);if(path.endsWith('/save')){await new Promise(r=>release=r);return{saved:true,revision:payload.revision};}return{run:payload.run};});
q.put(item('a'));const pending=q.flush();await new Promise(setImmediate);q.put(item('a',2));release();await pending;assert.equal(q.items.a.payload.revision,2);assert.equal(JSON.parse(storage.getItem('potatoman.pending.score.a')).payload.revision,2);
const q2=new ScoreQueue(storage,async()=>{});q2.put(item('b'));assert.ok(storage.getItem('potatoman.pending.score.a'));assert.ok(storage.getItem('potatoman.pending.score.b'));
const q3=new ScoreQueue(storage,async(path,p)=>{if(p.run==='a')throw Error('Rejected');return{saved:true,revision:p.revision};});await assert.rejects(q3.flush());assert.ok(q3.items.a);assert.equal(q3.items.b,undefined);assert.equal(storage.getItem('potatoman.pending.score.b'),undefined);
console.log('PASS queued newer progress survives older acknowledgments, separate tabs retain runs, rejected records do not block later saves');
