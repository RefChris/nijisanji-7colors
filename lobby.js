function createLobbyFlow({match,random=Math.random,onChange=()=>{}}){
  let mode='ai',stage='ready',dice=null,firstOwner=null,decks={player:'mito',opponent:'kuzuha'};
  const state=()=>({mode,stage,dice:dice?{...dice}:null,firstOwner,decks:{...decks}});
  function open(){stage='ready';dice=null;firstOwner=null;match.enterLobby();onChange(state())}
  function setMode(value){if(stage==='match'||!['ai','local'].includes(value))return false;mode=value;stage='ready';dice=null;firstOwner=null;onChange(state());return true}
  function roll(){
    if(!['ready','tie'].includes(stage))return false;
    dice={player:1+Math.floor(random()*6),opponent:1+Math.floor(random()*6)};
    firstOwner=dice.player===dice.opponent?null:dice.player>dice.opponent?'player':'opponent';
    stage=firstOwner?'result':'tie';onChange(state());return true;
  }
  function setDeck(owner,key){if(stage==='match'||!['player','opponent'].includes(owner)||!['kuzuha','mito','sasaki','kagami'].includes(key))return false;decks[owner]=key;stage='ready';dice=null;firstOwner=null;onChange(state());return true}
  function start(){if(stage!=='result'||!firstOwner)return false;stage='match';match.setDecks?.(decks);match.reset(mode==='ai',firstOwner,undefined,true);onChange(state());return true}
  return {open,setMode,setDeck,roll,start,state};
}

function createGameLobby({match}){
  const root=document.querySelector('#lobby'),rollButton=document.querySelector('#lobby-roll'),startButton=document.querySelector('#lobby-start');
  let rolling=false,timer=null,epoch=0;
  const pips={0:[],1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  function render(s){
    root.hidden=s.stage==='match';root.setAttribute('aria-hidden',String(root.hidden));
    for(const button of root.querySelectorAll('[data-mode]')){button.setAttribute('aria-pressed',String(button.dataset.mode===s.mode));button.disabled=rolling}
    for(const owner of ['player','opponent']){const select=document.querySelector('#lobby-deck-'+owner);select.value=s.decks[owner];select.disabled=rolling}
    const selected=GameDeck.getDeck(s.decks.player);document.querySelector('#lobby-deck-image').src=GameDeck.imagePath(selected.channel);document.querySelector('#lobby-deck-image').alt=selected.name;document.querySelector('#lobby-deck-name').textContent=selected.name;
    document.querySelector('#lobby-opponent-name').textContent=s.mode==='ai'?'중급 AI':'플레이어 2';
    document.querySelector('#lobby-player-name').textContent=s.mode==='ai'?'나':'플레이어 1';
    for(const owner of ['player','opponent']){
      const die=document.querySelector('#die-'+owner),value=s.dice?.[owner]||0;
      die.dataset.value=String(value);die.classList.toggle('is-rolling',rolling);die.setAttribute('aria-label',`${owner==='player'?'내':'상대'} 주사위 ${value||'굴리기 전'}`);
      [...die.querySelectorAll('.die-pip')].forEach((pip,index)=>pip.classList.toggle('visible',pips[value].includes(index)));
      const order=document.querySelector('#order-'+owner);order.textContent=s.firstOwner?(s.firstOwner===owner?'선공 · 시작패 5장':'후공 · 시작패 7장'):'선후공 미정';order.classList.toggle('first',s.firstOwner===owner);
    }
    const opponent=s.mode==='ai'?'AI':'플레이어 2',player=s.mode==='ai'?'내가':'플레이어 1이';
    const message=rolling?'주사위를 굴리고 있습니다…':s.stage==='tie'?'같은 숫자입니다. 한 번 더 굴려주세요.':s.stage==='result'?`${s.firstOwner==='player'?player:opponent+'가'} 선공입니다.`:'주사위로 선후공을 정하세요.';
    document.querySelector('#lobby-roll-status').textContent=message;
    rollButton.disabled=rolling||s.stage==='result'||s.stage==='match';
    rollButton.hidden=s.stage==='result'||s.stage==='match';
    rollButton.textContent=rolling?'굴리는 중…':s.stage==='tie'?'다시 굴리기':s.stage==='result'?'선후공 결정 완료':'다이스 굴리기';
    startButton.hidden=s.stage!=='result';startButton.disabled=rolling||s.stage!=='result';
    document.querySelector('#lobby-roll-hint').textContent=s.stage==='result'?'결과가 확정되었습니다. 대전을 시작하세요.':'높은 숫자가 선공 · 같은 숫자면 다시 굴립니다.';
  }
  const flow=createLobbyFlow({match,onChange:render});
  const catalog=document.querySelector('#deck-catalog'),detail=document.querySelector('#deck-card-detail');
  document.querySelector('#lobby-card-list').onclick=()=>{
    const deck=GameDeck.getDeck(flow.state().decks.player),grid=document.querySelector('#deck-catalog-cards');
    document.querySelector('#deck-catalog-title').textContent=`${deck.name} · ${deck.entries.length+1}종 / 메인 50장 + 채널 1장`;grid.replaceChildren();
    for(const entry of [{id:deck.channel,count:1},...deck.entries]){
      const data=CardInfo[entry.id],button=document.createElement('button'),image=document.createElement('img'),name=document.createElement('strong'),stats=document.createElement('span');
      button.type='button';image.src=GameDeck.imagePath(entry.id);image.alt=data.name;image.draggable=false;name.textContent=`${data.name} ×${entry.count}`;stats.textContent=`${GameDeck.cardCode(entry.id)} · ${data.level===null?'채널':'Lv.'+data.level}`;button.append(image,name,stats);
      button.onclick=()=>{document.querySelector('#deck-detail-title').textContent=`${data.name} · ${GameDeck.cardCode(entry.id)}`;const img=document.querySelector('#deck-detail-image');img.src=image.src;img.alt=data.name;document.querySelector('#deck-detail-text').textContent=`레벨 ${data.level??'—'} / 파워 ${data.power?.toLocaleString('ko-KR')??'—'} / 컬러 ${data.colors.join(' · ')||'없음'}\n${data.effect}`;detail.showModal()};grid.append(button);
    }
    catalog.showModal();
  };
  document.querySelector('#deck-catalog-close').onclick=()=>catalog.close();document.querySelector('#deck-detail-close').onclick=()=>detail.close();
  const open=()=>{epoch++;if(timer!==null)clearTimeout(timer);timer=null;rolling=false;flow.open();rollButton.focus()};
  for(const button of root.querySelectorAll('[data-mode]'))button.onclick=()=>{if(!rolling)flow.setMode(button.dataset.mode)};
  for(const owner of ['player','opponent'])document.querySelector('#lobby-deck-'+owner).onchange=e=>{if(!rolling)flow.setDeck(owner,e.target.value)};
  rollButton.onclick=()=>{
    if(rolling||!['ready','tie'].includes(flow.state().stage))return;
    rolling=true;render(flow.state());const ticket=++epoch;
    timer=setTimeout(()=>{if(ticket!==epoch)return;timer=null;rolling=false;flow.roll();if(flow.state().stage==='result')startButton.focus();else rollButton.focus()},650);
  };
  startButton.onclick=()=>{if(rolling)return;if(flow.start())document.querySelector('#ai-restart').focus()};
  return {open,state:flow.state};
}

if(typeof module!=='undefined'&&module.exports)module.exports={createLobbyFlow};
