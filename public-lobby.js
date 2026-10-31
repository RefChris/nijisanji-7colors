// A small, ephemeral public directory. A connected browser owns the directory
// peer ID; others re-elect a directory and re-publish waiting rooms if it leaves.
// Game state and private cards never pass through this directory.
function createPublicLobby({PeerCtor=Peer,peerOptions={},connectHost,onRooms=()=>{},onStatus=()=>{},retryMs=1500,heartbeatMs=5000,now=Date.now}={}){
  const directoryId='niji7-public-lobby-v3',version='niji7-directory-v3';
  let client=null,leader=null,viewer=null,publisher=null,listing=null,started=false,retry=null,pulse=null,watchdog=null,publicationTimeout=null,ready=false,lastRooms='';
  const records=new Map(),watchers=new Set(),links=new Set();
  const validCode=x=>typeof x==='string'&&/^[A-HJ-NP-Z2-9]{8}$/.test(x),validDeck=x=>['mito','kuzuha','sasaki','kagami'].includes(x);
  const cleanTitle=x=>String(x||'공개 대전방').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||'공개 대전방';
  const send=(c,data)=>{if(c?.open)c.send({version,...data})};
  const status=()=>onStatus({connected:ready,leading:!!leader?.open});
  function rooms(){const at=now();for(const [code,r] of records)if(!r.connection.open||at-r.at>90000)records.delete(code);return [...records.values()].map(({code,title,deck})=>({code,title,deck})).sort((a,b)=>a.code.localeCompare(b.code))}
  function broadcast(){const value=rooms();for(const c of watchers)send(c,{kind:'rooms',rooms:value})}
  function receive(c){
    if(c.metadata?.version!==version||!['viewer','publisher'].includes(c.metadata.role)||links.size>=512){c.close();return}
    const role=c.metadata.role;links.add(c);if(role==='viewer')watchers.add(c);
    c.on('open',()=>{if(role==='viewer')send(c,{kind:'rooms',rooms:rooms()})});
    c.on('data',data=>{
      if(!data||data.version!==version)return;
      if(role==='viewer'&&data.kind==='list'){send(c,{kind:'rooms',rooms:rooms()});return}
      if(role!=='publisher'||data.kind!=='publish'||!validCode(data.code)||!validDeck(data.deck)||c.peer!=='niji7-'+data.code)return;
      if(!records.has(data.code)&&records.size>=120)return;
      records.set(data.code,{code:data.code,deck:data.deck,title:cleanTitle(data.title),at:now(),connection:c});broadcast();
    });
    const remove=()=>{links.delete(c);watchers.delete(c);for(const [code,r] of records)if(r.connection===c)records.delete(code);broadcast()};c.on('close',remove);c.on('error',remove);
  }
  function later(){if(!started||retry)return;retry=setTimeout(()=>{retry=null;join()},retryMs)}
  function publish(){
    if(!started||!ready||!listing)return;
    if(publisher?.open){send(publisher,{kind:'publish',...listing});return}if(publisher)return;
    let c;try{c=connectHost(directoryId)}catch{return}publisher=c;
    publicationTimeout=setTimeout(()=>{if(publisher===c&&!c.open){publisher=null;c.close()}},10000);
    c.on('open',()=>{if(publisher===c&&listing){clearTimeout(publicationTimeout);send(c,{kind:'publish',...listing})}});
    const lost=()=>{if(publisher!==c)return;clearTimeout(publicationTimeout);publisher=null};c.on('close',lost);c.on('error',lost);
  }
  function elect(){
    if(!started||leader)return;
    const candidate=new PeerCtor(directoryId,{secure:true,...peerOptions});leader=candidate;
    candidate.on('connection',receive);
    candidate.on('open',()=>{if(!started||leader!==candidate)return;status();join()});
    candidate.on('error',()=>{if(leader!==candidate)return;leader=null;candidate.destroy();status();later()});
    candidate.on('disconnected',()=>{if(started&&!candidate.destroyed)candidate.reconnect()});
  }
  function join(){
    if(!started||!client?.open||viewer)return;
    const c=client.connect(directoryId,{reliable:true,serialization:'json',metadata:{version,role:'viewer'}});viewer=c;
    clearTimeout(watchdog);watchdog=setTimeout(()=>{if(viewer===c&&!ready){viewer=null;c.close();elect();later()}},8000);
    c.on('open',()=>{if(viewer!==c)return;clearTimeout(watchdog);ready=true;status();send(c,{kind:'list'});publish()});
    c.on('data',data=>{if(viewer!==c||data?.version!==version||data.kind!=='rooms'||!Array.isArray(data.rooms))return;const rows=data.rooms.slice(0,120).filter(r=>r&&validCode(r.code)&&validDeck(r.deck)).map(r=>({code:r.code,deck:r.deck,title:cleanTitle(r.title)}));const key=JSON.stringify(rows);if(key!==lastRooms){lastRooms=key;onRooms(rows)}});
    const lost=()=>{if(viewer!==c)return;clearTimeout(watchdog);clearTimeout(publicationTimeout);viewer=null;ready=false;publisher?.close();publisher=null;lastRooms='';onRooms([]);status();later()};c.on('close',lost);c.on('error',lost);
  }
  function start(){
    if(started)return;started=true;client=new PeerCtor(undefined,{secure:true,...peerOptions});
    client.on('open',join);
    client.on('error',e=>{if(!started)return;if(e.type==='peer-unavailable'){const old=viewer;viewer=null;old?.close();ready=false;status();elect();later()}else{ready=false;status();later()}});
    client.on('disconnected',()=>{if(started&&!client.destroyed)client.reconnect()});
    pulse=setInterval(()=>{if(!started)return;if(ready){send(viewer,{kind:'list'});publish()}else later();if(leader?.open)broadcast()},heartbeatMs);status();
  }
  function stop(){started=false;clearTimeout(retry);clearTimeout(watchdog);clearTimeout(publicationTimeout);clearInterval(pulse);retry=watchdog=pulse=null;viewer?.close();publisher?.close();for(const c of links)c.close();client?.destroy();leader?.destroy();client=leader=viewer=publisher=null;records.clear();links.clear();watchers.clear();ready=false;status()}
  return {start,stop,refresh:()=>{if(ready)send(viewer,{kind:'list'});else join()},setListing:value=>{const next=value&&validCode(value.code)&&validDeck(value.deck)?{code:value.code,title:cleanTitle(value.title),deck:value.deck}:null;if(JSON.stringify(next)!==JSON.stringify(listing)){clearTimeout(publicationTimeout);publisher?.close();publisher=null}listing=next;publish()}};
}
