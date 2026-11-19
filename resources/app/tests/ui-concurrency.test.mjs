import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {clientSource} from './locale-harness.mjs';

function harness(fetchImpl) {
 const writes={};
 const element=id=>{
  const base={children:[],append(){},remove(){},hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
  if (['#steam-link-detected','#steam-link-results','#steam-link-form','#steam-link-none','#steam-link-refresh','#steam-link-remove','#matches','#sa-results'].includes(id)) {
   base._html='';
   Object.defineProperty(base,'innerHTML',{get(){return this._html;},set(v){this._html=v;(writes[id]||=[]).push(v);}});
  } else base.innerHTML='';
  return base;
 };
 const elements=new Map();
 for (const id of ['#app','#layer','#operation','#operation-text','#toasts','#steam-link-detected','#steam-link-results','#steam-link-form','#steam-link-none','#steam-link-refresh','#steam-link-remove','#matches','#sa-results']) elements.set(id,element(id));
 const document={querySelector:s=>s==='meta[name=taiga-token]'?{content:'token'}:elements.get(s)||null,querySelectorAll:()=>[],createElement:()=>element(),body:element(),activeElement:element(),addEventListener(){},documentElement:{dataset:{},removeAttribute(){}}};
 const ctx=vm.createContext({document,window:{scrollY:0,scrollTo(){},addEventListener(){}},fetch:fetchImpl,structuredClone,setTimeout,clearTimeout,console,innerHeight:900});
 vm.runInContext(clientSource(),ctx);
 return {ctx,writes,elements};
}

const baseGames=[
 {id:'a',title:'Jogo A',profile:'pc',platformName:'PC (Microsoft Windows)',metadata:{},art:{}},
 {id:'b',title:'Jogo B',profile:'pc',platformName:'PC (Microsoft Windows)',metadata:{},art:{}}
];
const baseState={games:baseGames,hiddenGames:[],settings:{language:'pt-BR',languageChosen:true,roots:[],accounts:[],preferences:{scanOnStart:false},readiness:{steam:true,account:true},profiles:{}}};

test('Steam Link: resposta do diálogo antigo não sobrescreve o novo', async () => {
 let resolveDetect;
 const {ctx,writes}=harness(async route=>{
  if (String(route).includes('steam-link-detect')) return await new Promise(r=>{resolveDetect=r;});
  return {ok:true,json:async()=>({})};
 });
 vm.runInContext('state='+JSON.stringify(baseState)+';S.games='+JSON.stringify(baseGames),ctx);
 vm.runInContext("steamLinkDialog('a')",ctx);
 vm.runInContext("steamLinkDialog('b')",ctx);
 assert.equal(vm.runInContext('UI.steamLinkToken',ctx),2);
 resolveDetect({ok:true,json:async()=>({candidates:[{appId:123,name:'Steam',confidence:1,image:'',reason:'exact'}]})});
 await new Promise(r=>setTimeout(r,20));
 const total=Object.values(writes).reduce((n,a)=>n+a.length,0);
 assert.equal(total,1,'somente o diálogo atual deve receber o resultado');
});

test('Steam Link: token muda a cada abertura', () => {
 const {ctx}=harness(async()=>({ok:true,json:async()=>({candidates:[]})}));
 vm.runInContext('state='+JSON.stringify(baseState)+';S.games='+JSON.stringify(baseGames),ctx);
 vm.runInContext("steamLinkDialog('a')",ctx);
 const first=vm.runInContext('UI.steamLinkToken',ctx);
 vm.runInContext("steamLinkDialog('b')",ctx);
 const second=vm.runInContext('UI.steamLinkToken',ctx);
 assert.ok(second>first);
});
