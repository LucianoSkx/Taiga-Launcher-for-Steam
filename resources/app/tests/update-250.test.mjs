import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {epicIsGame, epicImages, epicLibrary, xboxTitles, xboxStoreLink, epicInstallLink} from '../lib/store-library.mjs';
import {collectionWrites, collectionDelete} from '../lib/steam-collections.mjs';
import {launchFor} from '../lib/games.mjs';
import {gameStatus} from '../lib/game-status.mjs';
import {createApp} from '../server.mjs';

test('Biblioteca Epic: só jogos instaláveis (sem DLC, mods e Unreal Engine), com nome e capa do catálogo', async () => {
 assert.equal(epicIsGame({title: 'Jogo'}), true);
 assert.equal(epicIsGame({title: 'DLC', mainGameItem: {id: 'x'}}), false);
 assert.equal(epicIsGame({title: 'Mod', categories: [{path: 'mods'}]}), false);
 assert.deepEqual(epicImages([{type: 'DieselGameBoxTall', url: 'https://cdn/x.jpg'}, {type: 'DieselGameBox', url: 'https://cdn/w.jpg'}]), {cover: 'https://cdn/x.jpg', wide: 'https://cdn/w.jpg', logo: ''});
 const calls = [];
 const fake = async url => { calls.push(url); const body = /assets\/Windows/.test(url)
  ? [{appName: 'Fortnite', namespace: 'fn', catalogItemId: 'c1'}, {appName: 'Kit', namespace: 'ue', catalogItemId: 'c2'}, {appName: 'Dlc1', namespace: 'g', catalogItemId: 'c3'}, {appName: 'Fortnite', namespace: 'fn', catalogItemId: 'c1'}]
  : /c1/.test(url) ? {c1: {title: 'Fortnite', keyImages: []}} : {c3: {title: 'Extra', mainGameItem: {id: 'c9'}}};
  return {ok: true, json: async () => body}; };
 const list = await epicLibrary({accessToken: 't'}, {fetchImpl: fake});
 assert.deepEqual(list.map(g => g.appName), ['Fortnite']);
 assert.ok(!calls.some(u => /namespace\/ue\//.test(u)), 'Unreal Engine não é consultado');
 assert.equal(epicInstallLink(list[0]), 'com.epicgames.launcher://apps/fn%3Ac1%3AFortnite?action=install');
});

test('Biblioteca Xbox: só títulos com versão para PC; link abre o app Xbox', () => {
 const list = xboxTitles([
  {name: 'Forza Horizon 5', pfn: 'Microsoft.624F8B84B80_8wekyb3d8bbwe', devices: ['PC', 'XboxSeries'], type: 'Game', titleId: '1', detail: {productId: '9NKX70BBCDRN'}},
  {name: 'Só console', pfn: 'X.Y_abc', devices: ['XboxOne'], type: 'Game'},
  {name: 'App', pfn: 'A.B_abc', devices: ['PC'], type: 'App'}]);
 assert.equal(list.length, 1);
 assert.equal(xboxStoreLink(list[0]), 'msxbox://game/?productId=9NKX70BBCDRN');
 assert.equal(xboxStoreLink({pfn: 'A.B_c'}), 'ms-windows-store://pdp/?PFN=A.B_c');
});

test('Jogos não instalados da Epic entram na coleção e na Steam, viram instalados e saem quando a opção é desligada', async t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taiga-250-'));
 const dataDir = path.join(dir, 'data'), steam = path.join(dir, 'Steam'), port = 48911;
 const programData = path.join(dir, 'ProgramData'), manifests = path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
 fs.mkdirSync(path.join(steam, 'config'), {recursive: true}); fs.writeFileSync(path.join(steam, 'steam.exe'), '');
 fs.writeFileSync(path.join(steam, 'config/loginusers.vdf'), '"users" { "76561197960265729" { "PersonaName" "Test" "MostRecent" "1" } }');
 fs.mkdirSync(dataDir, {recursive: true}); fs.mkdirSync(manifests, {recursive: true});
 const realFetch = globalThis.fetch, oldEnv = process.env.PROGRAMDATA, oldLocal = process.env.LOCALAPPDATA;
 process.env.PROGRAMDATA = programData; process.env.LOCALAPPDATA = path.join(dir, 'LocalAppData');
 globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (/assets\/Windows/.test(u)) return {ok: true, json: async () => [{appName: 'Hades', namespace: 'min', catalogItemId: 'cat1'}]};
  if (/bulk\/items/.test(u)) return {ok: true, json: async () => ({cat1: {title: 'Hades', keyImages: []}})};
  if (/^http:\/\/127\.0\.0\.1/.test(u)) return realFetch(url, opts);
  throw Error('offline');
 };
 t.after(() => { globalThis.fetch = realFetch; if (oldEnv === undefined) delete process.env.PROGRAMDATA; else process.env.PROGRAMDATA = oldEnv; if (oldLocal === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = oldLocal; fs.rmSync(dir, {recursive: true, force: true}); });
 let server = createApp({dataDir, port}).server; await new Promise(r => server.listen(port, '127.0.0.1', r));
 t.after(() => new Promise(r => server.close(r)));
 const cfgFile = path.join(dataDir, 'config.json'), c = JSON.parse(fs.readFileSync(cfgFile));
 const call = async (route, body, status = 200) => { const r = await realFetch(`http://127.0.0.1:${port}/api/${route}`, {method: body === undefined ? 'GET' : 'POST', headers: {Connection: 'close', Authorization: 'Bearer ' + c.adminToken, 'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)}); const d = await r.json(); assert.equal(r.status, status, JSON.stringify(d)); return d; };
 await call('settings', {steamDir: steam, account: '1', preferences: {autoSync: false}});
 // Login da Epic já feito (sessão válida) e a opção ligada.
 await new Promise(r => server.close(r));
 const cfg = JSON.parse(fs.readFileSync(cfgFile)); cfg.epicAuth = {accountId: 'a'.repeat(32), accessToken: 'tok', expiresAt: Date.now() + 3600000, refreshToken: 'r'}; cfg.preferences.showUninstalled = true; fs.writeFileSync(cfgFile, JSON.stringify(cfg));
 server = createApp({dataDir, port}).server; await new Promise(r => server.listen(port, '127.0.0.1', r));
 const first = await call('store-library', {});
 assert.equal(first.added, 1, JSON.stringify(first));
 let st = await call('state'); let g = st.games.find(x => x.title === 'Hades');
 assert.ok(g, 'jogo não instalado aparece na coleção'); assert.equal(g.status, 'NOT_INSTALLED');
 assert.equal((await call('store-install-state', {id: g.id})).state, 'none');
 const info = await call('store-install-info', {id: g.id});
 assert.equal(info.title, 'Hades'); assert.equal(info.method, 'launcher', 'instalação abre a Epic');
 assert.equal((await call('store-library', {})).added, 0, 'não duplica');
 await call('sync', {ids: [g.id], installIntegration: false});
 assert.ok(fs.readFileSync(path.join(steam, 'userdata/1/config/shortcuts.vdf')).includes('Hades'), 'atalho gravado na Steam');
 // Instalado (pela Epic Launcher): a mesma entrada vira o jogo instalado.
 const game = path.join(dir, 'Games', 'Hades'); fs.mkdirSync(game, {recursive: true}); fs.writeFileSync(path.join(game, 'Hades.exe'), 'MZ');
 fs.writeFileSync(path.join(manifests, 'Hades.item'), JSON.stringify({DisplayName: 'Hades', InstallLocation: game, LaunchExecutable: 'Hades.exe', AppName: 'Hades', CatalogNamespace: 'min', CatalogItemId: 'cat1'}));
 const second = await call('store-library', {});
 assert.equal(second.installed, 1, JSON.stringify(second));
 st = await call('state'); const installed = st.games.find(x => x.id === g.id);
 assert.equal(installed.notInstalled, false); assert.equal(installed.path, path.join(game, 'Hades.exe')); assert.ok(installed.appId, 'continua com o mesmo atalho');
 // Outro jogo não instalado sai quando a opção é desligada.
 fs.rmSync(path.join(manifests, 'Hades.item'));
 globalThis.fetch = async (url, opts) => { const u = String(url); if (/assets\/Windows/.test(u)) return {ok: true, json: async () => [{appName: 'Celeste', namespace: 'cel', catalogItemId: 'cat2'}]}; if (/bulk\/items/.test(u)) return {ok: true, json: async () => ({cat2: {title: 'Celeste', keyImages: []}})}; if (/^http:\/\/127\.0\.0\.1/.test(u)) return realFetch(url, opts); throw Error('offline'); };
 assert.equal((await call('store-library', {})).added, 1);
 const cel = (await call('state')).games.find(x => x.title === 'Celeste'); await call('sync', {ids: [cel.id], installIntegration: false});
 await call('settings', {preferences: {showUninstalled: false}});
 const off = await call('store-library', {});
 assert.ok(off.removed >= 0);
 st = await call('state');
 assert.ok(!st.games.some(x => x.title === 'Celeste'), 'não instalado sai da coleção');
 assert.ok(!fs.readFileSync(path.join(steam, 'userdata/1/config/shortcuts.vdf')).includes('Celeste'), 'e da Steam');
 assert.ok(st.games.some(x => x.title === 'Hades'), 'o jogo instalado continua');
});
