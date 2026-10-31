const NIJI_ONLINE_VERSION='7colors-online-20261031-v2';
function createOnlineRoom({PeerCtor=Peer,engineFactory=createOnlineEngine,onState=()=>{},onSnapshot=()=>{},onClock=()=>{},onError=()=>{},cryptoSource=crypto,peerOptions={}}={}){
  let peer=null,conn=null,engine=null,timer=null,heartbeat=null,clockTimer=null,seen=0,epoch=0;
  let state={stage:'idle',host:false,code:'',deck:'mito',guestDeck:null,selfReady:false,peerReady:false,connected:false};
  const validDeck=k=>['kuzuha','mito','sasaki','kagami'].includes(k),emit=()=>onState({...state}),safeSend=x=>{if(conn?.open)conn.send(x)};
  const byte=()=>{const x=new Uint8Array(1);cryptoSource.getRandomValues(x);return x[0]},roll=()=>{let n;do{n=byte()}while(n>=252);return n%6+1};
  const newCode=()=>Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte()%32]).join('');
  const clear=()=>{clearTimeout(timer);clearInterval(heartbeat);clearInterval(clockTimer);timer=heartbeat=clockTimer=null};
  function close(notify=true){epoch++;clear();const old=conn;conn=null;old?.close();peer?.destroy();peer=null;engine=null;state={...state,stage:'idle',connected:false,selfReady:false,peerReady:false,guestDeck:null};if(notify)emit()}
  function fail(message){close(false);state.stage='closed';emit();onError(message)}
  function publish(){if(!engine)return;onSnapshot(engine.snapshot('player'));safeSend({kind:'snapshot',version:NIJI_ONLINE_VERSION,value:engine.snapshot('opponent')});if(engine.clock?.().running===null){clearInterval(clockTimer);clockTimer=null}}
  function waiting(){safeSend({kind:'waiting',version:NIJI_ONLINE_VERSION,hostDeck:state.deck,guestDeck:state.guestDeck,hostReady:state.selfReady,guestReady:state.peerReady});emit()}
  function bind(c,host,ticket){
    c.on('open',()=>{if(ticket!==epoch)return;seen=Date.now();if(!host)clearTimeout(timer);state.connected=true;state.stage='waiting';if(!host)safeSend({kind:'hello',version:NIJI_ONLINE_VERSION,deck:state.deck});emit();heartbeat=setInterval(()=>{if(ticket!==epoch)return;if(Date.now()-seen>20000){fail('상대의 연결이 끊어졌습니다. 새 방을 만들어 다시 참여해 주세요.');return}safeSend({kind:'ping'})},5000)});
    c.on('data',data=>{
      if(ticket!==epoch||!data||typeof data!=='object')return;seen=Date.now();let size;try{size=JSON.stringify(data).length}catch{return}if(size>100000){fail('잘못된 연결 데이터입니다.');return}if(data.kind==='ping'){safeSend({kind:'pong'});return}if(data.kind==='pong')return;
      if(data.version!==NIJI_ONLINE_VERSION){fail('게임 버전이 다릅니다. 두 사람 모두 새로고침해 주세요.');return}
      if(host){
        if(data.kind==='hello'&&state.stage==='waiting'&&!state.guestDeck&&validDeck(data.deck)){clearTimeout(timer);state.guestDeck=data.deck;waiting()}
        else if(data.kind==='ready'&&state.stage==='waiting'&&state.guestDeck){state.peerReady=data.value===true;waiting()}
        else if(data.kind==='command'&&state.stage==='match'&&engine){try{engine.command('opponent',data.value);publish()}catch(e){safeSend({kind:'rejected',version:NIJI_ONLINE_VERSION,message:e.message});publish()}}
      }else{
        if(data.kind==='waiting'&&state.stage!=='match'){state.peerReady=data.hostReady===true;state.selfReady=data.guestReady===true;state.guestDeck=data.hostDeck;state.stage='waiting';emit()}
        else if(data.kind==='snapshot'&&data.value?.viewer==='opponent'){state.stage='match';emit();onSnapshot(data.value)}
        else if(data.kind==='clock'&&state.stage==='match')onClock(data.value);
        else if(data.kind==='rejected')onError(String(data.message||'행동을 다시 선택해 주세요.').slice(0,200));
        else if(data.kind==='full')fail('이미 두 명이 참가한 방입니다.');
      }
    });
    c.on('close',()=>{if(ticket===epoch)fail('상대가 방을 나갔거나 연결이 종료되었습니다.')});c.on('error',()=>{if(ticket===epoch)fail('상대와 연결하지 못했습니다. 네트워크를 바꾸거나 새 방으로 다시 시도해 주세요.')});
  }
  function connect(host,deck,code){
    if(!validDeck(deck))throw Error('덱을 선택해 주세요.');if(!host&&!/^[A-HJ-NP-Z2-9]{8}$/.test(code))throw Error('8자리 방 코드를 확인해 주세요.');close(false);const ticket=epoch;state={stage:'connecting',host,code:host?newCode():code,deck,guestDeck:null,selfReady:false,peerReady:false,connected:false};emit();
    peer=new PeerCtor(host?'niji7-'+state.code:undefined,{secure:true,...peerOptions});timer=setTimeout(()=>{if(ticket===epoch)fail('연결 시간이 초과되었습니다. 방 코드와 네트워크를 확인해 주세요.')},25000);
    peer.on('open',()=>{if(ticket!==epoch)return;if(host){clearTimeout(timer);state.stage='waiting';emit()}else{conn=peer.connect('niji7-'+code,{reliable:true,serialization:'json',metadata:{version:NIJI_ONLINE_VERSION}});bind(conn,false,ticket)}});
    peer.on('connection',c=>{if(ticket!==epoch)return;if(!host||conn||state.stage==='match'||c.metadata?.version!==NIJI_ONLINE_VERSION){c.on('open',()=>{c.send({kind:'full',version:NIJI_ONLINE_VERSION});setTimeout(()=>c.close(),150)});return}conn=c;bind(c,true,ticket);timer=setTimeout(()=>{if(ticket===epoch&&!state.guestDeck)fail('참가자의 응답이 없습니다. 새 방을 만들어 주세요.')},25000)});
    peer.on('error',e=>{if(ticket!==epoch||state.host&&e.type==='peer-unavailable')return;fail(e.type==='peer-unavailable'?'방을 찾지 못했습니다. 방장이 접속 중인지 확인해 주세요.':e.type==='unavailable-id'?'방 코드가 사용 중입니다. 방 만들기를 다시 눌러 주세요.':'방 연결 서비스에 접속하지 못했습니다. 잠시 후 다시 시도해 주세요.')});
    peer.on('disconnected',()=>{if(ticket===epoch&&conn?.open&&!peer.destroyed)peer.reconnect()});
  }
  return {state:()=>({...state}),host:deck=>connect(true,deck),join:(code,deck)=>connect(false,deck,String(code).trim().toUpperCase()),close,
    connectDirectory:id=>{if(!state.host||state.stage!=='waiting'||state.connected||!peer?.open)throw Error('공개할 대기 방이 없습니다.');return peer.connect(id,{reliable:true,serialization:'json',metadata:{version:'niji7-directory-v2',role:'publisher'}})},
    ready:value=>{if(state.stage!=='waiting'||!state.connected||!state.guestDeck)return;state.selfReady=!!value;if(state.host)waiting();else safeSend({kind:'ready',version:NIJI_ONLINE_VERSION,value:state.selfReady});emit()},
    start:()=>{if(!state.host||state.stage!=='waiting'||!state.connected||!state.selfReady||!state.peerReady)return false;let dice;for(let i=0;i<128;i++){dice={player:roll(),opponent:roll()};if(dice.player!==dice.opponent)break}if(dice.player===dice.opponent)return false;engine=engineFactory({playerDeck:state.deck,opponentDeck:state.guestDeck,first:dice.player>dice.opponent?'player':'opponent',dice});state.stage='match';emit();publish();if(engine.clock){clockTimer=setInterval(()=>{if(!engine)return;if(engine.tick()){publish();return}const value=engine.clock();onClock(value);safeSend({kind:'clock',version:NIJI_ONLINE_VERSION,value})},1000)}return true},
    command:input=>{if(state.stage!=='match'||!state.connected)return false;if(state.host){try{engine.command('player',input);publish()}catch(e){onError(e.message);publish()}}else safeSend({kind:'command',version:NIJI_ONLINE_VERSION,value:input});return true}
  };
}
