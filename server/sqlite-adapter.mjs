import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
export async function openDatabase(filename,migrations=new URL('../drizzle/',import.meta.url)){
 const db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys = ON');db.exec('PRAGMA journal_mode = WAL');
 db.exec('CREATE TABLE IF NOT EXISTS _potatoman_migrations (name TEXT PRIMARY KEY)');
 for(const file of(await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort())if(!db.prepare('SELECT name FROM _potatoman_migrations WHERE name=?').get(file)){
  db.exec('BEGIN');try{db.exec(await readFile(new URL(file,migrations),'utf8'));db.prepare('INSERT INTO _potatoman_migrations(name) VALUES(?)').run(file);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 const api={prepare(sql){const statement=db.prepare(sql);return{args:[],bind(...args){this.args=args;return this;},first(){return statement.get(...this.args)??null;},all(){return{results:statement.all(...this.args)};},run(){return statement.run(...this.args);}};},batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}},close(){db.close();}};return api;
}
