const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),network=require('./helpers/peer-network.cjs');
const ctx=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,Date});vm.runInContext(fs.readFileSync('public-lobby.js','utf8'),ctx);const create=vm.runInContext('createPublicLobby',ctx);
const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,10))}assert.ok(fn(),'directory condition timed out')};
test('public directory: external browser discovers a waiting host without knowing its room code, removes it when occupied',async()=>{
  const PeerCtor=network(),host=new PeerCtor('niji7-ABCDEFGH');let rowsA=[],rowsB=[];
  const a=create({PeerCtor,retryMs:10,heartbeatMs:30,connectHost:id=>host.connect(id,{metadata:{version:'niji7-directory-v3',role:'publisher'}}),onRooms:x=>rowsA=x});
  const b=create({PeerCtor,retryMs:10,heartbeatMs:30,connectHost:()=>{throw Error('no host')},onRooms:x=>rowsB=x});
  try{a.start();a.setListing({code:'ABCDEFGH',deck:'mito',title:'공개 미토 방'});await until(()=>rowsA.length===1);b.start();await until(()=>rowsB.length===1);assert.equal(rowsB[0].code,'ABCDEFGH');assert.equal(rowsB[0].title,'공개 미토 방');a.setListing(null);await until(()=>rowsB.length===0)}finally{a.stop();b.stop();host.destroy()}
});
test('public directory: leader exit elects a replacement and host re-publishes; forged ownership is rejected',async()=>{
  const PeerCtor=network(),host=new PeerCtor('niji7-ABCDEFGH');let rowsA=[],rowsB=[],leadingA=false,leadingB=false;
  const a=create({PeerCtor,retryMs:10,heartbeatMs:30,connectHost:()=>{throw Error('no host')},onRooms:x=>rowsA=x,onStatus:s=>leadingA=s.leading});
  const b=create({PeerCtor,retryMs:10,heartbeatMs:30,connectHost:id=>host.connect(id,{metadata:{version:'niji7-directory-v3',role:'publisher'}}),onRooms:x=>rowsB=x,onStatus:s=>leadingB=s.leading});
  let impostor;
  try{a.start();await until(()=>leadingA);b.start();b.setListing({code:'ABCDEFGH',deck:'sasaki',title:'사쿠 방'});await until(()=>rowsA.length===1&&rowsB.length===1);a.stop();await until(()=>leadingB&&rowsB.length===1);impostor=new PeerCtor('unrelated');await new Promise(r=>setTimeout(r,20));const c=impostor.connect('niji7-public-lobby-v3',{metadata:{version:'niji7-directory-v3',role:'publisher'}});c.on('open',()=>c.send({version:'niji7-directory-v3',kind:'publish',code:'HGFEDCBA',deck:'mito',title:'가짜 방'}));await new Promise(r=>setTimeout(r,60));assert.equal(rowsB.length,1);assert.equal(rowsB[0].code,'ABCDEFGH')}finally{a.stop();b.stop();host.destroy();impostor?.destroy()}
});
