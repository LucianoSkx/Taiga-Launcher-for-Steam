import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url)),LINUX=process.platform==='linux';
// Testes (node --test): nada de estado real da máquina — a Steam aberta no PC não pode influenciar o resultado.
const TEST=!!process.env.NODE_TEST_CONTEXT;
// Executável e nome do processo auxiliar variam por plataforma; o resto da Steam é igual.
const STEAM_EXE=()=>LINUX?'steam.sh':'steam.exe',HELPER_PROC=()=>LINUX?'steamwebhelper':'steamwebhelper.exe';
export async function ps(code){if(process.platform!=='win32')throw Error('Esta operação requer Windows.');const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,maxBuffer:4*1024*1024});return stdout.trim();}
export function isFlatpakSteam(dir){return LINUX&&String(dir||'').includes('.var/app/com.valvesoftware.Steam');}
export function steamDirOk(dir){
 if(!dir)return false;
 for(const name of ['steam.sh','steam.exe'])try{if(fs.statSync(path.join(dir,name)).isFile())return true;}catch{}
 try{return fs.statSync(path.join(dir,'steamapps')).isDirectory();}catch{return false;}
}
export async function detectSteam(){
 if(LINUX){const flat=path.join(os.homedir(),'.var/app/com.valvesoftware.Steam');
 for(const dir of [path.join(os.homedir(),'.local/share/Steam'),path.join(os.homedir(),'.steam/steam'),path.join(flat,'data/Steam'),path.join(flat,'.local/share/Steam'),path.join(flat,'.steam/steam')])if(steamDirOk(dir))return dir;return '';}
 try{return await ps("(Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam').SteamPath");}catch{return '';}}
export async function steamLocation(selected){let target=selected;if(!LINUX&&path.extname(selected).toLowerCase()==='.lnk'){const literal=selected.replaceAll("'","''");target=await ps("(New-Object -ComObject WScript.Shell).CreateShortcut('"+literal+"').TargetPath");}if(fs.existsSync(target)&&fs.statSync(target).isDirectory())return target;if(path.basename(target).toLowerCase()!==STEAM_EXE())throw Error(LINUX?'Selecione a pasta da Steam ou o arquivo steam.sh.':'Selecione a pasta da Steam, steam.exe ou um atalho para steam.exe.');return path.dirname(target);}
// Steam aberta? Pelo tasklist (leve) em vez de um PowerShell inteiro; a resposta vale 3 s e pedidos juntos dividem a
// mesma consulta. fresh: consulta agora (usado ao fechar/abrir a Steam).
let runCache={at:0,value:false},runPending=null;
export async function processRunning(image){if(TEST||(!LINUX&&process.platform!=='win32'))return false;try{if(LINUX){
   const checks=image===STEAM_EXE()?[['-x','steam'],['-f','com.valvesoftware.Steam']]:[['-x',String(image).replace(/\.exe$/i,'')],['-f',image]];
   for(const flags of checks)try{await run('pgrep',flags);return true;}catch{}
   return false;
  }const {stdout}=await run('tasklist.exe',['/FI','IMAGENAME eq '+image,'/FO','CSV','/NH'],{windowsHide:true,timeout:10000});return String(stdout).toLowerCase().includes('"'+image.toLowerCase()+'"');}catch{return (await ps("if(Get-Process "+image.replace(/\.exe$/i,'')+" -ErrorAction SilentlyContinue){'yes'}else{'no'}").catch(()=>'no'))==='yes';}}
export async function running({fresh=false}={}){if(TEST||(!LINUX&&process.platform!=='win32'))return false;if(!fresh&&Date.now()-runCache.at<3000)return runCache.value;if(runPending)return runPending;runPending=processRunning(STEAM_EXE()).then(v=>{runCache={at:Date.now(),value:v};return v;}).finally(()=>{runPending=null;});return runPending;}
export async function stopSteam(dir){
 if(!await running({fresh:true}))return;
 await (isFlatpakSteam(dir)?run('flatpak',['run','com.valvesoftware.Steam','-shutdown'],{windowsHide:true,timeout:15000}):run(path.join(dir,STEAM_EXE()),['-shutdown'],{windowsHide:true,timeout:15000})).catch(()=>{});
 const deadline=Date.now()+45000;while(Date.now()<deadline){if(!await running({fresh:true})){
  // A porta de depuração pertence ao steamwebhelper: espera ele fechar também, senão a Steam nova não consegue abri-la.
  const helperDeadline=Date.now()+12000;while(Date.now()<helperDeadline&&await processRunning(HELPER_PROC()))await new Promise(r=>setTimeout(r,500));
  return;}await new Promise(r=>setTimeout(r,500));}
 throw Error('A Steam ainda está aberta. Encerre normalmente pelo menu Steam > Sair e tente novamente.');
}
// A Steam é aberta com a depuração do CEF para o injetor do Taiga Launcher (mesmos argumentos do SFP).
export function startSteam(dir,port=8080){const args=['-cef-enable-debugging','-devtools-port',String(port)];let exe=path.join(dir,STEAM_EXE()),argv=args;
 // Steam flatpak: o steam.sh roda dentro da sandbox; na máquina anfitriã quem inicia é o flatpak.
 if(isFlatpakSteam(dir)){exe='flatpak';argv=['run','com.valvesoftware.Steam',...args];}
 const p=spawn(exe,argv,{detached:true,stdio:'ignore',windowsHide:true});p.on('error',()=>{});p.unref();}
// Linha de comando da Steam em execução (para saber se já está com a integração ativa).
export async function steamCommandLine(){if(LINUX){try{let first='',wrapper='';for(const name of fs.readdirSync('/proc')){if(!/^\d+$/.test(name))continue;let raw='';try{raw=fs.readFileSync('/proc/'+name+'/cmdline','utf8');}catch{continue;}const parts=raw.split('\0').filter(Boolean);if(!parts.some(a=>path.basename(a)==='steam'||a==='steam.sh'||a.endsWith('/steam.sh')||a.includes('com.valvesoftware.Steam')))continue;const line=parts.join(' ');if(/-cef-enable-debugging/i.test(line))return line;if(parts.some(a=>a==='steam.sh'||a.endsWith('/steam.sh')))wrapper||=line;else first||=line;}return first||wrapper;}catch{return null;}}
 if(process.platform!=='win32')return null;try{return await ps("(Get-CimInstance Win32_Process -Filter \"name='steam.exe'\" | Select-Object -First 1 -ExpandProperty CommandLine)")||'';}catch{return null;}}
// Inicialização com o Windows: acrescenta os argumentos da integração à entrada "Steam" de HKCU\...\Run.
const RUN_KEY='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export async function steamAutostart(dir,{enable=null,port=8080}={}){
 if(process.platform!=='win32')return {available:false,enabled:false};
 let current='';try{const {stdout}=await run('reg.exe',['query',RUN_KEY,'/v','Steam'],{windowsHide:true});current=(stdout.match(/Steam\s+REG_SZ\s+(.+)/)||[])[1]?.trim()||'';}catch{}
 const has=/-cef-enable-debugging/i.test(current);
 if(enable===null)return {available:!!current,enabled:has};
 if(!current)throw Error('A Steam não está configurada para iniciar com o Windows. Ative em Steam > Configurações > Interface.');
 let next=current.replace(/\s+-cef-enable-debugging/ig,'').replace(/\s+-devtools-port\s+\d+/ig,'');if(enable)next+=' -cef-enable-debugging -devtools-port '+Number(port);
 await run('reg.exe',['add',RUN_KEY,'/v','Steam','/t','REG_SZ','/d',next,'/f'],{windowsHide:true});
 return {available:true,enabled:!!enable};
}
export async function pick(kind){
 if(kind==='steam-folder')kind='folder';else if(kind==='steam-file')kind='steam';
 if(!['game','folder','emulator','launcher','core','steam','scripts','art'].includes(kind))throw Error('Seleção inválida');
 // No Linux o gerenciador injeta o seletor do Electron (desktop/main.cjs); este caminho só serve ao serviço avulso.
 if(LINUX)return [];
 if(process.platform!=='win32')throw Error('O seletor de arquivos requer Windows.');
 const {stdout}=await run('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(here,'../windows/pick.ps1'),kind],{windowsHide:true,maxBuffer:1024*1024});
 return JSON.parse(stdout.replace(/^\uFEFF/,'').trim()||'[]');
}
export function accounts(dir){const file=path.join(dir,'config','loginusers.vdf');if(!fs.existsSync(file))return [];
 const text=fs.readFileSync(file,'utf8'),list=[];
 for(const m of text.matchAll(/"(\d{17})"\s*\{([^}]+)\}/g)){
 const id=String(BigInt(m[1])-76561197960265728n),name=m[2].match(/"PersonaName"\s+"([^"]*)"/i)?.[1]||id;
 list.push({id,steamId:m[1],name,avatar:avatarFile(dir,m[1])?'/api/avatar?id='+id:null,recent:/"MostRecent"\s+"1"/.test(m[2])});
 }return list;
}
export async function activeAccount(dir){if(LINUX){try{const list=accounts(dir||await detectSteam());return list.find(a=>a.recent)?.id||(list.length===1?list[0].id:null);}catch{return null;}}
 try{const id=await ps("(Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam\\ActiveProcess' -ErrorAction Stop).ActiveUser");return /^\d+$/.test(id)&&id!=='0'?id:null;}catch{return null;}}

export function avatarFile(dir,steamId){if(!/^\d{17}$/.test(steamId))return null;for(const base of ['config/avatarcache','appcache/avatarcache'])for(const ext of ['png','jpg','jpeg']){const file=path.join(dir,base,steamId+'.'+ext);try{const stat=fs.statSync(file);if(stat.isFile()&&stat.size<4*1024*1024)return file;}catch{}}return null;}
// Conta Epic do jogo aberto pelo launcher da Epic: ele recebe "-epicuserid=<id>" na linha de comando.
export async function epicUserFromProcesses(){if(process.platform!=='win32')return null;try{const out=await ps("Get-CimInstance Win32_Process -Filter \"CommandLine like '%-epicuserid=%'\" | Select-Object -First 5 -ExpandProperty CommandLine");const m=String(out||'').match(/-epicuserid=([0-9a-f]{32})\b/i);return m?m[1].toLowerCase():null;}catch{return null;}}
