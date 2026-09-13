import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{
 code:text('code').primaryKey(),created:integer('created').notNull(),updated:integer('updated').notNull(),status:text('status').notNull().default('lobby'),snapshot:text('snapshot'),seq:integer('seq').notNull().default(0)
},t=>[index('idx_rooms_updated').on(t.updated)]);
export const members=sqliteTable('members',{
 room:text('room').notNull().references(()=>rooms.code,{onDelete:'cascade'}),slot:integer('slot').notNull(),token:text('token').notNull(),generation:text('generation').notNull().default(''),name:text('name').notNull(),seen:integer('seen').notNull(),input:text('input'),inputSeq:integer('input_seq').notNull().default(0)
},t=>[primaryKey({columns:[t.room,t.slot]})]);
export const signals=sqliteTable('signals',{
 room:text('room').notNull().references(()=>rooms.code,{onDelete:'cascade'}),sender:integer('sender').notNull(),recipient:integer('recipient').notNull(),description:text('description').notNull()
},t=>[primaryKey({columns:[t.room,t.sender,t.recipient]})]);
export const profiles=sqliteTable('profiles',{
 id:text('id').primaryKey(),token:text('token').notNull(),name:text('name').notNull(),motto:text('motto').notNull().default(''),created:integer('created').notNull()
},t=>[index('idx_profiles_token').on(t.token)]);
export const runs=sqliteTable('runs',{
 id:text('id').primaryKey(),profile:text('profile').notNull().references(()=>profiles.id,{onDelete:'cascade'}),started:integer('started').notNull(),finished:integer('finished'),startLevel:integer('start_level').notNull(),roundSeconds:integer('round_seconds').notNull(),mode:text('mode').notNull(),score:integer('score').notNull().default(0),rounds:integer('rounds').notNull().default(0),wins:integer('wins').notNull().default(0),knockouts:integer('knockouts').notNull().default(0),complete:integer('complete').notNull().default(0),points:integer('points').notNull().default(0),playedMs:integer('played_ms').notNull().default(0),revision:integer('revision').notNull().default(0)
},t=>[index('idx_runs_profile').on(t.profile),index('idx_runs_complete_score').on(t.complete,t.score)]);
export const raceTimes=sqliteTable('race_times',{
 run:text('run').notNull().references(()=>runs.id,{onDelete:'cascade'}),level:integer('level').notNull(),milliseconds:integer('milliseconds').notNull()
},t=>[primaryKey({columns:[t.run,t.level]}),index('idx_race_times_level_time').on(t.level,t.milliseconds)]);
