import {clientSource} from './locale-harness.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';
import {createApp} from '../server.mjs';import {sweepGames} from '../lib/games.mjs';
test('Reference model filters combine platforms, retain searchable choices, and categorize real library states',async()=>{
 const elements=new Map(),listeners={};const el=()=>({innerHTML:'',style:{},hidden:false,classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},querySelector(){return null},querySelectorAll(){return []}});for(const id of ['#app','#layer','#operation','#operation-text','#toasts'])elements.set(id,el());const document={querySelector:s=>s==='meta[name=taiga-token]'?{content:'test'}:elements.get(s)||null,querySelectorAll:()=>[],body:el(),activeElement:el(),addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),documentElement:{dataset:{},removeAttribute(){}}};
 const game=(id,title,profile,platformName,emulatorName)=>({id,title,profile,platformName,emulatorName,inSteam:true,metadata:{summary:'Descrição de exemplo',summaryLanguage:'pt'},art:{},bytes:1000});const state={games:[game('1','PSP Game','psp','PlayStation Portable','PPSSPP'),game('2','PC Game','pc','PC (Microsoft Windows)','Windows'),game('3','SNES Game','retroarch','Super Nintendo Entertainment System','RetroArch')],hiddenGames:[],settings:{languageChosen:true,roots:[],accounts:[],preferences:{scanOnStart:false},readiness:{steam:true,account:true},profiles:{pc:{name:'Windows',platform:'PC (Microsoft Windows)'}}}};
 const c=vm.createContext({document,window:{scrollY:0,scrollTo(){},addEventListener(){}},fetch:async()=>({ok:true,json:async()=>state}),structuredClone,setTimeout,clearTimeout,console});vm.runInContext(clientSource(),c);await new Promise(r=>setTimeout(r,0));
 vm.runInContext("UI.plats=['PlayStation Portable','Super Nintendo Entertainment System']",c);assert.deepEqual(Array.from(vm.runInContext('visibleCollection().map(g=>g.id)',c)),['1','3']);
 vm.runInContext("S.games.push({id:'store',title:'Store Game',profile:'store',platformName:'PC (Microsoft Windows)',inSteam:false,storeLabel:'GOG',storeName:'GOG',metadata:{},art:{},bytes:0})",c);assert.deepEqual(Array.from(vm.runInContext('visibleCollection().map(g=>g.id)',c)),['1','3'],'jogo fora da Steam não entra na coleção');vm.runInContext("UI.storeTab='gog'",c);assert.ok(vm.runInContext('storesView()',c).includes('Store Game'),'jogo da loja continua na aba Lojas');
 vm.runInContext("S.games.push({id:'emu',title:'Emu Game',profile:'psp',platformName:'PlayStation Portable',inSteam:false,metadata:{},art:{},bytes:0});UI.emu='psp'",c);assert.deepEqual(Array.from(vm.runInContext('visibleCollection().map(g=>g.id)',c)),['1','emu'],'Ver jogos do emulador mostra jogos fora da Steam');
 vm.runInContext("UI.platQ='ppsspp'",c);const popup=vm.runInContext('platPop(S.games)',c);assert.ok(popup.includes('data-plat="PC (Microsoft Windows)"'));assert.ok(popup.includes('data-plat="PlayStation Portable"'));assert.ok(popup.includes('data-n="psp · playstation portable ppsspp"'));assert.ok(!popup.includes('disabled>')); // Selection stays usable.
 vm.runInContext("S.nativeGames=[{id:'a',title:'Installed',installed:true,art:{}},{id:'b',title:'Owned',art:{}},{id:'c',title:'Shortcut',shortcut:true,installed:true,art:{}}];UI.ownedF='installed'",c);let html=vm.runInContext('ownedView()',c);assert.ok(html.includes('data-id="a"'));assert.ok(!html.includes('data-id="b"'));assert.ok(!html.includes('data-id="c"'));assert.ok(html.includes('Personalizar'));
 vm.runInContext("UI.ownedF='shortcut'",c);html=vm.runInContext('ownedView()',c);assert.ok(html.includes('data-id="c"'));assert.ok(!html.includes('data-id="a"'));
 vm.runInContext("S.games[0].inSteam=true;S.games[0].syncNeeded=true;UI.steamQ='';selection.clear()",c);html=vm.runInContext('steamView()',c);assert.ok(html.includes('Atualização pendente'));assert.ok(!html.includes('class="batch-bar"'));vm.runInContext("selection.add('1')",c);assert.ok(vm.runInContext('steamView()',c).includes('class="batch-bar"'));
 vm.runInContext('addGameDialog()',c);assert.ok(elements.get('#layer').innerHTML.includes('data-act="shortcut-guide"'));assert.ok(elements.get('#layer').innerHTML.includes('data-act="import-files"'));assert.ok(elements.get('#layer').innerHTML.includes('data-act="import-folder"'));
});

test('Consoles tab only shows emulators that have a ROM folder', async () => {
 const elements=new Map(),el=()=>({innerHTML:'',style:{},hidden:false,classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},querySelector(){return null},querySelectorAll(){return []}});for(const id of ['#app','#layer','#operation','#operation-text','#toasts'])elements.set(id,el());
 const document={querySelector:s=>s==='meta[name=taiga-token]'?{content:'token'}:elements.get(s)||null,querySelectorAll:()=>[],body:el(),activeElement:el(),addEventListener(){},documentElement:{dataset:{},removeAttribute(){}}};
 const state={games:[],hiddenGames:[],settings:{languageChosen:true,roots:[],accounts:[],preferences:{scanOnStart:false},readiness:{steam:true,account:true},profiles:{}}};
 const c=vm.createContext({document,window:{scrollY:0,scrollTo(){},addEventListener(){}},fetch:async()=>({ok:true,json:async()=>state}),structuredClone,setTimeout,clearTimeout,console});vm.runInContext(clientSource(),c);await new Promise(r=>setTimeout(r,0));
 vm.runInContext("S.games=[{id:'psp1',title:'PSP Game',profile:'psp',platformName:'PlayStation Portable',inSteam:false,metadata:{},art:{},bytes:1},{id:'ps2',title:'PS2 Game',profile:'ps2',platformName:'PlayStation 2',inSteam:false,metadata:{},art:{},bytes:1}];UI.emuList=[{profile:'psp',name:'PPSSPP',found:true,folders:['/roms/psp'],platforms:['PlayStation Portable']},{profile:'ps2',name:'PCSX2',found:true,folders:[],platforms:['PlayStation 2']}];UI.consoleTab='psp'",c);
 const html=vm.runInContext('consolesView()',c);
 assert.match(html,/PSP Game/);
 assert.doesNotMatch(html,/PCSX2/,'emulador sem pasta de ROMs não ganha aba');
});

test('Install actions open the store and diagnostics redacts store cookies', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-audit-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const secret='COOKIE_SEGREDO_123';
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({adminToken:'admin-t',readToken:'read-t',account:'1',gogAuth:{username:'tester',cookies:[{name:'session',value:secret}]}}));
 fs.writeFileSync(path.join(dir,'games.json'),JSON.stringify({version:1,games:[{id:'g1',uuid:'u1',title:'Jogo Teste',path:'/tmp/jogo.exe',profile:'pc',notInstalled:true,store:{name:'epic',slug:'jogo-teste'}}]}));
 const port=48931,{server}=createApp({dataDir:dir,port});
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
 t.after(()=>new Promise(ok=>server.close(ok)));
 const base='http://127.0.0.1:'+port,headers={Authorization:'Bearer admin-t','Content-Type':'application/json'};
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,200);return await r.json();};
 const oldPath=process.env.PATH;process.env.PATH='';
 try{
  assert.deepEqual(await post('store-install',{id:'g1'}),{state:'external',store:'epic'});
  for(const route of ['store-install-pause','store-install-cancel'])assert.equal((await post(route,{id:'g1'})).state,'external');
  const report=(await post('diagnostics',{})).report;
  assert.equal(report.config.gogAuth.username,'tester');
  assert.ok(!JSON.stringify(report).includes(secret),'cookies da GOG não podem vazar no diagnóstico');
 } finally { process.env.PATH=oldPath; }
});

test('importInstalled forwards the profile as consoleOnly to import-confirm', async () => {
 const elements=new Map(),el=()=>({innerHTML:'',style:{},hidden:false,classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},querySelector(){return null},querySelectorAll(){return []}});
 for(const id of ['#app','#layer','#operation','#operation-text','#toasts'])elements.set(id,el());
 const document={querySelector:s=>s==='meta[name=taiga-token]'?{content:'test'}:elements.get(s)||null,querySelectorAll:()=>[],body:el(),activeElement:el(),addEventListener(){},documentElement:{dataset:{},removeAttribute(){}}};
 const state={games:[],hiddenGames:[],settings:{languageChosen:true,roots:[],accounts:[],preferences:{scanOnStart:false},readiness:{steam:true,account:true},profiles:{}}};
 const calls=[];
 const fetchMock=async(url,opts={})=>{
  const route=String(url).replace(/^\/api\//,''),body=opts.body?JSON.parse(opts.body):{};calls.push({route,body});
  if(route==='scan')return {ok:true,json:async()=>({scanId:'s1',items:[{path:'/roms/a.cue',title:'A',profile:'ps1'}],existing:[]})};
  if(route==='import-resolve')return {ok:true,json:async()=>({items:(body.paths||[]).map(p=>({path:p,title:'A',profile:'ps1'}))})};
  if(route==='import-confirm')return {ok:true,json:async()=>({addedIds:['x']})};
  if(route==='import-finish')return {ok:true,json:async()=>({})};
  return {ok:true,json:async()=>state};
 };
 const c=vm.createContext({document,window:{scrollY:0,scrollTo(){},addEventListener(){}},fetch:fetchMock,structuredClone,setTimeout,clearTimeout,console});
 vm.runInContext(clientSource(),c);await new Promise(r=>setTimeout(r,0));
 await vm.runInContext("importInstalled([{path:'/roms/a.cue',title:'A'}],{profile:'ps1'})",c);
 let confirm=calls.find(x=>x.route==='import-confirm');
 assert.equal(confirm.body.consoleOnly,true);assert.equal(confirm.body.items[0].profile,'ps1');
 calls.length=0;
 await vm.runInContext("importInstalled([{path:'/roms/a.cue',title:'A'}])",c);
 confirm=calls.find(x=>x.route==='import-confirm');assert.equal(confirm.body.consoleOnly,false);
});

test('Automatic discovery follows symlinked ROM folders without looping', t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-sweep-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const real=path.join(dir,'real','psp');fs.mkdirSync(real,{recursive:true});
 const rom=path.join(real,'jogo.iso');fs.writeFileSync(rom,Buffer.alloc(20000));
 fs.symlinkSync(path.join(dir,'real'),path.join(dir,'link'),'dir');
 fs.symlinkSync(path.join(dir,'link'),path.join(dir,'loop'),'dir');
 const found=sweepGames([dir]);
 assert.ok(found.some(f=>/link[\\/]psp[\\/]jogo\.iso$/.test(f)),'ROM em pasta symlinkada deve ser descoberta');
 assert.equal(found.filter(f=>f.endsWith('jogo.iso')).length,1,'link circular não duplica a ROM');
});

test('Choice art never returns a broken image when no preview exists', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/const placeholder=\(\)=>\{const svg=/);
 assert.match(server,/if\(!name\)return placeholder\(\)/);
 assert.doesNotMatch(server,/if\(!url\)return fail\(\)/);
});

test('Libretro option images are proxied through the local server', () => {
 const external=fs.readFileSync(new URL('../lib/external.mjs',import.meta.url),'utf8');
 assert.match(external,/item\.free\?\.url\)return ''/);
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/option\.free\?\.url\)\{name=await providers\.image\(option\.free\.url\)/);
 const providers=fs.readFileSync(new URL('../lib/providers.mjs',import.meta.url),'utf8');
 assert.match(providers,/preview='\/art\/'/);
});

test('Profile reassignment never re-adds console-only ROMs to Steam', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/if\(!g\.consoleOnly&&!g\.bindings\?\.\[config\.account\]/);
});

test('Deferred ROM import does not bind AppIDs or auto-add to Steam', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/if\(body\.consoleOnly\)g\.consoleOnly=true/);
 assert.match(server,/job\.link!==false&&!g\.consoleOnly\)await autoSteamLink/);
 assert.match(server,/autoAddToSteam\(ids\.filter\(id=>!db\.games\.find\(x=>x\.id===id\)\?\.consoleOnly\)\)/);
});

test('ROM imports stay in Consoles until the user adds them to Steam', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/body\.consoleOnly\?null:await autoAddToSteam/);
 const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/consoleOnly:!!opts\.profile/);
 assert.match(app,/consoleOnly:!!IM\.profile/);
 assert.match(app,/profile:force\|\|g\.profile/);
});

test('Art gallery CSP allows the libretro image host', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 const csp=server.match(/img-src 'self'([^;]+)/)?.[1]||'';
 assert.match(csp,/raw\.githubusercontent\.com/,'libretro previews come from raw.githubusercontent.com');
});

test('Emulator cards render their icon without relying on a load event', () => {
 const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/class="emu-ic \$\{e\.found\?'has-img':''\}"/);
 assert.match(app,/\$\{e\.found\?`<img src="\/emu-icon\//);
});

test('Emulator game count is not mislabeled as the Collection', () => {
 for(const l of ['pt-BR','en','es','fr','de']){
  const d=JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`,import.meta.url),'utf8'));
  assert.ok(!/cole|collection|colecci|sammlung/i.test(d['emu.inCollection']),`${l}: rótulo não deve dizer coleção`);
 }
});

test('Ver jogos opens the Consoles tab on the clicked emulator', () => {
 const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/case 'emu-games':UI\.consoleTab=t\.dataset\.profile;UI\.view='consoles'/);
 assert.doesNotMatch(app,/case 'emu-games':UI\.emu=/);
});

test('Emulator ROM folders are saved per launcher and listed back', () => {
 const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/api\('emulator-folders',\{profile,paths:\[folder\]\}\)/);
 assert.match(app,/data-act="emu-folder-del"/);
 for(const l of ['pt-BR','en','es','fr','de']){const d=JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`,import.meta.url),'utf8'));for(const k of ['emu.folderReady','emu.folderRemoved','emu.folderRemove'])assert.ok(d[k],`${l}:${k}`);}
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/route==='\/api\/emulator-folders'/);
 assert.match(server,/\.\.\.\(l\.gameFolders\|\|\[\]\)/);
});
