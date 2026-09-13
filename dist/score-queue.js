// One recovery record per run avoids overwriting another tab's pending score.
const PREFIX='potatoman.pending.score.';
export class ScoreQueue {
 constructor(storage,send){this.storage=storage;this.send=send;this.items={};this.busy=null;this.read();}
 read(){try{for(let i=0;i<this.storage?.length;i++){const key=this.storage.key(i);if(!key?.startsWith(PREFIX))continue;const item=JSON.parse(this.storage.getItem(key));if(item?.run&&item?.payload&&(!this.items[item.run]||item.payload.revision>this.items[item.run].payload.revision))this.items[item.run]=item;}}catch{} }
 put(item){const previous=this.items[item.run];if(!previous||item.payload.revision>previous.payload.revision){this.items[item.run]=structuredClone(item);try{this.storage?.setItem(PREFIX+item.run,JSON.stringify(item));}catch{}}}
 async flush(keepalive=false){if(this.busy)return this.busy;this.read();this.busy=(async()=>{let failure;for(const item of Object.values(this.items)){try{await this.send('scores/start',{playerToken:item.token,run:item.run,...item.start},keepalive);const ack=await this.send('scores/save',{playerToken:item.token,run:item.run,...item.payload},keepalive);if(ack.saved&&this.items[item.run]?.payload.revision<=ack.revision){delete this.items[item.run];try{const stored=JSON.parse(this.storage?.getItem(PREFIX+item.run)||'null');if(stored?.payload.revision<=ack.revision)this.storage.removeItem(PREFIX+item.run);}catch{}}}catch(e){failure=e;}}if(failure)throw failure;})();try{await this.busy;}finally{this.busy=null;}}
}
