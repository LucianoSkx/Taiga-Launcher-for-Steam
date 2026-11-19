import fs from 'node:fs';import path from 'node:path';
export class LibraryWatcher{
 constructor({onChange,onError=()=>{},ignoreDir='',delay=1800}={}){this.onChange=onChange;this.onError=onError;this.ignoreDir=ignoreDir&&path.resolve(ignoreDir);this.delay=delay;this.watchers=[];this.timers=new Map();}
 setRoots(roots){this.close();for(const root of [...new Set(roots)]){try{const real=fs.realpathSync(root);if(!fs.statSync(real).isDirectory())continue;
  const dirs=[real];
  // Linux nao tem recursive no fs.watch: observa tambem os subdiretorios imediatos (limite para nao esgotar inotify).
  if(process.platform!=='win32')try{for(const e of fs.readdirSync(real,{withFileTypes:true})){if(!e.isDirectory()||/(?:node_modules|\.git|cache|shadercache)/i.test(e.name))continue;const sub=path.join(real,e.name);if(this.ignoreDir&&sub.startsWith(this.ignoreDir+path.sep))continue;if(dirs.length>=100)break;dirs.push(sub);}}catch{}
  for(const dir of dirs){const watcher=fs.watch(dir,{recursive:process.platform==='win32'},(_type,file)=>{if(file&&/(?:^|[\\/])(?:node_modules|\.git|cache|shadercache)(?:[\\/]|$)/i.test(String(file)))return;const changed=path.resolve(dir,String(file||''));if(this.ignoreDir&&(changed===this.ignoreDir||changed.startsWith(this.ignoreDir+path.sep)))return;clearTimeout(this.timers.get(dir));const timer=setTimeout(()=>{this.timers.delete(dir);this.onChange(real);},this.delay);timer.unref();this.timers.set(dir,timer);});watcher.unref();watcher.on('error',e=>this.onError(root,e));this.watchers.push(watcher);}
 }catch(e){this.onError(root,e);}}}
 close(){for(const watcher of this.watchers)watcher.close();this.watchers=[];for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();}
}
