// Baixar e configurar um emulador oficial (opcional, só quando o usuário pede).
// Fonte: a página oficial de lançamentos de cada projeto (GitHub ou site oficial), versão estável mais recente,
// pacote .zip para Windows 64 bits. Nada de BIOS, firmware ou jogos: só o próprio emulador.
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);
// profile: chave do perfil no Taiga Launcher; repo: GitHub oficial; asset: arquivo .zip do Windows x64.
export const DOWNLOADS = {
 psp: {name: 'PPSSPP', repo: 'hrydgard/ppsspp', site: tag => 'https://www.ppsspp.org/files/' + tag.replace(/^v/, '').replace(/\./g, '_') + '/ppsspp_win.zip', linuxAsset: /anylinux-x86_64\.appimage$/i},
 ps1: {name: 'DuckStation', repo: 'stenzek/duckstation', asset: /^duckstation-windows-x64-release\.zip$/i, linuxAsset: /^duckstation-x64\.appimage$/i},
 azahar: {name: 'Azahar', repo: 'azahar-emu/azahar', asset: /windows.*msvc.*\.zip$|windows.*\.zip$/i, linuxAsset: /^azahar\.appimage$/i},
 melonds: {name: 'melonDS', repo: 'melonDS-emu/melonDS', asset: /windows.*x86_64.*\.zip$|win.*x64.*\.zip$/i, linuxAsset: /^melonds-.*-appimage-x86_64\.zip$/i},
 cemu: {name: 'Cemu', repo: 'cemu-project/Cemu', asset: /windows-x64\.zip$/i, linuxAsset: /^cemu-.*-x86_64\.appimage$/i},
 xemu: {name: 'xemu', repo: 'xemu-project/xemu', asset: /^xemu-win-x86_64-release\.zip$|win.*x86_64.*release.*\.zip$/i, linuxAsset: /^xemu-.*-x86_64\.appimage$/i},
 flycast: {name: 'Flycast', repo: 'flyinghead/flycast', asset: /win64.*\.zip$/i, linuxAsset: /^flycast-x86_64-.*\.appimage$/i},
 shadps4: {name: 'shadPS4', repo: 'shadps4-emu/shadPS4', asset: /win64-qt.*\.zip$|win64.*\.zip$/i, linuxAsset: /^shadps4-linux-sdl-.*\.zip$/i},
 mesen: {name: 'Mesen', repo: 'SourMesen/Mesen2', asset: /windows.*\.zip$/i, linuxAsset: /^mesen_.*_linux_x64\.zip$/i},
 snes9x: {name: 'Snes9x', repo: 'snes9xgit/snes9x', asset: /win32-x64\.zip$/i, linuxAsset: /^snes9x-.*-x86_64\.appimage$/i},
 dosbox: {name: 'DOSBox Staging', repo: 'dosbox-staging/dosbox-staging', asset: /windows-x64.*\.zip$|windows.*\.zip$/i, linuxAsset: /^dosbox-staging-linux-x86_64-.*\.tar\.xz$/i},
 // 2.2.6: mais emuladores. Pacotes .7z são extraídos pelo tar do Windows (Windows 11; no 10, a pasta é aberta para extrair).
 ps2: {name: 'PCSX2', repo: 'PCSX2/pcsx2', asset: /windows-x64-qt\.7z$/i, linuxAsset: /^pcsx2-.*-linux-appimage-x64-qt\.appimage$/i},
 ps3: {name: 'RPCS3', repo: 'RPCS3/rpcs3-binaries-win', asset: /win64.*\.7z$/i, linuxRepo: 'RPCS3/rpcs3-binaries-linux', linuxAsset: /^rpcs3-.*_linux64\.appimage$/i},
 vita3k: {name: 'Vita3K', repo: 'Vita3K/Vita3K', tag: 'continuous', asset: /^windows-latest\.zip$|windows.*\.zip$/i, linuxAsset: /^vita3k-x86_64\.appimage$/i},
 xenia: {name: 'Xenia Canary', repo: 'xenia-canary/xenia-canary-releases', asset: /^xenia_canary_windows\.zip$|windows.*\.zip$/i, linuxAsset: /^xenia_canary_linux\.tar_\.xz$/i},
 mgba: {name: 'mGBA', repo: 'mgba-emu/mgba', asset: /win64\.7z$/i, linuxAsset: /^mgba-.*-appimage-x64\.appimage$/i},
 bizhawk: {name: 'BizHawk', repo: 'TASEmulators/BizHawk', asset: /win-x64\.zip$/i, linuxAsset: /^bizhawk-.*-linux-x64\.tar\.gz$/i},
 ares: {name: 'ares', repo: 'ares-emulator/ares', asset: /windows.*\.zip$/i},
 stella: {name: 'Stella', repo: 'stella-emu/stella', asset: /windows\.zip$|x64.*\.zip$/i},
};
const ALLOWED = /^https:\/\/(api\.github\.com|github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com|www\.ppsspp\.org)\//;
export function downloadable() { return Object.entries(DOWNLOADS).map(([profile, d]) => ({profile, name: d.name, repo: d.repo})); }
export function hasAsset(profile, platform = process.platform) { const d = DOWNLOADS[profile]; return !!d && (platform !== 'linux' || !!(d.linuxAsset || d.linuxRepo)); }

// Escolhe o pacote da versão mais recente (sem baixar ainda).
export async function resolveDownload(profile, {fetchImpl = (...a) => fetch(...a), platform = process.platform} = {}) {
 const d = DOWNLOADS[profile]; if (!d) throw Error('Este emulador não tem download automático.');
 const linux = platform === 'linux', repo = linux ? (d.linuxRepo || d.repo) : d.repo, pattern = linux ? d.linuxAsset : d.asset;
 if (linux && !pattern) throw Error('O download automático de ' + d.name + ' não está disponível para Linux (a Release oficial não tem pacote portátil).');
 const res = await fetchImpl('https://api.github.com/repos/' + repo + '/releases/' + (d.tag ? 'tags/' + d.tag : 'latest'), {headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'TaigaLauncher'}, signal: AbortSignal.timeout(20000)});
 if (!res.ok) throw Error('Não foi possível consultar a versão mais recente de ' + d.name + '.');
 const rel = await res.json(), tag = String(rel.tag_name || '');
 if (!linux && d.site) return {profile, name: d.name, version: tag, url: d.site(tag), file: 'ppsspp_win.zip'};
 const asset = (rel.assets || []).find(a => pattern.test(String(a.name || '')) && /\.(zip|7z|appimage|tar_?\.(xz|gz|bz2)|tgz)$/i.test(a.name) && !/arm64|aarch64|armhf|symbols|debug|pdb/i.test(a.name) && (linux ? !/dbg/i.test(a.name) : true));
 if (!asset?.browser_download_url) throw Error('A versão ' + tag + ' de ' + d.name + ' não tem pacote para ' + (linux ? 'Linux' : 'Windows') + '.');
 return {profile, name: d.name, version: tag, url: asset.browser_download_url, file: asset.name, size: asset.size || 0};
}

// Baixa, extrai em <destino>\<Nome> e devolve a pasta. A extração usa o tar do próprio Windows (ou Expand-Archive).
export async function extractArchive(zip, target) {
 fs.mkdirSync(target, {recursive: true});
 if (/\.tar_?\.(xz|gz|bz2)$|\.tgz$/i.test(zip)) { await run('tar', ['-xf', zip, '-C', target], {timeout: 600000}); return; }
 if (/\.7z$/i.test(zip)) {
  for (const exe of ['7z', '7za']) try { await run(exe, ['x', '-y', '-o' + target, zip], {timeout: 600000}); return; } catch {}
  throw Error('Extração .7z indisponível: instale 7z/7za ou extraia o arquivo manualmente.');
 }
 return extractZip(zip, target);
}

export async function downloadEmulator(profile, {dest, tmpDir, fetchImpl = (...a) => fetch(...a), extract = process.platform === 'linux' ? extractArchive : extractZip, onProgress = () => {}, platform = process.platform} = {}) {
 const info = await resolveDownload(profile, {fetchImpl, platform});
 if (!ALLOWED.test(info.url)) throw Error('Endereço de download não permitido.');
 fs.mkdirSync(tmpDir, {recursive: true});
 const zip = path.join(tmpDir, info.file.replace(/[^\w.-]+/g, '_'));
 let url = info.url, res;
 for (let i = 0; i < 5; i++) { res = await fetchImpl(url, {redirect: 'manual', headers: {'User-Agent': 'TaigaLauncher'}, signal: AbortSignal.timeout(600000)}); if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url).toString(); if (!ALLOWED.test(url)) throw Error('Redirecionamento de download não permitido.'); continue; } break; }
 if (!res.ok) throw Error('Download de ' + info.name + ' falhou (HTTP ' + res.status + ').');
 const total = Number(res.headers.get('content-length')) || info.size || 0, out = fs.createWriteStream(zip); let n = 0;
 try { for await (const chunk of res.body) { n += chunk.length; if (n > 600 * 1024 * 1024) throw Error('Pacote grande demais.'); out.write(chunk); onProgress(total ? n / total : 0); } } finally { await new Promise(r => out.end(r)); }
 const head = fs.readFileSync(zip).subarray(0, 6), isZip = head.toString('latin1', 0, 2) === 'PK', is7z = head.equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])), isAppImage = /\.appimage$/i.test(info.file);
 if (!isZip && !is7z && !isAppImage) { fs.rmSync(zip, {force: true}); throw Error('O arquivo baixado não é um pacote válido.'); }
 const target = path.join(dest, info.name.replace(/[^\w .-]+/g, ''));
 fs.mkdirSync(target, {recursive: true});
 if (isAppImage) { const file = path.join(target, path.basename(info.file)); fs.copyFileSync(zip, file); fs.chmodSync(file, 0o755); fs.rmSync(zip, {force: true}); return {...info, folder: target}; }
 try { await extract(zip, target); } catch (e) { if (!is7z) throw e; const keep = path.join(target, path.basename(zip)); fs.renameSync(zip, keep); return {...info, folder: target, manual: keep}; }
 fs.rmSync(zip, {force: true});
 // PPSSPP portátil: o arquivo installed.txt faria ele usar Documentos; sem ele, tudo fica na pasta (memstick).
 return {...info, folder: target};
}
export async function extractZip(zip, target) {
 if (process.platform === 'win32') {
  try { await run('tar.exe', ['-xf', zip, '-C', target], {windowsHide: true, timeout: 600000}); return; } catch {}
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath ' + q(zip) + ' -DestinationPath ' + q(target) + ' -Force'], {windowsHide: true, timeout: 600000});
  return;
 }
 await run('unzip', ['-o', '-q', zip, '-d', target], {timeout: 600000});
}
