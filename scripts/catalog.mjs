import {readFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
export const tags=['海岛度假','美食寻味','山水户外','文化漫游','温泉度假','冰雪体验','黄色秋景'];
export function normalizeTags(value){
  const aliases={'山林徒步':'山水户外','名山登高':'山水户外','湖泊观光':'山水户外','雾凇奇景':'冰雪体验','祈福文化':'文化漫游'};
  const values=new Set((Array.isArray(value)?value:[]).flatMap(item=>String(item).split(/[、，,；;\n]/)).map(item=>item.trim()).map(item=>aliases[item]||item));
  return tags.filter(tag=>values.has(tag));
}
export const readCatalog=async root=>JSON.parse(await readFile(path.join(root,'data/catalog.json'),'utf8'));
export function safeAsset(value){return typeof value==='string'&&/^assets\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.split('/').includes('..')}
export async function validateProject(root){
  const catalog=await readCatalog(root),ids=new Set();
  if(!Array.isArray(catalog.cities)||!catalog.cities.length)throw Error('Empty catalog');
  for(const city of catalog.cities){
    if(typeof city.id!=='string'||!/^[a-z0-9-]+$/.test(city.id)||ids.has(city.id))throw Error('Invalid or duplicate destination ID');ids.add(city.id);
    if(!city.published)throw Error('Unpublished record in public catalog: '+city.id);
    for(const key of ['name','province','spots','season','dayText'])if(typeof city[key]!=='string')throw Error('Invalid '+key+': '+city.id);
    if(!Array.isArray(city.months)||city.months.some(m=>!Number.isInteger(m)||m<1||m>12))throw Error('Invalid months: '+city.id);
    if(!Array.isArray(city.tags)||city.tags.some(tag=>!tags.includes(tag)))throw Error('Unknown category: '+city.id);
    if(!Array.isArray(city.photos))throw Error('Invalid photos: '+city.id);
    for(const photo of city.photos){if(!safeAsset(photo))throw Error('Non-local photo: '+photo);if(!(await stat(path.join(root,'site',photo))).isFile())throw Error('Missing photo: '+photo)}
  }
  const html=await readFile(path.join(root,'site/index.html'),'utf8');
  if(/<base\b/i.test(html))throw Error('Root base URL breaks project Pages');
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const value=match[1];if(value.startsWith('#'))continue;
    if(/^(?:\/|https?:|data:|javascript:)/i.test(value))throw Error('Non-relative shell resource: '+value);
    const file=value.split('?')[0];if(file==='catalog.js')continue;
    await stat(path.join(root,'site',file));
  }
  for(const file of await readdir(path.join(root,'site'))){
    if(!/\.(css|js)$/.test(file))continue;
    const source=await readFile(path.join(root,'site',file),'utf8');
    if(/(?:fetch\s*\(|XMLHttpRequest|\/api\/|signin-with-chatgpt|href=["']\/)/.test(source))throw Error('Server dependency or root path in '+file);
    for(const match of source.matchAll(/url\(\s*["']?([^\s)'";]+)/g)){
      if(!safeAsset(match[1]))throw Error('Non-local CSS resource: '+match[1]);await stat(path.join(root,'site',match[1]));
    }
  }
  return {destinations:ids.size,photos:new Set(catalog.cities.flatMap(city=>city.photos)).size};
}
