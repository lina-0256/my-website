import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateProject,readCatalog} from './catalog.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
await validateProject(root);
const catalog=await readCatalog(root);
const dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(path.join(root,'site'),dist,{recursive:true});
await writeFile(path.join(dist,'catalog.js'),'window.TUJI_CATALOG = '+JSON.stringify(catalog).replace(/</g,'\\u003c')+';\n');
await writeFile(path.join(dist,'.nojekyll'),'');
console.log(`Built ${catalog.cities.length} destinations and ${new Set(catalog.cities.flatMap(city=>city.photos)).size} local photos into dist/`);
