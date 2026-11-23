import {clientSource} from './locale-harness.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
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

test('Suspicion audit fixes: redirect allowlist, CSP, AppImage exec and quoted stem', () => {
 const core=fs.readFileSync(new URL('../lib/ngl/core.mjs',import.meta.url),'utf8');
 assert.match(core,/ALLOWED\.test\(String\(res\.url/);
 const inject=fs.readFileSync(new URL('../lib/steam-inject.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(inject,/setBypassCSP/);
 const dl=fs.readFileSync(new URL('../lib/emulator-download.mjs',import.meta.url),'utf8');
 assert.match(dl,/\.appimage\$\/i\.test\(e\.name\)\)fs\.chmodSync|appimage\$\/i\.test\(e\.name\)\)\s*fs\.chmodSync/);
 const reg=fs.readFileSync(new URL('../lib/emulator-registry.mjs',import.meta.url),'utf8');
 assert.match(reg,/-rompath "\{dir\}" "\{stem\}"/);
 const eng=fs.readFileSync(new URL('../lib/launch-engine.mjs',import.meta.url),'utf8');
 assert.match(eng,/text\[i\]==="'/);
});

test('Linux audit fixes: RetroArch config, emulator accounts, symlinks and PC titles', () => {
 const ra=fs.readFileSync(new URL('../lib/retroarch.mjs',import.meta.url),'utf8');
 assert.match(ra,/'\.config'/);
 assert.match(ra,/\.var.app.org\.libretro\.RetroArch/);
 const acc=fs.readFileSync(new URL('../lib/emulator-accounts.mjs',import.meta.url),'utf8');
 assert.match(acc,/XDG_CONFIG_HOME/);
 const games=fs.readFileSync(new URL('../lib/games.mjs',import.meta.url),'utf8');
 assert.match(games,/fs\.statSync\(p\)/,'symlinks seguidos');
 assert.match(games,/withFileTypes:true/);
 assert.match(games,/size<16\*1024&&!\/\^\(cue/);
 const rn=fs.readFileSync(new URL('../lib/rom-name.mjs',import.meta.url),'utf8');
 assert.match(rn,/PC_GROUP\.test\(group\)\s*\?\s*''/);
});

test('Server audit fixes: settings, steamRemoved, logout and folder', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/\.\.\.oldSettings,provider:mode/);
 assert.match(server,/g\.steamRemoved=\{\.\.\.\(g\.steamRemoved\|\|\{\}\),\[config\.account\]:true\}/);
 assert.match(server,/clearLoginSession\?\.\('persist:psn-login'\)/);
 assert.match(server,/isFile\(g\.gameRoot\)\?g\.gameRoot:g\.path/);
 assert.match(server,/installWatch\.set\(g\.id/);
});

test('Critical audit fixes: install functions, importInstalled opts and GOG redaction', () => {
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 for(const fn of ['startInstall','pauseInstall','cancelInstall'])assert.ok(new RegExp('async function '+fn+'\\(').test(server),fn+' deve existir');
 assert.match(server,/if\(c\.gogAuth\)c\.gogAuth=\{connected:true,username:/);
 const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/async function importInstalled\(list,opts=\{\}\)/);
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
