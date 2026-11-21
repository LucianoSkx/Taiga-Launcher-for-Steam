import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Providers} from '../lib/providers.mjs';
import {normalize} from '../lib/files.mjs';
test('Missing API credentials are optional: no nagging errors, free sources instead',async t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-freecache-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const p=new Providers(()=>({}),dir);p.requestText=async()=>JSON.stringify({tree:[]});const r=await p.candidates('Dragon Ball Z Shin Budokai');assert.equal(r.errors.length,0,'1.6.0: sem chaves, sem avisos, usa fontes gratuitas');assert.deepEqual(r.sgdb,[]);assert.deepEqual(r.free,[]);});
test('PSP title punctuation and trademarks do not prevent exact matching',async t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-providers-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const p=new Providers(()=>({sgdbKey:'mock',igdbId:'mock',igdbSecret:'mock',raKey:'mock'}),dir);let query='';p.sg=async()=>[{id:1,name:'Dragon Ball Z: Shin Budokai'}];p.ig=async q=>{query=q;return [{id:2,name:'Dragon Ball Z: Shin Budokai',summary:'PSP game'}];};p.ra=async()=>[{ID:3,Title:'Dragon Ball Z: Shin Budokai'}];const r=await p.candidates('Dragon Ball Z™ Shin Budokai');assert.equal(r.errors.length,0);assert.equal(r.ra.length,1);assert.equal(normalize(r.igdb[0].name),normalize('Dragon Ball Z Shin Budokai'));assert.ok(!query.includes('™'));assert.ok(query.includes('platforms = (38)'));});
test('IGDB artwork fallback and provider failures remain explicit',async()=>{const p=new Providers(()=>({}),'/tmp/unused');p.translate=async text=>text;p.image=async url=>{assert.equal(url,'https://images.igdb.com/igdb/image/upload/t_cover_big/a.jpg');return 'mock.jpg';};const g={};assert.deepEqual(await p.enrich(g,{igdb:{id:1,name:'Game',summary:'Description',cover:{url:'//images.igdb.com/igdb/image/upload/t_thumb/a.jpg'}}}),[]);assert.equal(g.art.cover,'mock.jpg');assert.equal(g.metadata.summary,'Description');p.sg=async()=>[];const warnings=await p.enrich(g,{sgdb:{id:2}});assert.ok(warnings.some(w=>w.includes('nenhuma capa')));});

test('Libretro thumbnails come from the official per-console repos, not the empty legacy CDN', async t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taiga-libretro-'));
 t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
 const p = new Providers(() => ({}), dir, {offline: false});
 let requested = '';
 p.requestText = async url => {
  requested = url;
  return JSON.stringify({truncated: false, tree: [
   {path: 'Named_Boxarts/Super Mario Bros. (USA).png'},
   {path: 'Named_Boxarts/Kirby (USA).png'},
   {path: 'Named_Snaps/Super Mario Bros. (USA).png'},
   {path: 'Named_Logos/dump.crc'}
  ]});
 };
 const names = await p.libretroListing('Nintendo - Nintendo Entertainment System', 'Named_Boxarts');
 assert.deepEqual(names, ['Super Mario Bros. (USA)', 'Kirby (USA)']);
 assert.match(requested, /^https:\/\/api\.github\.com\/repos\/libretro-thumbnails\/Nintendo_-_Nintendo_Entertainment_System\/git\/trees\/master\?recursive=1$/);
 const gallery = await p.libretroListing('Nintendo - Nintendo Entertainment System', 'Named_Snaps');
 assert.deepEqual(gallery, ['Super Mario Bros. (USA)']);
 assert.equal(requested, 'https://api.github.com/repos/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/git/trees/master?recursive=1', 'a árvore é buscada uma vez por sistema');
 await p.libretroArt({title: 'Super Mario Bros.', platformKey: 'nes', region: ['USA'], metadata: {}, art: {}});
});
