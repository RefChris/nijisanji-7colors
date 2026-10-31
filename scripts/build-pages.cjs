const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'dist');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const files=new Set(['index.html','output/card-back.svg','vendor/peerjs-LICENSE.txt']);
for(const m of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)){
  if(!m[1].startsWith('http')&&m[1]!== './')files.add(m[1]);
}
for(const letter of [...'ROYGBIV','back'])files.add(`output/color-cards/color-${letter}.png`);
for(let series=1;series<=4;series++)for(let n=1;n<=16;n++)files.add(`output/cards/NJ-SD0${series}/NJ-SD0${series}-${String(n).padStart(3,'0')}.png`);
for(const rel of files){
  const source=path.resolve(root,rel),target=path.resolve(dest,rel);
  if(!source.startsWith(root+path.sep)||!target.startsWith(dest+path.sep))throw Error('Invalid asset path');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
}
fs.writeFileSync(path.join(dest,'.nojekyll'),'');
console.log(`Pages build: ${files.size+1} files`);
module.exports={files:[...files]};
