import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {validateProject,readCatalog,normalizeTags,safeAsset,tags} from '../scripts/catalog.mjs';
import {localPhoto,syncCatalog} from '../scripts/sync.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=await readCatalog(root);
function browser(saved={}){
  const elements={},listeners={};
  const context={window:{TUJI_CATALOG:catalog,addEventListener(){}},document:{getElementById(id){return elements[id]||=( {innerHTML:'',value:'',dataset:{},addEventListener(){}})},querySelectorAll(){return []}},location:{hash:'#list',pathname:'/atlas-v/'},localStorage:{getItem:key=>saved[key]||null,setItem(key,value){saved[key]=value}},structuredClone,URLSearchParams};
  const pinyin={};vm.runInNewContext(fs.readFileSync(path.join(root,'site/assets/pinyin-pro-3.29.5.js'),'utf8'),pinyin);context.window.pinyinPro=pinyin.pinyinPro;
  for(const file of ['runtime.js','detail-view.js','app.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'site',file),'utf8'),context);
  return {elements,context,get:expression=>vm.runInNewContext(expression,context)};
}
test('all published records, local images and relative resources validate',async()=>{
  const result=await validateProject(root);assert.equal(result.destinations,catalog.cities.length);assert.ok(result.photos>=528);
  assert.equal(safeAsset('assets/../secret'),false);assert.equal(safeAsset('/api/media/test'),false);
  assert.equal(localPhoto('catalog/abcd.webp'),'assets/catalog/abcd.webp');assert.equal(localPhoto('https://example.com/a.png'),null);
});
test('seven canonical categories and public-only runtime',()=>{
  const app=browser();assert.deepEqual(JSON.parse(app.get('JSON.stringify(travelPreferenceTags())')),['全部',...tags]);
  assert.equal(app.get('cities.length'),catalog.cities.length);
  for(const tag of tags){app.context.tag=tag;app.get('filter=defaultListFilter();filter.tag=tag;render()');assert.ok(app.get('filteredCities().length')>0,tag);assert.ok(app.get('filteredCities().every(city=>city.tags.includes(tag))'))}
  for(const route of ['#admin','#members','#preview']){app.context.location.hash=route;app.get('render()');assert.equal(app.elements.app.innerHTML.includes('editor-form'),false)}
  assert.equal(app.elements.header.innerHTML.includes('signin'),false);assert.equal(app.elements.header.innerHTML.includes('href="/'),false);
  assert.deepEqual(normalizeTags(['名山登高','山林徒步','湖泊观光','祈福文化','雾凇奇景','主题乐园','轻松休闲']),['山水户外','文化漫游','冰雪体验']);
});
test('Chinese, full pinyin, initials and composition input work',()=>{
  const app=browser();for(const query of ['杭州','hangzhou','Hang Zhou','hz','西湖','xihu','xh']){app.context.query=query;assert.equal(app.get('matchesDestination(byId("city-6c30ee3f8afe"),query)'),true,query)}
  const input=app.elements.search;input.oncompositionstart();input.value='xi';input.oninput({isComposing:true});assert.equal(app.get('filter.q'),'');input.value='西湖';input.oncompositionend();assert.equal(app.get('filter.q'),'西湖');assert.ok(app.elements['search-results'].innerHTML.includes('杭州市'));
});
test('province navigation, seasons and original photos survive export',()=>{
  const app=browser();app.get('window.scrollY=300;filter={...defaultListFilter(),province:"安徽",month:"autumn"};location.hash=listRoute(filter,300)');
  const route=app.context.location.hash;app.context.location.hash=app.get('cityRoute(byId("city-a70907e3d5c7"))');assert.equal(app.get('provinceReturnRoute(byId("city-a70907e3d5c7"))'),route);
  assert.equal(app.get('matchesTravelPeriod([12],"winter")'),true);assert.equal(app.get('matchesTravelPeriod([3],"winter")'),false);
  for(const city of catalog.cities){app.context.record=city;const html=app.get('detail(record)');const images=[...html.matchAll(/<img src="([^"]+)"/g)].map(match=>match[1]);assert.equal(images.length,new Set(city.photos).size);assert.ok(images.every(value=>value.startsWith('assets/')))}
});
test('hash deep links and every image resolve inside a repository subpath',()=>{
  const origin='https://example.github.io/team-travel/';
  const html=fs.readFileSync(path.join(root,'site/index.html'),'utf8');
  const paths=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]).filter(value=>!value.startsWith('#'));
  for(const value of [...paths,...catalog.cities.flatMap(city=>city.photos),'#city/foshan?from=%23list'])assert.ok(new URL(value,origin).pathname.startsWith('/team-travel/'),value);
  for(const file of ['site/runtime.js','site/app.js'])assert.equal(/fetch\s*\(|\/api\/|signin-with-chatgpt/.test(fs.readFileSync(path.join(root,file),'utf8')),false);
});
test('favorites deduplicate legacy storage',()=>{
  const app=browser({'tuji-picks-v1':JSON.stringify({广州:['foshan'],杭州:['foshan','shantou']})});assert.equal(app.get('picks.length'),2);
});
test('failed synchronization keeps the last published snapshot intact',async()=>{
  const temp=await mkdtemp(path.join(tmpdir(),'atlas-sync-'));
  const originalFetch=globalThis.fetch;
  try{
    await mkdir(path.join(temp,'data'));
    const snapshot=JSON.stringify(catalog);await writeFile(path.join(temp,'data/catalog.json'),snapshot);
    globalThis.fetch=async()=>({ok:false,status:403});
    await assert.rejects(syncCatalog(temp),/Catalog HTTP 403/);
    assert.equal(await readFile(path.join(temp,'data/catalog.json'),'utf8'),snapshot);
    globalThis.fetch=async()=>({ok:true,json:async()=>({cities:[{...catalog.cities[0],photos:['https://example.com/not-local.png']}]})});
    await assert.rejects(syncCatalog(temp),/Unsupported photo URL/);
    assert.equal(await readFile(path.join(temp,'data/catalog.json'),'utf8'),snapshot);
  }finally{globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true})}
});
