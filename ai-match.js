function createAIMatch({boards,effects,actions,strategy,info,onChange=()=>{},random=Math.random}){
  let active='player',on=true,paused=false,winner=null,reason='',deckResult=null,resetting=false,scene='match',preferredDecks=null;const started=new Set(['player']),tokens=new WeakMap();let serial=0,opening=null;
  const token=c=>{if(!tokens.has(c))tokens.set(c,String(++serial));return tokens.get(c)};
  const card=c=>{const data=info[c.dataset.cardId];if(!data)return {token:token(c),type:'컬러',colors:[],faceUp:c.dataset.faceUp==='true',...(c.dataset.faceUp==='true'?{color:c.dataset.color}:{})};return {token:token(c),id:+c.dataset.cardId,...data,power:effects.power(c),rested:c.classList.contains('rested'),canCall:effects.canColorCall?.(c)!==false,enteredTurn:+c.dataset.enteredTurn}};
  const other=owner=>owner==='player'?'opponent':'player';
  const collected=b=>b.colors.filter(c=>c.parentElement!==b.colorLine).map(c=>c.dataset.color);
  function observation(owner){
    const b=boards.get(owner),enemy=boards.get(other(owner));
    return {turn:b.turn(),hand:[...b.hand.children].map(card),set:b.set.querySelector('img')?card(b.set.querySelector('img')):null,
      units:[...b.field.children].map(card),enemyUnits:[...enemy.field.children].map(card),stage:b.stage.querySelector('img')?card(b.stage.querySelector('img')):null,
      log:[...b.log.children].map(card),deckCount:b.deckCount(),captured:collected(enemy),ownCaptured:collected(b),
      colors:[...enemy.colorLine.children].filter(c=>enemy.colors.includes(c)).map(c=>({token:token(c),faceUp:c.dataset.faceUp==='true',...(c.dataset.faceUp==='true'?{color:c.dataset.color}:{})}))};
  }
  const find=(list,id)=>[...list].find(c=>token(c)===id);
  function reset(enabled=on,firstOwner='player',decks=preferredDecks,withMulligan=false){
    if(!['player','opponent'].includes(firstOwner))return false;
    opening=withMulligan?{owner:firstOwner,used:false}:null;scene='match';on=enabled;paused=false;winner=null;reason='';deckResult=null;active=firstOwner;started.clear();started.add(firstOwner);resetting=true;
    try{for(const [owner,b] of boards){if(decks?.[owner])b.setDeck?.(decks[owner]);b.setRole?.(owner===firstOwner?'first':'second');b.reset()}}finally{resetting=false}onChange(state());return true;
  }
  function enterLobby(){opening=null;scene='lobby';paused=false;actions.cancel(true);for(const [owner,b] of boards){effects.reset(owner);b.suspend?.()}onChange(state())}
  function endTurn(owner){
    if(scene!=='match'||opening||winner||deckResult||owner!==active)return;
    active=other(owner);const b=boards.get(active);
    if(started.has(active))b.startTurn();else started.add(active);
    onChange(state());
  }
  function chooseOpening(owner,replace){if(!opening||owner!==opening.owner||typeof replace!=='boolean')return false;if(replace){if(opening.used||!boards.get(owner).mulligan?.())return false;opening.used=true}else{boards.get(owner).commit?.();opening=owner===active?{owner:other(owner),used:false}:null}onChange(state());return true}
  function state(){return {opening:opening?{...opening}:null,enabled:on,scene,paused,active,winner,reason,ending:!!deckResult&&!winner}}
  function noteDeckEmpty(owner){
    if(scene!=='match'||resetting||winner||deckResult)return;
    const mine=collected(boards.get('player')).length,theirs=collected(boards.get('opponent')).length;
    deckResult={winner:mine===theirs?other(owner):mine<theirs?'player':'opponent',reason:`덱 소진 · 내 니지 ${mine}장 / 상대 니지 ${theirs}장${mine===theirs?' · 동수로 덱이 소진된 쪽 패배':''}`};
    onChange(state());
  }
  function step(){
    if(scene!=='match'||winner||resetting)return false;
    if(opening){if(!on||opening.owner!=='opponent')return false;const cheap=observation('opponent').hand.filter(c=>c.type==='라이버'&&c.level<=1).length;chooseOpening('opponent',!opening.used&&cheap===0);return true}
    for(const [owner,b] of boards)if(b.deckCount()===0)noteDeckEmpty(owner);
    if((!on||paused)&&!deckResult){
      if(!effects.blocked()&&!actions.blocked())for(const owner of ['player','opponent'])if(collected(boards.get(other(owner))).length===7){winner=owner;reason='7색 완성';onChange(state());return true}
      return false;
    }
    const choice=effects.getChoice();
    if(choice){
      if(choice.owner!=='opponent')return false;
      const picked=strategy.effect(observation('opponent'),{...choice,cards:choice.cards.map(card)});
      choice.resolve(picked.map(id=>find(choice.cards,id)));onChange(state());return true;
    }
    const decision=actions.getDecision();
    if(decision){
      if(decision.owner!=='opponent')return false;
      const s=observation('opponent');
      if(decision.kind==='reaction'){
        const attacker=observation(decision.actor),unit=card(decision.unit);
        const options=decision.options.map((o,i)=>({token:String(i),kind:o.kind,card:card(o.card)}));
        const picked=strategy.reaction(s,{action:decision.action,unit,target:decision.target?card(decision.target):null,options,probability:strategy.call(attacker,unit).probability});
        decision.resolve(picked===null?null:decision.options[+picked]);
      }else if(decision.kind==='color'){
        const result=strategy.call(s,card(decision.unit));let target=find(decision.targets,result.target)||decision.targets.find(c=>c.dataset.faceUp==='true')||decision.targets[0];
        // Hidden positions are sampled uniformly. The strategy never sees their colors.
        if(target?.dataset.faceUp!=='true'){const hidden=decision.targets.filter(c=>c.dataset.faceUp!=='true');target=hidden[Math.floor(random()*hidden.length)]}
        if(target)decision.resolve(target);
      }else if(decision.kind==='battle')decision.resolve();
      onChange(state());return true;
    }
    if(effects.blocked()||actions.blocked()||[...boards.values()].some(b=>b.blocked()))return false;
    if(deckResult){winner=deckResult.winner;reason=deckResult.reason;actions.cancel(true);onChange(state());return true}
    // Finish queued triggers before the practice match's seven-color victory check.
    for(const owner of ['player','opponent'])if(collected(boards.get(other(owner))).length===7){winner=owner;reason='7색 완성';actions.cancel(true);onChange(state());return true}
    if(active!=='opponent')return false;
    const b=boards.get('opponent'),s=observation('opponent');
    if(b.phase()===1){
      const stage=b.stage.querySelector('img');
      if(stage&&effects.canActivateMain('opponent',stage)&&b.deckCount()>0){effects.activateMain('opponent',stage);onChange(state());return true}
      if(effects.canActivateMain('opponent',b.channel)&&b.deckCount()>8&&b.log.children.length<20){effects.activateMain('opponent',b.channel);onChange(state());return true}
      const move=strategy.main(s);
      if(move){const c=find([...b.hand.children,...b.set.children],move.card),costs=move.costs.map(id=>find([...b.hand.children,...b.field.children],id));if(c&&b.play(c,costs)){b.tell('AI가 손패·필드 비용과 다음 전개를 비교해 플레이했습니다.');onChange(state());return true}}
    }else if(b.phase()===2){
      const move=strategy.action(s);
      if(move.kind!=='pass'){
        const unit=find(b.field.children,move.unit);actions.selectUnit('opponent',unit);
        if(move.kind==='call')actions.beginColorCall();else actions.selectUnit('player',find(boards.get('player').field.children,move.target));
        b.tell(move.kind==='call'?'AI가 색 확보를 위해 컬러 콜을 선택했습니다.':'AI가 유리한 배틀을 선택했습니다.');onChange(state());return true;
      }
    }else if(b.phase()===3&&b.hand.children.length){
      const chosen=strategy.set?strategy.set(s):!s.set?[...s.hand].sort((a,c)=>strategy.cardPriority(c,s)-strategy.cardPriority(a,s))[0]?.token:null;
      if(chosen&&b.setCard(find(b.hand.children,chosen))){onChange(state());return true}
    }
    b.advance();onChange(state());return true;
  }
  return {chooseOpening,setDecks:selection=>{preferredDecks={...selection}},step,endTurn,reset,enterLobby,state,observation,noteDeckEmpty,enabled:()=>on,managed:()=>scene==='match',pause:()=>{if(scene!=='match'||!on||winner)return;paused=!paused;onChange(state())}};
}

if(typeof module!=='undefined'&&module.exports)module.exports=createAIMatch;
else if(typeof GameBoards!=='undefined'&&GameBoards.size===2){
  const status=document.querySelector('#ai-status'),pause=document.querySelector('#ai-pause');
  let adviceUI=null;
  const openingDialog=document.createElement('dialog');openingDialog.className='mulligan-dialog';openingDialog.setAttribute('aria-label','시작 패 확인');document.body.append(openingDialog);
  openingDialog.addEventListener('cancel',e=>e.preventDefault());
  function renderOpening(s){
    openingDialog.close();if(!s.opening||globalThis.NijiOnline?.active()||s.enabled&&s.opening.owner==='opponent')return;
    const owner=s.opening.owner,b=GameBoards.get(owner),title=document.createElement('h2'),hint=document.createElement('p'),cards=document.createElement('div');
    title.textContent=(s.enabled?'내':owner==='player'?'플레이어 1':'플레이어 2')+' 시작 패 · '+b.hand.children.length+'장';hint.textContent=s.opening.used?'멀리건을 사용했습니다. 새 패를 확인하고 확정하세요.':'패 전체를 덱에 섞고 같은 장수로 다시 뽑을 수 있습니다. 대전당 1회입니다.';cards.className='mulligan-cards';
    for(const c of b.hand.children){const img=document.createElement('img');img.src=c.src;img.dataset.cardId=c.dataset.cardId;img.alt=CardInfo[c.dataset.cardId].name;cards.append(img)}
    const redraw=document.createElement('button'),keep=document.createElement('button');redraw.textContent='전체 다시 뽑기 (1회)';redraw.disabled=s.opening.used;redraw.onclick=()=>matchController.chooseOpening(owner,true);keep.textContent=s.opening.used?'이 패로 확정':'이 패로 시작';keep.onclick=()=>matchController.chooseOpening(owner,false);openingDialog.replaceChildren(title,hint,cards,redraw,keep);openingDialog.showModal();
  }
  function render(s){
    const inLobby=s.scene==='lobby';document.body.dataset.screen=inLobby?'lobby':'match';
    for(const element of document.querySelectorAll('body>header,body>main,body>.card-inspector')){element.inert=inLobby;element.setAttribute('aria-hidden',String(inLobby))}
    status.textContent=s.opening?'시작 패 확인 · 양쪽 확정 후 대전 시작':s.winner?(s.winner==='player'?'승리!':s.enabled?'AI 승리':'상대 승리')+' · '+s.reason:s.ending?'덱 소진 · 판정 처리 중':!s.enabled?(s.active==='player'?'플레이어 1 턴':'플레이어 2 턴'):s.paused?'AI 일시정지':s.active==='opponent'?'AI가 판단 중…':'내 턴 · 중급 AI';
    status.setAttribute('role','status');pause.hidden=!s.enabled;pause.textContent=s.paused?'AI 재개':'AI 일시정지';pause.disabled=!!s.winner;
    status.title=s.reason||status.textContent;
    for(const element of document.querySelectorAll('[data-player]')){
      const owner=element.dataset.player;element.classList.toggle('inactive-turn',inLobby||!!s.opening||!!s.winner||s.ending||owner!==s.active);
      if(owner==='opponent')element.querySelector('[data-ui="hand"]').classList.toggle('concealed',s.enabled);
      const b=GameBoards.get(owner);b.update();
      for(const control of element.querySelectorAll('button[data-ui],select[data-ui]')){
        if(!['next','skip','deck','activateChannel','activateStage','mulligan','reset','role','toggleHand'].includes(control.dataset.ui))continue;
        if(control.dataset.ui==='toggleHand')control.disabled=s.enabled;
        else if(inLobby||s.opening||s.winner||s.ending||owner!==s.active||['reset','role'].includes(control.dataset.ui)||s.enabled&&(owner==='opponent'||control.dataset.ui==='deck'))control.disabled=true;
      }
    }
    document.querySelector('.match-label').textContent=s.enabled?'AI 대전':'로컬 대전';
    renderOpening(s);adviceUI?.render();
  }
  matchController=createAIMatch({boards:GameBoards,effects:cardEffects,actions:actionGame,strategy:NijiAI,info:CardInfo,onChange:render});
  actionGame.setCancelPolicy(decision=>!matchController.enabled()||decision?.actor!=='opponent'&&decision?.owner!=='opponent');
  pause.onclick=()=>matchController.pause();
  const advisor=createAIAdvisor({boards:GameBoards,match:matchController,effects:cardEffects,actions:actionGame,strategy:NijiAI,info:CardInfo});
  adviceUI=mountAIAdvisor({document,advisor,effects:cardEffects,actions:actionGame});
  const lobby=createGameLobby({match:matchController});
  document.querySelector('#ai-restart').onclick=()=>lobby.open();
  // Public card inspection remains available. AI board moves and out-of-turn
  // controls are blocked at input time; decision dialogs remain interactive.
  for(const event of ['click','dblclick','dragstart','drop','change','keydown'])document.addEventListener(event,e=>{
    if(globalThis.NijiOnline?.active())return;
    const s=matchController.state();
    if(e.target.closest?.('[data-ui="openTrash"],[data-ui="closeTrash"],[data-ui="trashDialog"]'))return;
    if(s.enabled&&(e.target.closest?.('#effect-dialog')&&cardEffects.getChoice()?.owner==='opponent'||e.target.closest?.('#action-dialog')&&actionGame.getDecision()?.owner==='opponent')){e.preventDefault();e.stopImmediatePropagation();return}
    const board=e.target.closest?.('[data-player]');if(!board)return;
    if(e.target.closest('summary')||!s.enabled&&e.target.closest('[data-ui="toggleHand"]'))return;
    const fieldTarget=e.target.closest('.field-cards img');
    if(s.scene==='match'&&!s.winner&&!s.ending&&(!s.enabled||s.active==='player')&&board.dataset.player!==s.active&&fieldTarget&&event==='click')return;
    const manualDrop=event==='drop'&&e.target.closest('[data-zone="log"],[data-ui="hand"]');
    const forbidden=s.scene!=='match'||s.opening||s.winner||s.ending||board.dataset.player!==s.active||e.target.closest('[data-ui="reset"],[data-ui="role"]')||s.enabled&&(board.dataset.player==='opponent'||manualDrop||e.target.closest('[data-ui="deck"]'));
    if(forbidden){e.preventDefault();e.stopImmediatePropagation()}
  },true);
  lobby.open();
  setInterval(()=>{if(globalThis.NijiOnline?.active())return;try{matchController.step();adviceUI.render()}catch(error){console.error('AI turn failed',error);if(!matchController.state().paused)matchController.pause();status.textContent='AI가 멈췄습니다 · 새 대전으로 다시 시작해주세요.'}},450);
}
