// Advice is read-only. It uses the same search as the opponent AI and never resolves a move.
function createAIAdvisor({boards,match,effects,actions,strategy,info}){
  const tokens=new WeakMap();let serial=0,lastKey='',lastPlan=null;
  const token=x=>{if(!tokens.has(x))tokens.set(x,'hint-'+(++serial));return tokens.get(x)};
  const other=o=>o==='player'?'opponent':'player';
  const names={R:'빨강',O:'주황',Y:'노랑',G:'초록',B:'파랑',I:'남색',V:'보라'};
  function read(c){const m=info[c.dataset.cardId];return m?{...m,id:+c.dataset.cardId,token:token(c),power:effects.power(c),rested:c.classList.contains('rested'),canCall:effects.canColorCall(c),enteredTurn:+c.dataset.enteredTurn}:{token:token(c),type:'컬러',colors:[],faceUp:c.dataset.faceUp==='true',...(c.dataset.faceUp==='true'?{color:c.dataset.color}:{})}}
  // Only the advised owner's hand/set is read; enemy hidden cards are absent.
  function observe(owner){const b=boards.get(owner),e=boards.get(other(owner));return {turn:b.turn(),canSet:b.canSet?.()??true,hand:[...b.hand.children].map(read),set:b.set.querySelector('img')?read(b.set.querySelector('img')):null,units:[...b.field.children].map(read),enemyUnits:[...e.field.children].map(read),stage:b.stage.querySelector('img')?read(b.stage.querySelector('img')):null,log:[...b.log.children].map(read),deckCount:b.deckCount(),captured:e.colors.filter(c=>c.parentElement!==e.colorLine).map(c=>c.dataset.color),ownCaptured:b.colors.filter(c=>c.parentElement!==b.colorLine).map(c=>c.dataset.color),colors:[...e.colorLine.children].filter(c=>e.colors.includes(c)).map(read)}}
  function idle(title,detail=''){const key='wait:'+title+detail;if(lastKey!==key){lastKey=key;lastPlan={kind:'wait',title,detail,refs:[]}}return lastPlan}
  function recommend(){
    const state=match.state(),choice=effects.getChoice(),d=actions.getDecision();
    const owner=choice?.owner||d?.owner||state.active;
    if(state.scene==='lobby')return idle('대전을 시작하면 추천합니다.','AI 도움을 켜면 현재 상황에 맞는 다음 행동을 보여줍니다.');
    if(state.opening)return idle('시작 패를 확인하세요.','멀리건은 대전 시작 전 1회 사용할 수 있습니다.');
    if(state.winner||state.ending)return idle(state.winner?'대전이 종료되었습니다.':'승패 판정을 처리하고 있습니다.');
    if(state.enabled&&owner!=='player')return idle('상대 턴을 기다리는 중','내 행동이나 수비 선택이 가능해지면 추천을 갱신합니다.');
    if(effects.blocked()&&!choice&&!d)return idle('카드 효과를 처리하는 중','처리가 끝나면 추천을 갱신합니다.');
    const b=boards.get(owner),enemy=boards.get(other(owner)),s=observe(owner),payment=b.getPayment?.();
    const mainFlags={channel:effects.canActivateMain(owner,b.channel),stage:s.stage&&effects.canActivateMain(owner,b.stage.querySelector('img'))};
    const key=JSON.stringify({state,owner,s,phase:b.phase(),mainFlags,choice:choice&&[token(choice),choice.cards.map(read)],decision:d&&[token(d),d.kind,read(d.unit),d.target&&read(d.target),d.targets?.map(read),d.options?.map(o=>[o.kind,read(o.card)])],payment:payment&&[read(payment.card),payment.selected.map(read)]});
    if(key===lastKey)return lastPlan;
    const refs=[],add=(node,role='target')=>{if(node)refs.push({node,role})};
    const find=(list,id)=>[...list].find(c=>token(c)===id);
    const desc=c=>{const m=info[c.dataset.cardId];if(!m)return c.dataset.faceUp==='true'?`${names[c.dataset.color]} 컬러`:'뒷면 컬러';const zone=c.parentElement===b.hand?'손패':c.parentElement===b.field?'내 필드':c.parentElement===enemy.field?'상대 필드':c.parentElement===b.log?'내 로그':c.parentElement===b.set?'세트 카드':'';const index=zone&&c.parentElement?[...c.parentElement.children].indexOf(c)+1:0;return `${zone}${index?' '+index+'번':''} ${m.name} · Lv.${m.level??'—'}`.trim()};
    const plan=(kind,title,detail,items=[])=>({kind,owner,title,detail,items,refs});let result;
    const chance=unit=>{const p=strategy.call(s,read(unit));return p.probability>0?`색 일치 추정 ${(p.probability*100).toFixed(0)}% · 블로커 개입 전`:'현재 일치시킬 수 있는 색이 없습니다.'};
    function adviseColor(unit,targets){const p=strategy.call(s,read(unit)),known=find(targets,p.target);if(known?.dataset.faceUp==='true'){add(known);return `공개된 ${names[known.dataset.color]} 컬러를 선택하세요.`}const hidden=targets.filter(c=>c.dataset.faceUp!=='true');if(hidden.length){for(const c of hidden)add(c);return '뒷면 중 1장을 선택하세요. 공개 정보만으로 위치별 확률 차이는 없습니다.'}const target=targets.find(c=>c.dataset.faceUp==='true');if(target)add(target);return '일치하는 색이 없습니다. 남은 공개 컬러 1장을 선택해 해결하세요.'}
    if(choice){
      const picked=strategy.effect(s,{...choice,cards:choice.cards.map(read)}),selected=picked.map(id=>find(choice.cards,id)).filter(Boolean);selected.forEach(c=>add(c));
      result=plan('effect',selected.length?'이 효과의 추천 대상':'이번 효과는 발동하지 않기',choice.ordered?'아래 순서대로 선택한 뒤 효과를 확정하세요.':selected.length?'표시한 대상을 선택한 뒤 효과를 확정하세요.':'「발동하지 않음」을 선택하세요.',selected.map(desc));
    }else if(d?.kind==='reaction'){
      // Reverse public color view for attacker probability; never read attacker hand.
      const publicView={captured:s.ownCaptured,colors:[...b.colorLine.children].filter(c=>b.colors.includes(c)).map(read)};
      const options=d.options.map((o,i)=>({token:String(i),kind:o.kind,card:read(o.card)}));
      const picked=strategy.reaction(s,{action:d.action,unit:read(d.unit),target:d.target?read(d.target):null,options,probability:strategy.call(publicView,read(d.unit)).probability});
      const option=picked===null?null:d.options[+picked];if(option)add(option.card);
      result=plan('reaction',option?option.kind==='block'?'블로커로 막기':'수호 효과 사용':'막지 않고 진행',option?'해당 반응 카드를 선택하세요.':'수비 카드를 보존하고 상대 행동을 진행시키는 판단입니다.',option?[desc(option.card)]:[]);
    }else if(d?.kind==='color')result=plan('color','컬러 콜 대상 선택',adviseColor(d.unit,d.targets),[chance(d.unit)]);
    else if(d?.kind==='battle')result=plan('battle','배틀 확정',`${desc(d.unit)} (${effects.power(d.unit).toLocaleString()}) → ${desc(d.target)} (${effects.power(d.target).toLocaleString()})`,[effects.power(d.unit)>=effects.power(d.target)?'현재 파워라면 방어 유닛만 로그로 갑니다.':'현재 파워라면 공격 유닛이 로그로 갑니다.']);
    else if(payment){
      const costs=strategy.payment(s,token(payment.card));for(const id of costs||[])add(find([...b.hand.children,...b.field.children],id),'cost');
      result=costs===null?plan('payment-cancel','이 플레이 취소 권장','현재 AI가 평가할 수 있는 유효한 플레이 대상이 없습니다. 비용 선택창에서 취소하세요.'):plan('payment','AI 추천 비용 선택',`${desc(payment.card)}에 비용 ${payment.level}장을 지불합니다.`,refs.map(r=>desc(r.node)));
    }else if(b.phase()===1){
      const stage=b.stage.querySelector('img');
      if(mainFlags.stage&&b.deckCount()>0){add(stage);result=plan('activate','스테이지의 기동 메인 사용',`${info[stage.dataset.cardId].name}의 「기동 메인」 버튼을 누르세요.`)}
      else if(mainFlags.channel&&b.deckCount()>8&&b.log.children.length<20){add(b.channel);result=plan('activate','채널의 기동 메인 사용','채널의 「기동 메인」 버튼을 누르세요.')}
      else{const move=strategy.main(s);if(move){const source=find([...b.hand.children,...b.set.children],move.card);add(source);const costs=move.costs.map(id=>find([...b.hand.children,...b.field.children],id));costs.forEach(c=>add(c,'cost'));const destination=info[source.dataset.cardId].type==='스테이지'?'스테이지 칸':'필드';result=plan('play',desc(source),`${destination}로 드래그하세요. 비용 ${costs.length}장 · 다음 전개까지 비교한 AI 추천입니다.`,costs.map(c=>'비용: '+desc(c)))}else result=plan('advance','다음 페이즈로 이동','현재 AI가 자원 소모보다 이득이 크다고 평가한 전개가 없습니다.')}
    }else if(b.phase()===2){
      const move=strategy.action(s);if(move.kind==='pass')result=plan('advance','액션을 마치고 세트 페이즈로','현재 AI가 추천하는 추가 공격이나 컬러 콜이 없습니다.');
      else{const unit=find(b.field.children,move.unit);add(unit);if(move.kind==='battle'){const target=find(enemy.field.children,move.target);add(target);result=plan('attack','레스트 유닛과 배틀',`${desc(unit)}를 누른 뒤 ${desc(target)}를 누르세요.`,[`${effects.power(unit).toLocaleString()} 대 ${effects.power(target).toLocaleString()} · 동률이면 방어자만 로그`])}else{const targetText=adviseColor(unit,[...enemy.colorLine.children].filter(c=>enemy.colors.includes(c)));result=plan('call','컬러 콜',`${desc(unit)}를 누르고 아래 「컬러 콜」을 누르세요.`,[targetText,chance(unit)])}}
    }else if(b.phase()===3){const chosen=s.canSet===false?null:strategy.set?strategy.set(s):!s.set&&s.hand.length?[...s.hand].sort((a,c)=>strategy.cardPriority(c,s)-strategy.cardPriority(a,s))[0].token:null;if(chosen){const source=find(b.hand.children,chosen);add(source);result=plan('set',s.set?'세트 교체로 다음 드로우 준비':'손패 1장 세트',`${desc(source)}를 세트 칸으로 드래그하세요.`)}else result=plan('advance','다음 페이즈로 이동','「다음 페이즈」 버튼을 누르세요.');}
    else result=plan('advance',b.phase()===4?'턴 종료':'다음 페이즈로 이동','「다음 턴 시작」 또는 「다음 페이즈」 버튼을 누르세요.');
    lastKey=key;lastPlan=result;return result;
  }
  return {recommend};
}

function mountAIAdvisor({document,advisor,effects,actions}){
  const toggle=document.querySelector('#ai-help'),panel=document.querySelector('#ai-advice');let enabled=false,previous=null,marked=[];
  const label=()=>`AI 도움 ${enabled?'ON':'OFF'}`;
  function clear(){for(const n of marked)n.classList.remove('ai-advice-target','ai-advice-cost');marked=[]}
  function setEnabled(value){enabled=value;toggle.textContent=label();toggle.setAttribute('aria-pressed',String(enabled));panel.hidden=!enabled;previous=null;render()}
  function content(root,p,inline=false){root.replaceChildren();if(inline){const button=document.createElement('button');button.type='button';button.className='ai-advice-inline-toggle';button.textContent='AI 도움 ON';button.setAttribute('aria-pressed','true');button.onclick=()=>setEnabled(false);root.append(button)}const title=document.createElement('strong');title.textContent=p.title;const detail=document.createElement('p');detail.textContent=p.detail;root.append(title,detail);if(p.items?.length){const list=document.createElement('ul');for(const text of p.items){const li=document.createElement('li');li.textContent=text;list.append(li)}root.append(list)}const note=document.createElement('small');note.textContent='현재 AI 기준 추천 · 직접 선택해 진행하세요.';root.append(note)}
  function render(){
    if(!enabled){clear();for(const dialog of document.querySelectorAll('dialog[open]')){if(dialog.id!=='effect-dialog'&&dialog.id!=='action-dialog'&&!dialog.querySelector('[data-ui="paymentCards"]'))continue;let box=dialog.querySelector('.ai-advice-inline');if(!box){box=document.createElement('section');box.className='ai-advice-inline';dialog.prepend(box)}if(!box.adviceOff){box.replaceChildren();const button=document.createElement('button');button.type='button';button.textContent='AI 도움 OFF';button.setAttribute('aria-pressed','false');button.onclick=()=>setEnabled(true);box.append(button);box.adviceOff=true;box.advicePlan=null}}return}
    const p=advisor.recommend(),dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id==='effect-dialog'||d.id==='action-dialog'||d.querySelector('[data-ui="paymentCards"]'));
    if(p!==previous){clear();content(panel,p);previous=p;for(const {node,role} of p.refs||[]){node.classList.add(role==='cost'?'ai-advice-cost':'ai-advice-target');marked.push(node)}}
    for(const dialog of dialogs){let box=dialog.querySelector('.ai-advice-inline');if(!box){box=document.createElement('section');box.className='ai-advice-inline';box.setAttribute('aria-label','AI 추천');dialog.prepend(box)}if(box.advicePlan!==p){content(box,p,true);box.adviceOff=false;box.advicePlan=p}
      const choice=effects.getChoice(),decision=actions.getDecision();
      for(const button of dialog.querySelectorAll('[data-ui="effectChoice"],[data-ui="colorTarget"],[data-ui="reactionChoice"],.payment-choice')){
        let node=button.effectCard||button.costCard;if(button.dataset.ui==='colorTarget')node=decision?.targets[[...dialog.querySelectorAll('[data-ui="colorTarget"]')].indexOf(button)];if(button.dataset.ui==='reactionChoice')node=decision?.options[[...dialog.querySelectorAll('[data-ui="reactionChoice"]')].indexOf(button)]?.card;
        const ref=p.refs?.find(r=>r.node===node);button.classList.toggle('ai-advice-target',!!ref&&ref.role!=='cost');button.classList.toggle('ai-advice-cost',ref?.role==='cost');if(ref&&!marked.includes(button))marked.push(button);
      }
    }
  }
  toggle.onclick=()=>setEnabled(!enabled);setEnabled(false);
  return {render,setEnabled,isEnabled:()=>enabled};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createAIAdvisor,mountAIAdvisor};
