import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Legendary} from '../lib/legendary.mjs';

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
