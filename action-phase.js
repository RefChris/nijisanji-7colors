// Two-player action flow with blocker reactions and queued card effects.
function createActionGame(document,cardInfo,effects=null){
  const boards=new Map();let selected=null,pending=null,canCancel=()=>true;
  const root=document.body||document.createElement('div');
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function button(text,fn){const b=el('button','',text);b.type='button';b.onclick=fn;return b}
  const info=c=>cardInfo[c.dataset.cardId],enemyOf=o=>[...boards.keys()].find(id=>id!==o);
  const power=c=>effects?effects.power(c):info(c).power;
  const bar=el('div','unit-actions');bar.hidden=true;bar.setAttribute('aria-label','선택한 유닛 행동');
  const callButton=button('컬러 콜',()=>beginColorCall());callButton.dataset.ui='colorCall';
  bar.append(callButton,button('취소',()=>cancel()),el('small','','상대 레스트 유닛 클릭 → 배틀'));root.append(bar);
  const dialog=el('dialog','action-dialog');dialog.id='action-dialog';dialog.setAttribute('aria-label','액션 처리');root.append(dialog);
  const decisionView=createDecisionView(document,dialog,()=>{for(const b of boards.values())b.update()});let attackTarget=null;
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel()});
  function validUnit(owner,card,active=true){const b=boards.get(owner);return !!b&&card?.parentElement===b.field&&info(card)?.type==='라이버'&&(!active||!card.classList.contains('rested'))}
  function ready(allowRest=false,special=false){const b=selected&&boards.get(selected.owner);return b&&(special||b.phase()===2)&&!b.blocked()&&validUnit(selected.owner,selected.card,!allowRest)}
  function clearSelection(){if(selected)selected.card.classList.remove('action-selected','action-attacking');if(attackTarget)attackTarget.classList.remove('action-defending');attackTarget=null;selected=null;bar.hidden=true;for(const b of boards.values())b.field.classList.remove('battle-targets')}
  function closeDialog(){pending=null;decisionView.close()}
  function cancel(force=false){if(!force&&(pending?.special||pending?.committed||!canCancel(pending)))return;closeDialog();clearSelection()}
  function positionBar(){if(!selected?.card.getBoundingClientRect)return;const r=selected.card.getBoundingClientRect();bar.style.left=`${Math.max(8,Math.min(r.x+r.width/2-115,(typeof innerWidth==='number'?innerWidth:1280)-238))}px`;bar.style.top=`${r.bottom+6}px`}
  function selectUnit(owner,card){
    if(pending||effects?.blocked())return;
    if(selected&&selected.owner!==owner){beginBattle(owner,card);return}
    const b=boards.get(owner);if(!b||b.phase()!==2||b.blocked())return;
    // No entry-turn restriction: newly played active units may act immediately.
    if(!validUnit(owner,card)){b.tell('레스트 유닛은 행동할 수 없습니다. 액티브 유닛을 선택하세요.');return}
    if(selected?.card===card){cancel();return}
    clearSelection();selected={owner,card};card.classList.add('action-selected');callButton.disabled=!info(card).colors.length||effects?.canColorCall?.(card)===false;bar.hidden=false;positionBar();
    boards.get(enemyOf(owner))?.field.classList.add('battle-targets');b.tell('컬러 콜을 누르거나 상대의 레스트 유닛을 클릭해 배틀하세요.');
  }
  function availableColors(owner){const b=boards.get(owner);return b?[...b.colorLine.children].filter(c=>b.colors.includes(c)):[]}
  function openColorCall(special=false,after=null,actor=selected?.owner){
    if(!ready(special,special)||pending){after?.();return}
    const enemyId=enemyOf(selected.owner),enemy=boards.get(enemyId),targets=availableColors(enemyId);
    if(!enemy||!targets.length||!info(selected.card).colors.length){boards.get(selected.owner).tell('컬러 콜 가능한 대상 또는 유닛 컬러가 없습니다.');after?.();clearSelection();return}
    pending={actor,kind:'color',owner:selected.owner,enemy:enemyId,unit:selected.card,targets,special,after};
    const colorTicket=pending;colorTicket.resolve=target=>{if(pending===colorTicket)resolveColor(enemyId,target)};bar.hidden=true;
    const title=el('h2','',special?'SP 콜 · 상대 컬러 라인':'상대 컬러 라인');
    const help=el('p','',special?'SP 콜은 블로커로 중지할 수 없습니다. 컬러 1장을 선택하세요.':'뒷면 또는 공개된 카드 1장을 선택하세요. 선택하면 유닛이 레스트됩니다.');
    const choices=el('div','color-call-choices');
    for(const [index,target] of targets.entries()){
      const faceUp=target.dataset.faceUp==='true',choice=button('',()=>resolveColor(enemyId,target));choice.dataset.ui='colorTarget';
      choice.setAttribute('aria-label',faceUp?`${enemy.colorName(target.dataset.color)} · 공개된 컬러`:`${index+1}번 뒷면 컬러 카드`);
      const image=el('img');image.src=target.querySelector('img').src;image.alt=faceUp?enemy.colorName(target.dataset.color):'컬러 카드 뒷면';image.draggable=false;
      choice.append(image,el('span','',faceUp?enemy.colorName(target.dataset.color):`${index+1}번 · 뒷면`));choices.append(choice);
    }
    dialog.classList.remove('reaction-view');dialog.replaceChildren(title,help,choices);if(!special)dialog.append(button('취소',()=>cancel()));decisionView.show(title.textContent,{image:selected.card.src,label:`${info(selected.card).name} · ${special?'SP 콜':'컬러 콜'} 진행 중`,detail:`파워 ${power(selected.card).toLocaleString()} · 컬러 ${info(selected.card).colors.join(' / ')}`});
  }
  function resolveColor(enemyId,target){
    if(pending?.kind!=='color'||pending.enemy!==enemyId||!ready(!!pending.special,!!pending.special)||!availableColors(enemyId).includes(target)){const after=pending?.after;cancel(true);after?.();return}
    const attacker=boards.get(selected.owner),defender=boards.get(enemyId),unit=selected.card,matched=info(unit).colors.includes(target.dataset.color),actor=pending.actor||selected.owner,wasBack=target.dataset.faceUp!=='true',after=pending.after;
    const slot=defender.niji.children['ROYGBIV'.indexOf(target.dataset.color)];if(matched&&(!slot||slot.querySelector('.color-card'))){cancel(true);after?.();return}
    defender.setColorFace(target,true);unit.classList.add('rested');
    if(matched){slot.append(target);target.setAttribute('aria-label',`${defender.colorName(target.dataset.color)} · 니지 에리어`)}
    const name=defender.colorName(target.dataset.color),count=defender.colors.filter(c=>c.parentElement!==defender.colorLine).length;
    const message=matched?`${name} 일치! 상대 니지 에리어로 이동했습니다. (${count}/7색)`:`${name} 불일치. 컬러 라인에 앞면으로 남습니다.`;
    closeDialog();clearSelection();attacker.update();defender.update();attacker.tell(`${message}${count===7?' 7색 완성 · 트리거 처리 후 승리 판정을 확인하세요.':''}`);defender.tell(message,false);
    effects?.channelTrigger(enemyId,target.dataset.color,wasBack,actor);if(matched)effects?.colorCallSucceeded?.(unit.dataset.owner,unit,actor);after?.();
  }
  function toLog(owner,card,actor){if(effects){effects.toLog(owner,card,{battleActor:actor});return}card.classList.remove('rested','action-selected','set-hidden');card.classList.add('placed');boards.get(owner).log.append(card)}
  function openBattle(enemyId,target,committed=false){
    if(!ready(committed)||!validUnit(enemyId,target,false)||!target.classList.contains('rested')){cancel(true);return}
      const owner=selected.owner,unit=selected.card,a=power(unit),d=power(target);
      const loseAttacker=a<d,loseDefender=a>=d;
      const message=`배틀 자동 판정 · ${info(unit).name} ${a.toLocaleString()} : ${info(target).name} ${d.toLocaleString()} · ${loseDefender?'방어 유닛':'공격 유닛'} → 트래시${a===d?' (동률 · 방어자 퇴장)':''}`;
      unit.classList.add('rested');closeDialog();clearSelection();
      if(loseAttacker)toLog(owner,unit,owner);if(loseDefender)toLog(enemyId,target,owner);
      boards.get(owner).update();boards.get(enemyId).update();boards.get(owner).tell(message);boards.get(enemyId).tell(message,false);
      if(loseDefender&&!loseAttacker)effects?.wonBattle(owner,unit,owner);if(loseAttacker&&!loseDefender)effects?.wonBattle(enemyId,target,owner);effects?.battleEnded?.(owner,unit,owner);effects?.battleEnded?.(enemyId,target,owner);
  }
  function offerResponses(kind,enemyId,target,proceed){
    const options=effects?.reactions(enemyId,kind,target)||[];if(!options.length){proceed();return}
    pending={kind:'reaction',owner:enemyId,actor:selected.owner,unit:selected.card,target,action:kind,options};const reactionTicket=pending;bar.hidden=true;const choices=el('div','effect-choices');
    dialog.classList.add('reaction-view');
    selected.card.classList.add('action-attacking');attackTarget=target;if(target)target.classList.add('action-defending');
    const attack=selected.card,context=el('section','attack-context'),image=el('img');image.src=attack.src;image.alt=`공격 중인 ${info(attack).name}`;const details=el('div','attack-context-details');details.append(el('small','',kind==='battle'?'배틀 공격 중':'컬러 콜 시도 중'),el('strong','',info(attack).name),el('span','',`파워 ${power(attack).toLocaleString()} · 컬러 ${info(attack).colors.join(' / ')||'없음'}`));if(target)details.append(el('span','',`공격 대상: ${info(target).name} · ${power(target).toLocaleString()}`));context.append(image,details);context.setAttribute('aria-label','공격 중인 카드');
    const handlers=new Map();
    for(const option of options){const choice=button(option.label,()=>{
      if(pending!==reactionTicket)return;
      if(!ready()||!validUnit(enemyId,option.card,false)){cancel(true);return}
      const owner=selected.owner,unit=selected.card;unit.classList.add('rested');closeDialog();
      if(option.kind==='protect'){effects.toLog(enemyId,option.card);clearSelection();boards.get(owner).tell('엑스 알비오의 수호 효과로 배틀을 중지했습니다.');boards.get(owner).update();boards.get(enemyId).update()}
      else{option.card.classList.add('rested');openBattle(enemyId,option.card,true)}
    });handlers.set(option,choice.onclick);choice.dataset.ui='reactionChoice';const image=el('img');image.src=option.card.src;image.alt=info(option.card).name;choice.append(image);choices.append(choice)}
    const pass=button('반응하지 않고 진행',()=>{if(pending!==reactionTicket)return;closeDialog();proceed()});reactionTicket.resolve=option=>{if(pending!==reactionTicket)return;if(option===null)pass.onclick();else handlers.get(option)?.()};pass.dataset.ui='passReaction';dialog.replaceChildren(el('h2','','수비 측 반응'),context,el('p','','블로커 또는 수호 효과를 선택하세요. 반응 선택 후 파워를 자동 비교합니다.'),choices,pass);if(canCancel(pending))dialog.append(button('행동 취소',()=>cancel()));decisionView.show('수비 측 반응',{image:attack.src,label:`공격 중 · ${info(attack).name}`,detail:`${kind==='battle'?'배틀':'컬러 콜'} · 파워 ${power(attack).toLocaleString()} · 선택 대기`});
  }
  function beginColorCall(){if(!ready()||pending||effects?.blocked()||effects?.canColorCall?.(selected.card)===false)return;const other=enemyOf(selected.owner);if(!other||!info(selected.card).colors.length){openColorCall();return}offerResponses('color',other,null,()=>openColorCall())}
  function beginBattle(enemyId,target){if(!ready()||!validUnit(enemyId,target,false)||!target.classList.contains('rested')){boards.get(selected?.owner)?.tell('상대의 레스트 유닛을 선택하세요.');return}offerResponses('battle',enemyId,target,()=>openBattle(enemyId,target))}
  function specialColorCall(owner,card,done,actor=owner){if(!validUnit(owner,card,false)){done();return}clearSelection();selected={owner,card};card.classList.add('action-selected');openColorCall(true,()=>{clearSelection();done()},actor)}
  document.addEventListener?.('keydown',e=>{if(e.key==='Escape'&&!effects?.blocked())cancel()});document.addEventListener?.('scroll',positionBar,true);if(typeof window!=='undefined')window.addEventListener('resize',positionBar);
  return {register:(owner,b)=>boards.set(owner,b),selectUnit,beginColorCall,resolveColor,cancel,specialColorCall,setCancelPolicy:fn=>{canCancel=fn},getDecision:()=>pending,blocked:()=>!!pending||!!effects?.blocked()};
}
