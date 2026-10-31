// Closing a minimized dialog only changes its presentation, never its decision.
function createDecisionView(document,modal,onChange=()=>{}){
  const root=document.body,make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n};
  const dock=make('section','decision-dock');dock.hidden=true;dock.setAttribute('aria-label','필드 확인 중 · 선택 대기');
  const preview=make('img','decision-dock-image'),text=make('div','decision-dock-text'),title=make('strong',''),detail=make('span','');text.append(title,detail);
  const restore=make('button','','선택창 다시 열기');restore.type='button';restore.dataset.ui=modal.id+'Restore';dock.append(preview,text,restore);root.append(dock);
  let active=false,minimized=false;
  restore.onclick=()=>{if(!active||!minimized)return;minimized=false;dock.hidden=true;modal.showModal()};
  function show(label,context={}){
    active=true;minimized=false;dock.hidden=true;title.textContent=context.label||label;detail.textContent=context.detail||'선택을 유지한 채 필드를 확인하고 있습니다.';preview.hidden=!context.image;if(context.image){preview.src=context.image;preview.alt=context.label||label}
    const toolbar=make('div','decision-toolbar'),minimize=make('button','','필드 보기');minimize.type='button';minimize.dataset.ui=modal.id+'Minimize';minimize.setAttribute('aria-label',label+' 선택창 최소화 · 필드 보기');
    minimize.onclick=()=>{if(!active||!modal.open)return;minimized=true;modal.close();dock.hidden=false};toolbar.append(minimize);modal.append(toolbar);modal.showModal();onChange();
  }
  return {show,close:()=>{active=false;minimized=false;dock.hidden=true;modal.close();onChange()},active:()=>active,minimized:()=>minimized};
}
// Effects for registered cards; all choices are resolved in order.
function createCardEffects(document, info) {
  const boards=new Map(), bonuses=new Map(), usedMain=new Map(), usedWins=new Map(), stacks=new Map(),frozen=new Map(),callBans=new Map();
  let jobs=[], running=false, request=null, generation=0, specialCall=null,idleCallbacks=[];const arriving=new Set(),held=new Set();
  const root=document.body||document.createElement('div');
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
  const modal=el('dialog');modal.className='effect-dialog';modal.id='effect-dialog';modal.setAttribute('aria-label','카드 효과 처리');root.append(modal);
  const decisionView=createDecisionView(document,modal);
  const meta=card=>info[card.dataset.cardId];
  const enemy=owner=>[...boards.keys()].find(id=>id!==owner);
  const units=owner=>[...(boards.get(owner)?.field.children||[])].filter(c=>meta(c)?.type==='라이버');
  const logUnits=(owner,predicate)=>[...boards.get(owner).log.children].filter(c=>meta(c)?.type==='라이버'&&predicate(c));
  function refresh(){for(const b of boards.values())b.update()}
  function pump(){
    if(running)return;if(!jobs.length){const callbacks=idleCallbacks;idleCallbacks=[];for(const fn of callbacks)fn();return}
    running=true;const stamp=generation,job=jobs.shift();
    job(()=>{if(stamp!==generation)return;request=null;running=false;refresh();pump()});
  }
  function enqueue(job){jobs.push(job);pump()}
  function finishChoice(cards){
    if(!request)return;const next=request;request=null;decisionView.close();next.accept(cards);
  }
  function choose({owner,kind='revive',title,cards,min=1,max=1,ordered=false,optional=false,message='',accept}){
    if(!cards.length){accept([]);return}
    const selected=[];max=Math.min(max,cards.length);min=Math.min(min,max);
    const ticket={owner,kind,cards:[...cards],min,max,ordered,optional:optional||min===0,accept};request=ticket;
    ticket.resolve=chosen=>{if(request!==ticket||!Array.isArray(chosen)||new Set(chosen).size!==chosen.length||chosen.some(c=>!cards.includes(c))||chosen.length>max||chosen.length<min&&!(ticket.optional&&chosen.length===0))return false;finishChoice(chosen);return true};
    const heading=el('h2',title),description=el('p',message||(ordered?'덱 아래에 놓을 순서대로 선택하세요.':'효과 대상을 선택하세요.'));
    const choices=el('div');choices.className='effect-choices';
    const count=el('p');count.setAttribute('role','status');
    const confirm=el('button','효과 확정');confirm.type='button';confirm.dataset.ui='confirmEffect';
    function update(){
      confirm.disabled=selected.length<min||selected.length>max;count.textContent=`${selected.length} / ${max}장 선택`;
      for(const button of choices.children){const index=selected.indexOf(button.effectCard);button.classList.toggle('selected',index!==-1);button.setAttribute('aria-pressed',String(index!==-1));button.dataset.order=index<0?'':String(index+1)}
    }
    for(const card of cards){
      const button=el('button');button.type='button';button.className='effect-choice';button.dataset.ui='effectChoice';button.effectCard=card;
      const image=el('img');image.src=card.src||card.querySelector('img')?.src;image.alt=meta(card)?.name||'컬러 카드';image.draggable=false;
      button.append(image,el('span',meta(card)?`${meta(card).name} · Lv.${meta(card).level??'—'}`:card.dataset.faceUp==='true'?'공개된 컬러':'뒷면 컬러'));
      button.onclick=()=>{if(request!==ticket)return;const index=selected.indexOf(card);if(index!==-1)selected.splice(index,1);else if(selected.length<max)selected.push(card);update()};choices.append(button);
    }
    confirm.onclick=()=>{if(request===ticket&&!confirm.disabled)finishChoice([...selected])};
    const controls=el('div');controls.className='effect-controls';controls.append(confirm);
    if(optional||min===0){const skip=el('button','발동하지 않음');skip.type='button';skip.dataset.ui='skipEffect';skip.onclick=()=>{if(request===ticket)finishChoice([])};controls.append(skip)}
    update();modal.replaceChildren(heading,description,choices,count,controls);decisionView.show(title);refresh();
  }
  modal.addEventListener('cancel',event=>{event.preventDefault();if(request?.optional)finishChoice([])});
  function power(card){return (meta(card)?.power??0)+(bonuses.get(card)||[]).reduce((sum,b)=>sum+b.delta,0)}
  function signalPower(card){
    card.dataset.effectivePower=String(power(card));
    if(typeof CustomEvent!=='undefined'&&document.dispatchEvent)document.dispatchEvent(new CustomEvent('card-power-change'));
  }
  function modify(card,delta,expires){const list=bonuses.get(card)||[];list.push({delta,expires});bonuses.set(card,list);signalPower(card)}
  function clearPower(card){bonuses.delete(card);signalPower(card)}
  function drawCards(owner,count){const b=boards.get(owner);for(const card of b.takeTop(count))b.hand.append(card)}
  function activateUnit(owner,card,actor=owner){if(!card.classList.contains('rested'))return;card.classList.remove('rested');if(+card.dataset.cardId===206)enqueue(done=>{drawCards(owner,1);done()});if(+card.dataset.cardId===311)enqueue(done=>revealOther(owner,actor,done))}
  const allFront=owner=>boards.get(owner).colors.every(c=>c.parentElement!==boards.get(owner).colorLine||c.dataset.faceUp==='true');
  const shares=(a,b)=>meta(a)?.tags?.some(tag=>meta(b)?.tags?.includes(tag));
  function revealOther(owner,actor,done){const other=enemy(owner);if(!other){done();return}const b=boards.get(other);choose({owner,kind:'reveal',title:'상대 컬러 1장 공개',cards:[...b.colorLine.children].filter(c=>b.colors.includes(c)&&c.dataset.faceUp!=='true'),accept:cards=>{if(cards[0]){b.setColorFace(cards[0],true);channelTrigger(other,cards[0].dataset.color,true,actor)}done()}})}
  function returnHand(owner,card){clearPower(card);frozen.delete(card);callBans.delete(card);card.classList.remove('rested','set-hidden','action-selected','placed');boards.get(owner).hand.append(card)}
  function moveToSet(owner,card){const b=boards.get(owner);if(b.set.querySelector('img')){toLog(owner,card);return}clearPower(card);frozen.delete(card);callBans.delete(card);card.classList.remove('rested','action-selected');card.classList.add('placed');card.classList.add('set-hidden');b.set.append(card)}
  function toLog(owner,card,{battleActor=null}={}){
    frozen.delete(card);callBans.delete(card);
    clearPower(card);card.classList.remove('rested','set-hidden','action-selected');card.classList.add('placed');boards.get(owner).log.append(card);
    const b=boards.get(owner),channel=b.channel,token=battleActor?`${battleActor}:${boards.get(battleActor).turn()}`:null;
    if(battleActor&&battleActor!==owner&&+channel?.dataset.cardId===201&&usedWins.get(channel)!==token){
      usedWins.set(channel,token);enqueue(done=>{const under=stacks.get(channel)||[];card.remove();under.push(card);stacks.set(channel,under);channel.dataset.underCount=String(under.length);
        if(under.length<3){b.tell(`사사키 사쿠 채널: 아래에 ${under.length}/3장 축적`);done();return}
        choose({owner,kind:'bottom',title:'사사키 사쿠 채널 · 축적 카드 반환',cards:[...under],min:under.length,max:under.length,ordered:true,accept:order=>{bottom(owner,order);stacks.delete(channel);channel.dataset.underCount='0';drawCards(owner,Math.max(0,5-b.hand.children.length));done()}});
      });
    }
    if(battleActor&&battleActor!==owner&&+card.dataset.cardId===11){
      enqueue(done=>choose({owner,title:'쿠즈하 · 배틀 퇴장 효과',cards:logUnits(owner,c=>+c.dataset.cardId===10),accept:cards=>{if(cards[0])summon(owner,cards[0],battleActor);done()}}));
    }
    if(battleActor&&battleActor!==owner&&+card.dataset.cardId===313)enqueue(done=>{
      const top=b.takeTop(3);for(const c of top)held.add(c);
      choose({owner,title:'요루미 레나 · 덱 위 3장 중 부활',cards:top.filter(c=>meta(c)?.type==='라이버'&&meta(c).level<=2&&shares(card,c)),optional:true,accept:cards=>{
        if(cards[0]){held.delete(cards[0]);summon(owner,cards[0],battleActor,{rested:true})}
        const rest=top.filter(c=>c!==cards[0]);enqueue(finish=>choose({owner,kind:'bottom',title:'요루미 레나 · 남은 카드 덱 아래로',cards:rest,min:rest.length,max:rest.length,ordered:true,accept:order=>{for(const c of order)held.delete(c);bottom(owner,order);finish()}}));done();
      }});
    });
  }
  function bottom(owner,cards){for(const c of cards)clearPower(c);boards.get(owner).putBottom(cards)}
  function summon(owner,card,actor=owner,{rested=false}={}){
    // Reserve the incoming card while the owner chooses an existing unit to replace.
    card.remove();arriving.add(card);
    enqueue(done=>{
      const deploy=()=>{arriving.delete(card);frozen.delete(card);callBans.delete(card);clearPower(card);card.classList.remove('rested','set-hidden');if(rested)card.classList.add('rested');card.classList.add('placed');card.dataset.enteredTurn=String(boards.get(owner).turn());boards.get(owner).field.append(card);entered(owner,card,actor);done()};
      const current=units(owner),excess=current.length-4;
      if(excess>0)choose({owner,kind:'replace',title:'필드 최대 5장 · 교체할 라이버 선택',message:`새 라이버가 등장하도록 기존 라이버 ${excess}장을 트래시로 보내세요.`,cards:current,min:excess,max:excess,accept:cards=>{for(const c of cards)toLog(owner,c);deploy()}});
      else deploy();
    });
  }
  function pickEnemy(owner,title,predicate,apply,done){
    const other=enemy(owner);const cards=other?units(other).filter(predicate):[];
    choose({owner,kind:'enemy',title,cards,accept:selected=>{if(selected[0])apply(other,selected[0]);done()}});
  }
  function entered(owner,card,actor=owner){
    const id=+card.dataset.cardId,b=boards.get(owner);
    if([4,108,204,307].includes(id))enqueue(done=>choose({owner,kind:'buff',title:`${meta(card).name} · 등장 시 파워 증가`,cards:units(owner).filter(c=>c!==card),accept:cards=>{if(cards[0])modify(cards[0],meta(cards[0]).power>=7000?5000:3000,actor);done()}}));
    if(id===312)enqueue(done=>revealOther(owner,actor,()=>revealOther(enemy(owner),actor,done)));
    if(id===205)enqueue(done=>choose({owner,title:'사사키 사쿠 · 같은 이름의 라이버 부활',cards:logUnits(owner,c=>meta(c).name===meta(card).name&&meta(c).level<=1),optional:true,accept:cards=>{if(cards[0])summon(owner,cards[0],actor,{rested:b.colors.filter(c=>c.parentElement!==b.colorLine).length<5});done()}}));
    if(id===207&&b.colors.filter(c=>c.parentElement!==b.colorLine).length>=5)enqueue(done=>{drawCards(owner,1);done()});
    if(id===104)enqueue(done=>{const limit=b.colors.filter(c=>c.parentElement!==b.colorLine).length>=5?2:1;choose({owner,title:'시즈카 린 · 손패 #JK 라이버 등장',cards:[...b.hand.children].filter(c=>meta(c)?.type==='라이버'&&meta(c).tags?.includes('JK')&&meta(c).level<=limit),optional:true,accept:cards=>{if(cards[0])summon(owner,cards[0],actor);done()}})});
    if(id===110||id===113)enqueue(done=>pickEnemy(owner,'히구치 카에데 · 다음 스타트의 액티브 전환 방지',c=>c.classList.contains('rested')&&(id===113||meta(c).level<=2),(other,target)=>frozen.set(target,other),done));
    if(id===5)enqueue(done=>{
      const cards=b.takeTop(3),increase=cards.reduce((sum,c)=>sum+(meta(c)?.type==='라이버'?meta(c).power:0),0);
      choose({owner,kind:'bottom',title:`이브라힘 · 3장 공개 / 이번 턴 파워 +${increase.toLocaleString()}`,cards,min:cards.length,max:cards.length,ordered:true,accept:order=>{bottom(owner,order);if(card.parentElement===b.field)modify(card,increase,actor);done()}});
    });
    if(id===13&&b.log.children.length>=20)enqueue(done=>{
      const returnCards=()=>choose({owner,kind:'returnLog',title:'쿠즈하 · 로그의 라이버를 최대 2장 덱 아래로',cards:logUnits(owner,c=>meta(c).level<=2),min:0,max:2,ordered:true,optional:true,accept:cards=>{bottom(owner,cards);done()}});
      pickEnemy(owner,'쿠즈하 · 상대 라이버 파워 -4,000',()=>true,(other,target)=>modify(target,-4000,actor),returnCards);
    });
  }
  function played(owner,card){
    const id=+card.dataset.cardId;
    if(meta(card)?.type==='라이버'){summon(owner,card);return}
    if(id===14)enqueue(done=>pickEnemy(owner,'게임 시작 · 상대 Lv.5 이하 라이버 선택',c=>meta(c).level<=5,(other,target)=>modify(target,-10000,owner),done));
    if(id===15)enqueue(done=>pickEnemy(owner,'영웅의 일격 · 상대 라이버 파워 -3,000',()=>true,(other,target)=>modify(target,-3000,owner),()=>{
      choose({owner,title:'영웅의 일격 · 엑스 알비오 부활',cards:logUnits(owner,c=>meta(c).name==='엑스 알비오'&&meta(c).level<=2),optional:true,accept:cards=>{if(cards[0])summon(owner,cards[0]);done()}});
    }));
    if(id===114)enqueue(done=>choose({owner,kind:'buff',title:'근육 사랑 · 파워 +5,000',cards:units(owner),accept:cards=>{if(cards[0])modify(cards[0],5000,owner);done()}}));
    if(id===115)enqueue(done=>pickEnemy(owner,'압 · 상대 레스트 라이버를 트래시로',c=>meta(c).level<=6&&c.classList.contains('rested'),(other,target)=>toLog(other,target),done));
    if(id===214)enqueue(done=>pickEnemy(owner,'하앗! · 상대 라이버를 세트 에리어로',c=>meta(c).level<=5,(other,target)=>moveToSet(other,target),done));
    if(id===215)enqueue(done=>{for(const who of boards.keys())for(const unit of units(who))toLog(who,unit);done()});
    if(id===314)enqueue(done=>revealOther(owner,owner,()=>{if(!allFront(enemy(owner))){done();return}choose({owner,title:'슬리브 교체 · 레벨 1 이하 부활',cards:logUnits(owner,c=>meta(c).level<=1&&shares(card,c)),optional:true,accept:cards=>{if(cards[0])summon(owner,cards[0],owner,{rested:true});done()}})}));
    if(id===315)enqueue(done=>pickEnemy(owner,'대폭발 · 상대 라이버를 손패로',c=>meta(c).level<=5,(other,target)=>returnHand(other,target),done));
  }
  function canActivateMain(owner,source){
    const b=boards.get(owner);if(!b||!source||b.phase()!==1||b.blocked())return false;
    const id=+source.dataset.cardId;
    const valid=source===b.channel&&![101,201,301].includes(id)||([16,116,216].includes(id)&&source.parentElement===b.stage&&(id!==116||units(owner).filter(c=>meta(c).tags?.includes('JK')).length>=3)&&(id!==216||b.hand.children.length>0));
    return valid&&usedMain.get(source)!==`${owner}:${b.turn()}`;
  }
  function activateMain(owner,source){
    if(running||jobs.length||!canActivateMain(owner,source))return;
    const b=boards.get(owner);b.commit?.();usedMain.set(source,`${owner}:${b.turn()}`);
    if(+source.dataset.cardId===216){enqueue(done=>choose({owner,kind:'discard',title:'리로드 포인트 · 아래에 놓을 손패 1장',cards:[...b.hand.children],accept:selected=>{if(!selected[0]){done();return}const under=stacks.get(source)||[];const cost=selected[0];cost.remove();under.push(cost);stacks.set(source,under);b.stage.dataset.underCount=String(under.length);drawCards(owner,1);
      if(under.length<3){done();return}const cards=[source,...under];choose({owner,kind:'bottom',title:'리로드 포인트 · 스테이지와 축적 카드 반환',cards,min:cards.length,max:cards.length,ordered:true,accept:order=>{bottom(owner,order);stacks.delete(source);b.stage.dataset.underCount='0';drawCards(owner,1);done()}});
    }}));return}
    if(+source.dataset.cardId===116){enqueue(done=>choose({owner,kind:'buff',title:'NEVER GLOW UP · 파워 +1,000',cards:units(owner),accept:cards=>{if(cards[0])modify(cards[0],1000,owner);done()}}));return}
    if(source===b.channel){
      const cards=b.takeTop(1);for(const c of cards)toLog(owner,c);b.tell(`쿠즈하 채널: 덱 위 ${cards.length}장을 로그에 놓았습니다. (이번 턴 사용 완료)`);refresh();return;
    }
    enqueue(done=>{
      const under=stacks.get(source)||[];under.push(...b.takeTop(1));stacks.set(source,under);b.stage.dataset.underCount=String(under.length);
      if(under.length<3){b.tell(`흡혈귀의 밤: 아래에 ${under.length}/3장 축적`);done();return}
      const cards=[source,...under];
      choose({owner,kind:'bottom',title:'흡혈귀의 밤 · 스테이지와 축적 카드를 덱 아래로',cards,min:cards.length,max:cards.length,ordered:true,accept:order=>{
        bottom(owner,order);stacks.delete(source);b.stage.dataset.underCount='0';
        choose({owner,title:'흡혈귀의 밤 · Lv.4 이하 쿠즈하 부활',cards:logUnits(owner,c=>meta(c).name==='쿠즈하'&&meta(c).level<=4),accept:selected=>{if(selected[0])summon(owner,selected[0]);done()}});
      }});
    });
  }
  function channelTrigger(owner,color,newlyRevealed,actor=enemy(owner)){
    if(actor===owner)return;
    if(+boards.get(owner)?.channel?.dataset.cardId===301){if(newlyRevealed&&['O','I'].includes(color))enqueue(done=>revealOther(owner,actor,done));return}
    if(+boards.get(owner)?.channel?.dataset.cardId===201){if(newlyRevealed&&color==='B')enqueue(done=>{drawCards(owner,Math.max(0,5-boards.get(owner).hand.children.length));done()});return}
    if(+boards.get(owner)?.channel?.dataset.cardId===101){if(newlyRevealed&&['R','G'].includes(color))enqueue(done=>pickEnemy(owner,'츠키노 미토 채널 · 이번 턴 컬러 콜 금지',()=>true,(other,target)=>callBans.set(target,other),done));return}
    if(!newlyRevealed||!['I','V'].includes(color)||!boards.get(owner)?.channel)return;
    enqueue(done=>{
      const b=boards.get(owner);for(const c of b.takeTop(1))toLog(owner,c);
      if(b.log.children.length<20){b.tell('쿠즈하 채널 트리거: 덱 위 1장을 로그에 놓았습니다.');done();return}
      pickEnemy(owner,'쿠즈하 채널 트리거 · 상대 파워 4,000 이하 라이버 제거',c=>power(c)<=4000,(other,target)=>toLog(other,target),done);
    });
  }
  function wonBattle(owner,card,actor){
    if(card.parentElement!==boards.get(owner).field)return;
    if([7,111,211,308].includes(+card.dataset.cardId))enqueue(done=>{if(card.parentElement===boards.get(owner).field&&specialCall)specialCall(owner,card,done,actor);else done()});
    const b=boards.get(owner),channel=b.channel,winToken=`${owner}:${b.turn()}`;
    if(+channel?.dataset.cardId===101&&actor===owner&&usedWins.get(channel)!==winToken){usedWins.set(channel,winToken);enqueue(done=>{const other=enemy(owner),targetBoard=boards.get(other);choose({owner,kind:'reveal',title:'츠키노 미토 채널 · 상대 컬러 1장 공개',cards:targetBoard?[...targetBoard.colorLine.children].filter(c=>targetBoard.colors.includes(c)&&c.dataset.faceUp!=='true'):[],accept:cards=>{if(cards[0]){targetBoard.setColorFace(cards[0],true);channelTrigger(other,cards[0].dataset.color,true)}done()}})})}
    if(+card.dataset.cardId===9&&actor===owner&&+card.dataset.enteredTurn===boards.get(owner).turn())enqueue(done=>{
      const token=`${actor}:${boards.get(actor).turn()}`;
      if(usedWins.get(card)===token||card.parentElement!==boards.get(owner).field){done();return}
      choose({owner,kind:'discard',title:'엑스 알비오 · 손패 1장을 로그에 놓고 액티브',cards:[...boards.get(owner).hand.children],optional:true,accept:cards=>{if(cards[0]){toLog(owner,cards[0]);activateUnit(owner,card);usedWins.set(card,token)}done()}});
    });
  }
  function reactions(defender,kind,target){
    return units(defender).flatMap(card=>{
      if([2,102,203,302].includes(+card.dataset.cardId)&&!card.classList.contains('rested'))return [{kind:'block',card,label:'블로커 · 이 유닛과 배틀'}];
      if(kind==='battle'&&+card.dataset.cardId===6&&card.classList.contains('rested')&&meta(target)?.name!=='엑스 알비오')return [{kind:'protect',card,label:'수호 · 로그로 보내 배틀 중지'}];
      return [];
    });
  }
  function colorCallSucceeded(owner,card,actor=owner){
    const b=boards.get(owner),other=enemy(owner),id=+card.dataset.cardId,token=`${actor}:${boards.get(actor).turn()}`;
    if(id===305&&allFront(other)&&usedWins.get(card)!==token){usedWins.set(card,token);enqueue(done=>choose({owner,kind:'activate',title:'카가미 하야토 · 다른 라이버 액티브',cards:units(owner).filter(c=>meta(c).name!=='카가미 하야토'&&shares(card,c)&&c.classList.contains('rested')),accept:cards=>{if(cards[0])activateUnit(owner,cards[0],actor);done()}}))}
    if(id===309&&usedWins.get(card)!==token){usedWins.set(card,token);enqueue(done=>choose({owner,title:'하카세 후유키 · 로그의 이벤트 발동',cards:[...b.log.children].filter(c=>meta(c)?.type==='이벤트'&&meta(c).level<=2&&meta(c).tags?.includes('エンカウンター')),optional:true,accept:cards=>{const event=cards[0];if(event){event.remove();held.add(event);played(owner,event);enqueue(finish=>{held.delete(event);bottom(owner,[event]);finish()})}done()}}))}
    const stage=b.stage.querySelector('img');if(+stage?.dataset.cardId===316&&meta(card).tags?.includes('エンカウンター')&&allFront(other))enqueue(done=>choose({owner,title:'앙코르 스테이지 · 스테이지를 로그에 놓고 부활',cards:logUnits(owner,c=>meta(c).level<=3&&meta(c).tags?.includes('エンカウンター')),optional:true,accept:cards=>{if(cards[0]&&stage.parentElement===b.stage){toLog(owner,stage);summon(owner,cards[0],actor)}done()}}));
  }
  function endTurn(owner,after){
    for(const [card,expires] of callBans)if(expires===owner)callBans.delete(card);
    for(const [card,list] of bonuses){const remaining=list.filter(b=>b.expires!==owner);if(remaining.length)bonuses.set(card,remaining);else bonuses.delete(card);signalPower(card)}
    if(after)idleCallbacks.push(after);
    const b=boards.get(owner);if(+b?.channel?.dataset.cardId===301&&b.colors.some(c=>c.parentElement===b.colorLine&&c.dataset.faceUp!=='true'))enqueue(done=>choose({owner,kind:'endChannel',title:'카가미 채널 · 자신의 컬러를 공개하고 액티브',cards:[b.channel],optional:true,accept:cards=>{if(!cards[0]){done();return}const opponent=enemy(owner);choose({owner:opponent,kind:'reveal',title:'카가미 채널 · 상대의 뒷면 컬러 선택',cards:b.colors.filter(c=>c.parentElement===b.colorLine&&c.dataset.faceUp!=='true'),accept:colors=>{if(colors[0])b.setColorFace(colors[0],true);choose({owner,kind:'activate',title:'카가미 채널 · 레벨 1 이하 액티브',cards:units(owner).filter(c=>meta(c).level<=1&&c.classList.contains('rested')),accept:targets=>{if(targets[0])activateUnit(owner,targets[0],owner);done()}})}})}}));
    pump();
  }
  function reset(owner){
    generation++;jobs=[];running=false;request=null;idleCallbacks=[];held.clear();decisionView.close();
    arriving.clear();
    for(const card of frozen.keys())if(card.dataset.owner===owner)frozen.delete(card);
    for(const [card,expires] of callBans)if(card.dataset.owner===owner||expires===owner)callBans.delete(card);
    for(const [card,list] of [...bonuses]){if(card.dataset.owner===owner)clearPower(card);else{const keep=list.filter(b=>b.expires!==owner);if(keep.length)bonuses.set(card,keep);else bonuses.delete(card);signalPower(card)}}
    for(const [card] of usedMain)if(card===boards.get(owner)?.channel||card.dataset.owner===owner)usedMain.delete(card);
    for(const [card] of usedWins)if(card.dataset.owner===owner)usedWins.delete(card);
    for(const [card] of stacks)if(card.dataset.owner===owner)stacks.delete(card);
    if(boards.get(owner)?.stage)boards.get(owner).stage.dataset.underCount='0';if(boards.get(owner)?.channel)boards.get(owner).channel.dataset.underCount='0';
  }
  return {register:(owner,b)=>boards.set(owner,b),setSpecialCallHandler:handler=>{specialCall=handler},blocked:()=>running||jobs.length>0,
    startTurn:owner=>{for(const card of units(owner)){if(frozen.get(card)===owner)frozen.delete(card);else activateUnit(owner,card)}},
    canColorCall:card=>!callBans.has(card),
    battleEnded:(owner,card,actor)=>{const id=+card.dataset.cardId,b=boards.get(owner);
      if(id===209&&actor===owner&&+card.dataset.enteredTurn===b.turn()&&card.parentElement===b.field)activateUnit(owner,card);
      if([109,213].includes(id))enqueue(done=>choose({owner,title:id===109?'츠키노 미토 · 배틀 종료 시 #JK 부활':'마카이노 리리무 · 레벨 0 #게이머 부활',cards:logUnits(owner,c=>meta(c).level===0&&meta(c).tags?.includes(id===109?'JK':'ゲーマー')),optional:true,accept:cards=>{if(cards[0])summon(owner,cards[0],actor,{rested:id===213});done()}}));
    },
    played,activateMain,canActivateMain,channelTrigger,colorCallSucceeded,wonBattle,reactions,toLog,power,endTurn,reset,getChoice:()=>request,
    underCards:card=>[...(stacks.get(card)||[])],pendingCards:()=>[...arriving,...held]};
}
