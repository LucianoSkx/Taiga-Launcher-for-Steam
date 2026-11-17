import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Legendary} from '../lib/legendary.mjs';
import {parseDesktopEntry, listShortcuts} from '../lib/shortcut-folder.mjs';
import {iconSourceFor, themeIcon} from '../lib/exe-icon-source.mjs';
import {resolveDownload} from '../lib/emulator-download.mjs';

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
 assert.equal(parseDesktopEntry('[Desktop Entry]\nExec=wine /jogos/game.exe\n').target, 'wine');
 const flat = parseDesktopEntry('[Desktop Entry]\nExec=flatpak run org.example.Game --fullscreen\n');
 assert.equal(flat.target, 'flatpak');
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
});
