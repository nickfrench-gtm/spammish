import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const files = [];
function visit(path) { for (const entry of readdirSync(path, {withFileTypes:true})) { const target=join(path,entry.name); if(entry.isDirectory())visit(target);else if(/\.(?:mjs|cjs|js)$/.test(target))files.push(target); } }
for(const path of ['lib','desktop','scripts'])visit(path);
files.push('server.mjs','electron-builder.cjs');
for(const path of files){const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(result.status!==0)process.exit(1);}
console.log(`Syntax checks passed for ${files.length} source files.`);
