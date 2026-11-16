import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeTags,readCatalog,safeAsset} from './catalog.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export function localPhoto(value){
  if(safeAsset(value))return value;
  if(/^catalog\/[a-f0-9]+\.webp$/.test(value))return 'assets/'+value;
  if(/^[a-f0-9]{16}$/.test(value))return 'assets/'+value+'.png';
  return null;
}
export async function syncCatalog(projectRoot=root,sourceOverride){
  const previous=await readCatalog(projectRoot),origin=new URL(sourceOverride||previous.source.url);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Source must be a public HTTPS origin without credentials');
  const response=await fetch(new URL('/api/catalog',origin),{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Catalog HTTP '+response.status);
  const body=await response.json();
  if(!Array.isArray(body.cities)||body.cities.some(city=>!city.id||city.published!==true||!Array.isArray(city.photos)))throw Error('Invalid public catalog response');
  const merged=new Map(previous.cities.map(city=>[city.id,city]));
  const downloaded=new Map();
  for(const record of body.cities){
    const city={...merged.get(record.id),...record,tags:normalizeTags(record.tags)};
    const mapping=new Map();
    for(const value of city.photos){
      let local=localPhoto(value);
      if(!local){
        if(!/^\/api\/media\/[a-zA-Z0-9_./%-]+$/.test(value)||value.includes('..'))throw Error('Unsupported photo URL: '+value);
        local=downloaded.get(value);
        if(!local){
          const image=await fetch(new URL(value,origin),{signal:AbortSignal.timeout(30000)});
          if(!image.ok)throw Error('Photo HTTP '+image.status+': '+value);
          const bytes=Buffer.from(await image.arrayBuffer());
          const extension=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216?'jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
          if(!extension||bytes.length>10*1024*1024)throw Error('Invalid image bytes: '+value);
          local='assets/uploads/'+createHash('sha256').update(bytes).digest('hex')+'.'+extension;
          await mkdir(path.dirname(path.join(projectRoot,'site',local)),{recursive:true});
          await writeFile(path.join(projectRoot,'site',local),bytes);downloaded.set(value,local);
        }
      }
      await readFile(path.join(projectRoot,'site',local));mapping.set(value,local);
    }
    city.photos=city.photos.map(value=>mapping.get(value));
    city.photoCaptions=Object.fromEntries(Object.entries(city.photoCaptions||{}).filter(([key])=>mapping.has(key)).map(([key,value])=>[mapping.get(key),value]));
    merged.set(city.id,city);
  }
  const result={...previous,revision:'pages-'+new Date().toISOString(),exportedAt:new Date().toISOString(),source:{url:origin.origin,mode:'published-snapshot'},cities:[...merged.values()].filter(city=>city.published)};
  const target=path.join(projectRoot,'data/catalog.json');
  await writeFile(target+'.tmp',JSON.stringify(result,null,2)+'\n');await rename(target+'.tmp',target);
  console.log(`Synced ${body.cities.length} published overrides; ${result.cities.length} destinations; ${downloaded.size} downloaded photos. Review changes, then commit and push.`);
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const index=process.argv.indexOf('--source-url');
  await syncCatalog(root,index>=0?process.argv[index+1]:undefined);
}
