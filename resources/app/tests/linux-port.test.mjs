import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Legendary} from '../lib/legendary.mjs';
import {parseDesktopEntry, listShortcuts} from '../lib/shortcut-folder.mjs';
import {iconSourceFor, themeIcon} from '../lib/exe-icon-source.mjs';
import {linuxRoots} from '../lib/discover.mjs';
import {resolveDownload, extractArchive} from '../lib/emulator-download.mjs';
import {execFileSync,spawn} from 'node:child_process';
import {launchFor,steamGameId} from '../lib/games.mjs';
import {createApp} from '../server.mjs';
import {Providers} from '../lib/providers.mjs';
import {LaunchEngine, processSnapshot} from '../lib/launch-engine.mjs';
import {EventEmitter} from 'node:events';
import crypto from 'node:crypto';

test('Linux: snapshot de processos tem born em epoch ms e name para adotar jogo via Proton', async () => {
 const rows = await processSnapshot();
 assert.ok(rows.length > 1);
 const now = Date.now();
 assert.ok(rows.every(r => r.born > now - 1000 * 60 * 60 * 24 * 365 && r.born <= now + 60000));
 assert.ok(rows.every(r => typeof r.name === 'string'));
 const child = spawn('sleep', ['20'], {stdio: 'ignore'});
 try {
  await new Promise(r => setTimeout(r, 60));
  const mine = (await processSnapshot()).find(r => r.pid === child.pid);
  assert.equal(mine?.name, 'sleep', 'processo filho deve aparecer com name');
 } finally { child.kill(); }
});

test('Linux: extractArchive cria o destino e lê tar.gz (BizHawk)', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'));
 const stage = path.join(dir, 'stage'); fs.mkdirSync(stage); fs.writeFileSync(path.join(stage, 'Mesen'), 'bin');
 const tgz = path.join(dir, 'mesen.tar.gz'); execFileSync('tar', ['-czf', tgz, '-C', stage, 'Mesen']);
 const out = path.join(dir, 'out'); await extractArchive(tgz, out);
 assert.deepEqual(fs.readdirSync(out), ['Mesen']);
});

test('Linux: LaunchEngine adota o processo do jogo aberto pela Steam (xdg-open sai, jogo continua)', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-proton-'));
 const exe = path.join(dir, 'Jogo.exe'); fs.writeFileSync(exe, 'fake');
 const uuid = crypto.randomUUID(), now = Date.now(), gamePid = 999000001;
 let tick = 0; const fake = new EventEmitter(); fake.pid = 999000002;
 const engine = new LaunchEngine({dir, interval: 2, grace: 4,
  spawnProcess: () => { queueMicrotask(() => fake.emit('spawn')); return fake; },
  snapshot: async () => {
   tick++;
   if (tick <= 4) return [{pid: gamePid, ppid: 0, born: now - 1000, exe: '/usr/lib/wine/wine64', name: 'jogo.exe'}];
   return [];
  }});
 const r = await engine.run({id: 'x', uuid, path: exe, title: 'Jogo', profile: 'pc', bindings: {1: 123}},
  {account: '1'}, {command: {exe: 'xdg-open', args: '"steam://rungameid/123"'}});
 assert.ok(tick > 4, 'deve acompanhar o processo do jogo após o xdg-open sair');
 assert.equal(r.status, 'ended');
});

test('Linux: jogo Windows é lançado pelo atalho da Steam (Proton), nunca .exe direto', () => {
 const g = {profile: 'pc', path: '/mnt/games/Hades/Hades.exe', bindings: {1: 123456}, appId: 123456};
 assert.deepEqual(launchFor(g, {account: '1'}, 'demo', 'linux'), {exe: 'xdg-open', args: '"steam://rungameid/'+steamGameId(123456)+'"'});
 assert.equal(steamGameId(1), '4328521728', 'gameid de 64 bits igual ao usado nos atalhos');
 assert.deepEqual(launchFor(g, {account: '1'}, 'demo', 'win32'), {exe: '/mnt/games/Hades/Hades.exe', args: ''});
 const fresh = {profile: 'pc', path: '/mnt/games/Novo/game.exe', bindings: {}, appId: 0};
 assert.deepEqual(launchFor(fresh, {account: '1'}, 'demo', 'linux'), {exe: 'xdg-open', args: '"steam://open/main"'});
});

test('Download de emulador no Linux: AppImage/tar oficial, nunca pacote Windows', async () => {
 const json = o => ({ok: true, json: async () => o});
 const fetchImpl = async url => {
  const name = /rpcs3-binaries-linux/.test(url) ? [
   {name: 'rpcs3-v0.0.43_linux64.AppImage', browser_download_url: 'https://github.com/rpcs3/linux_rpcs3.AppImage', size: 10},
   {name: 'rpcs3-v0.0.43_win64.7z', browser_download_url: 'https://github.com/rpcs3/win.7z'}] : [
   {name: 'DuckStation-x64.AppImage', browser_download_url: 'https://github.com/duckstation/DuckStation-x64.AppImage', size: 10},
   {name: 'duckstation-windows-x64-release.zip', browser_download_url: 'https://github.com/duckstation/windows.zip'}];
  return json({tag_name: 'v1', assets: name});
 };
 const ps1 = await resolveDownload('ps1', {fetchImpl, platform: 'linux'});
 assert.match(ps1.url, /DuckStation-x64\.AppImage$/);
 const ps3 = await resolveDownload('ps3', {fetchImpl, platform: 'linux'});
 assert.match(ps3.url, /rpcs3-binaries-linux|linux_rpcs3\.AppImage/);
 await assert.rejects(resolveDownload('ares', {fetchImpl, platform: 'linux'}), /não está disponível para Linux/);
});

test('Ícones no Linux: tema pelo nome do executável; sem ícone, {exe:\'\'} faz os consumidores pularem o fileIcon', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
 const theme = path.join(dir, 'hicolor', '48x48', 'apps');
 fs.mkdirSync(theme, {recursive: true});
 fs.writeFileSync(path.join(theme, 'dolphin-emu.png'), 'png');
 assert.equal(themeIcon('/usr/bin/dolphin-emu', path.join(dir, 'hicolor')), path.join(theme, 'dolphin-emu.png'));
 assert.equal(themeIcon('/opt/emulador-inexistente-1.0.AppImage', dir), '');
 const none = iconSourceFor(path.join(dir, 'jogo-qualquer'), dir);
 assert.deepEqual(none, {exe: ''});
});

test('.desktop: Exec com códigos de campo e aspas vira alvo + argumentos; listShortcuts aceita .desktop', () => {
 const d = parseDesktopEntry('[Desktop Entry]\nName=Celeste\nExec=wine "/home/eu/Jogos/Celeste/Celeste.exe" %U\nPath=/home/eu/Jogos/Celeste\nType=Application\n', p => p.endsWith('.exe'));
 assert.equal(d.target, '/home/eu/Jogos/Celeste/Celeste.exe');
 assert.equal(d.args, '');
 assert.equal(d.workingDir, '/home/eu/Jogos/Celeste');
 assert.equal(d.name, 'Celeste');
 assert.equal(path.basename(parseDesktopEntry('[Desktop Entry]\nExec=wine /jogos/game.exe\n').target), 'wine');
 const flat = parseDesktopEntry('[Desktop Entry]\nExec=flatpak run org.example.Game --fullscreen\n');
 assert.equal(path.basename(flat.target), 'flatpak');
 assert.equal(flat.args, 'run org.example.Game --fullscreen');
 assert.equal(parseDesktopEntry('[Outro]\nExec=x\n'), null);
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-'));
 fs.writeFileSync(path.join(dir, 'game.exe'), '');
 fs.writeFileSync(path.join(dir, 'Celeste.desktop'), '[Desktop Entry]\nName=Celeste\nExec=wine ' + path.join(dir, 'game.exe') + '\n');
 const items = listShortcuts(dir).items;
 assert.equal(items[0].kind, 'desktop');
 assert.equal(items[0].target, path.join(dir, 'game.exe'));
 assert.equal(items[0].name, 'Celeste');
});

test('Legendary no Linux: binário do sistema no PATH é usado; sem ele, o erro orienta a instalação', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-linux-'));
 const exe = path.join(dir, 'legendary');
 fs.writeFileSync(exe, '#!/bin/sh\n'); fs.chmodSync(exe, 0o755);
 const lg = new Legendary({platform: 'linux', env: {PATH: dir}, dataDir: dir});
 assert.equal(lg.exe, exe);
 assert.ok(lg.installed());
 assert.equal(await lg.ensure(), exe);
 const none = new Legendary({platform: 'linux', env: {PATH: path.join(dir, 'vazio')}, dataDir: dir});
 assert.equal(none.exe, '');
 assert.ok(!none.installed());
 await assert.rejects(() => none.ensure(), /Legendary/);
 none.env.PATH = dir;
 assert.equal(none.exe, exe, 'legendary instalado durante a sessão deve ser encontrado');
 assert.ok(none.installed());
});


test('Linux: abrir jogo sem appId na Steam avisa em vez de abrir só a janela da Steam', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-noapp-'));
 const exe = path.join(dir, 'Jogo.exe'); fs.writeFileSync(exe, 'fake');
 const engine = new LaunchEngine({dir});
 await assert.rejects(engine.run({id: 'x', uuid: crypto.randomUUID(), path: exe, title: 'Jogo', profile: 'pc'},
  {account: '1'}, {command: {exe: 'xdg-open', args: '"steam://open/main"'}}), /Adicione o jogo à Steam/);
});

test('Linux: pastas e ícones respeitam o ambiente injetado', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-env-'));
 fs.mkdirSync(path.join(dir, 'Jogos'));
 const roots = linuxRoots({exists: p => fs.existsSync(p)}, {HOME: dir, USER: 'ninguém'});
 assert.ok(roots.includes(path.join(dir, 'Jogos')));
 const icons = path.join(dir, 'flatpak/exports/share/icons/hicolor/48x48/apps');
 fs.mkdirSync(icons, {recursive: true}); fs.writeFileSync(path.join(icons, 'meuemu.png'), 'png');
 assert.equal(themeIcon('/usr/bin/meuemu', '', {XDG_DATA_HOME: dir}), path.join(icons, 'meuemu.png'));
});


test('Linux: readiness da Steam aceita steam.sh (destrava Adicionar à Steam)', async t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-ready-'));
 t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
 const steam = path.join(dir, 'steam'); fs.mkdirSync(steam);
 fs.writeFileSync(path.join(steam, 'steam.sh'), '#!/bin/sh\n');
 fs.mkdirSync(path.join(steam, 'config'));
 fs.writeFileSync(path.join(steam, 'config/loginusers.vdf'), '"users" { "76561197960265729" { "PersonaName" "teste" } }');
 const dataDir = path.join(dir, 'data'); fs.mkdirSync(dataDir);
 fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({steamDir: steam, account: '76561197960265729', adminToken: 'admin', readToken: 'reader'}));
 const port = 48769;
 const {server} = createApp({dataDir, port});
 const token = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8')).adminToken;
 await new Promise(r => server.listen(port, '127.0.0.1', r));
 t.after(() => new Promise(r => server.close(r)));
 const res = await fetch(`http://127.0.0.1:${port}/api/state`, {headers: {Authorization: 'Bearer ' + token}});
 const settings = (await res.json()).settings;
 assert.equal(settings.platform, 'linux');
 assert.equal(settings.readiness.steam, true);
 assert.equal(settings.readiness.integration, true, 'marcador CEF indica integração no Linux');
});

test('Linux: jogo aberto pela Steam gera sessão e tempo de jogo sem passar pelo Play', async t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-steam-watch-'));
 t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
 const steam = path.join(dir, 'steam'); fs.mkdirSync(steam);
 fs.writeFileSync(path.join(steam, 'steam.sh'), '#!/bin/sh\n');
 const dataDir = path.join(dir, 'data'); fs.mkdirSync(dataDir);
 const exe = path.join(dir, 'Jogo.exe');
 const uuid = crypto.randomUUID();
 fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({steamDir: steam, account: 'acc', adminToken: 'admin', readToken: 'reader'}));
 fs.writeFileSync(path.join(dataDir, 'games.json'), JSON.stringify({version: 1, games: [{id: 'g1', uuid, title: 'Jogo Steam', path: exe, profile: 'pc', appId: 123, bindings: {acc: 123}}]}));
 const port = 48771;
 let gameRunning = true;
 const born = Date.now() - 10000;
 const snapshotProcess = async () => gameRunning ? [{pid: 4242, ppid: 0, born, exe, name: 'jogo.exe'}] : [];
 const {server} = createApp({dataDir, port, snapshotProcess});
 await new Promise(r => server.listen(port, '127.0.0.1', r));
 t.after(() => new Promise(r => server.close(r)));
 await new Promise(r => setTimeout(r, 6600));
 const sessionFile = path.join(dataDir, 'sessions');
 const findSession = () => fs.readdirSync(sessionFile).map(f => {
  try { return JSON.parse(fs.readFileSync(path.join(sessionFile, f), 'utf8')); } catch { return null; }
 }).find(r => r?.uuid === uuid);
 const running = findSession();
 assert.ok(running, 'sessão do jogo aberto pela Steam deveria existir');
 assert.equal(running.status, 'running');
 assert.ok(Math.abs(Date.parse(running.startedAt) - born) < 2000, 'sessão começa quando o processo nasceu');
 assert.ok(running.seconds > 0);
 gameRunning = false;
 await new Promise(r => setTimeout(r, 3600));
 const totals = JSON.parse(fs.readFileSync(path.join(dataDir, 'playtime.json'), 'utf8')).totals || {};
 assert.ok((totals[uuid + '|acc']?.seconds || 0) > 0, 'tempo de jogo deve ser contabilizado');
});


test('Busca de artes responde mesmo se o provedor externo não responde', async t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-art-timeout-'));
 t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
 const dataDir = path.join(dir, 'data'); fs.mkdirSync(dataDir);
 const uuid = crypto.randomUUID();
 fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({adminToken: 'admin', readToken: 'reader'}));
 fs.writeFileSync(path.join(dataDir, 'games.json'), JSON.stringify({version: 1, games: [{id: 'g1', uuid, title: 'Jogo', path: path.join(dir, 'Jogo.iso'), profile: 'psp'}]}));
 const previous = process.env.TAIGA_ART_TIMEOUT; process.env.TAIGA_ART_TIMEOUT = '200';
 t.after(() => { if (previous === undefined) delete process.env.TAIGA_ART_TIMEOUT; else process.env.TAIGA_ART_TIMEOUT = previous; });
 const providersFactory = (c, d) => { const p = new Providers(c, d); p.artwork = () => new Promise(() => {}); return p; };
 const port = 48772;
 const {server} = createApp({dataDir, port, providersFactory});
 const token = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8')).adminToken;
 await new Promise(r => server.listen(port, '127.0.0.1', r));
 t.after(() => new Promise(r => server.close(r)));
 const start = Date.now();
 const res = await fetch(`http://127.0.0.1:${port}/api/art-list`, {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify({id: 'g1', kind: 'cover', page: 0})});
 const data = await res.json();
 assert.ok(Date.now() - start < 3000, 'a rota não pode ficar pendurada');
 assert.match(data.error || '', /demorou muito/);
});


test('Linux: snapshot usa o nome completo do .exe mesmo com comm truncado', async t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-name-'));
 t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
 const exe = path.join(dir, 'NomeBemLongoParaOSistema.exe');
 fs.copyFileSync('/bin/sleep', exe); fs.chmodSync(exe, 0o755);
 const child = spawn(exe, ['5'], {stdio: 'ignore'});
 t.after(() => { if (!child.killed) child.kill(); });
 await new Promise(r => child.once('spawn', r));
 let row;
 for (let i = 0; i < 25 && !row; i++) {
  row = (await processSnapshot()).find(r => r.pid === child.pid);
  if (!row) await new Promise(r => setTimeout(r, 100));
 }
 assert.equal(row?.name, 'NomeBemLongoParaOSistema.exe');
});

test('Linux: .desktop com wrapper no PATH vira caminho absoluto', () => {
 const d = parseDesktopEntry('[Desktop Entry]\nExec=node app.js\nName=Jogo\n');
 assert.equal(d.target, process.execPath);
 assert.equal(d.args, 'app.js');
});
