import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../desktop/assets/', import.meta.url));
mkdirSync(directory, { recursive: true });
const crc = (buffer) => { let value = 0xffffffff; for (const byte of buffer) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); } return (value ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const name = Buffer.from(type); const head = Buffer.alloc(4); head.writeUInt32BE(data.length); const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([head, name, data, checksum]); };
function render(size, pixel) {
 const row = size * 4 + 1;
 const data = Buffer.alloc(row * size);
 for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const samples = [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([dx,dy])=>pixel((x+dx)/size,(y+dy)/size));
  for(let channel=0;channel<4;channel++) data[y*row+1+x*4+channel] = Math.round(samples.reduce((sum,p)=>sum+p[channel],0)/samples.length);
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);
}
const icon=(x,y)=>{
 const radius=Math.hypot(x-.5,y-.5);
 const qx=Math.max(Math.abs(x-.5)-.28,0), qy=Math.max(Math.abs(y-.5)-.28,0);
 if(Math.hypot(qx,qy)>.19)return [0,0,0,0];
 if(radius<.22)return [37,35,31,255];
 if(radius<.29)return [167,64,38,255];
 return [247,245,239,255];
};
const tray=(x,y)=>{const r=Math.hypot(x-.5,y-.5);return r<.36 && !(r>.22&&r<.28)?[0,0,0,255]:[0,0,0,0];};
writeFileSync(`${directory}/icon.png`,render(1024,icon));
writeFileSync(`${directory}/tray.png`,render(24,tray));
