const cardEffects=createCardEffects(document,CardInfo);
const GameBoards=new Map();
let matchController=null;
const actionGame=createActionGame(document,CardInfo,cardEffects);
cardEffects.setSpecialCallHandler((owner,card,done,actor)=>actionGame.specialColorCall(owner,card,done,actor));
function initializeBoard(document,playerId='player'){
let deckKey='kuzuha',ids=GameDeck.createDeck(deckKey);let deck=[...ids],phase=1,serial=0;
let turn=1,role='first',setUsed=false,mulliganUsed=false,setupOpen=true;
let noticeTimer;
const tell=(message,notify=true)=>{
  document.querySelector('#ruleMessage').textContent=message;
  const notice=document.querySelector('#notice');
  if(notice){
    clearTimeout(noticeTimer);
    notice.hidden=!notify;
    notice.textContent=message;
    if(notify)noticeTimer=setTimeout(()=>{notice.hidden=true},6000);
  }
};
function shuffle(cards){for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}return cards}
const labels=['스타트 페이즈','메인 페이즈','액션 페이즈','세트 페이즈','엔드 페이즈'];
const colors=['#bd0b3c','#da601d','#d9ae13','#168850','#178eb8','#354f91','#935491'];
const file=id=>GameDeck.cardCode(id)+'.png';
const hand=document.querySelector('#hand');
let payment=null;
const paymentDialog=document.querySelector('#paymentDialog');
if(!paymentDialog.id)paymentDialog.id='payment-dialog-'+playerId;
const paymentView=createDecisionView(document,paymentDialog);
function cancelPayment(){payment=null;paymentView.close();update()}
function refreshPayment(){
  if(!payment)return;
  document.querySelector('#paymentCount').textContent=`${payment.selected.size} / ${payment.level}장 선택`;
  document.querySelector('#confirmPayment').disabled=payment.selected.size!==payment.level;
}
function isCostCard(cost,played){return cost!==played&&(cost.parentElement===hand||cost.parentElement===document.querySelector('.field-cards')&&CardInfo[cost.dataset.cardId]?.type==='라이버')}
function finishPayment(){
  if(!payment)return;
  const {card,origin,level,selected,target,action}=payment;
  if(phase!==1||card.parentElement!==origin||selected.size!==level||[...selected].some(c=>!isCostCard(c,card))){
    cancelPayment();tell('카드 상태가 바뀌어 플레이를 취소했습니다. 다시 시도하세요.');return;
  }
  if(action==='스테이지 배치'&&target.querySelector('img')){cancelPayment();tell('스테이지 칸이 이미 사용 중입니다.');return}
  const fieldCosts=[...selected].filter(c=>c.parentElement!==hand).length;
  for(const cost of selected)cardEffects.toLog(playerId,cost);
  card.classList.add('placed');card.classList.remove('rested','set-hidden');target.append(card);
  if(action==='라이버 등장')card.dataset.enteredTurn=String(turn);
  setupOpen=false;payment=null;paymentView.close();update();tell(`${action}: 손패 ${level-fieldCosts}장 · 필드 캐릭터 ${fieldCosts}장으로 비용을 지불했습니다.`);cardEffects.played(playerId,card);
}
function requestPlay(card,destination){
  if(phase!==1){tell('카드는 메인 페이즈에 플레이할 수 있습니다.');return}
  const origin=card.parentElement;
  if(origin!==hand&&origin!==document.querySelector('[data-zone="set"]')){tell('손패 또는 세트된 카드만 플레이할 수 있습니다.');return}
  const type=CardInfo[card.dataset.cardId]?.type;
  if(!type||type==='채널'){tell('플레이할 수 없는 카드입니다.');return}
  if((type==='스테이지')!==(destination==='stage')){tell(type==='스테이지'?'스테이지 카드는 스테이지 칸으로 드래그하세요.':'스테이지 칸에는 스테이지 카드만 배치할 수 있습니다.');return}
  const action=type==='라이버'?'라이버 등장':type==='이벤트'?'이벤트 사용':'스테이지 배치';
  const target=type==='라이버'?document.querySelector('.field-cards'):document.querySelector(`[data-zone="${type==='스테이지'?'stage':'log'}"]`);
  if(type==='스테이지'&&target.querySelector('img')){tell('스테이지 칸이 이미 사용 중입니다.');return}
  const level=CardLevels[card.dataset.cardId];
  if(!Number.isInteger(level)||level<0){tell('카드 레벨을 확인할 수 없어 플레이하지 않았습니다.');return}
  const candidates=[...hand.children,...document.querySelector('.field-cards').children].filter(c=>isCostCard(c,card));
  if(candidates.length<level){tell(`레벨 ${level} 비용이 부족합니다. 내릴 카드 외에 손패 또는 필드 캐릭터 ${level}장이 필요합니다.`);return}
  payment={card,origin,level,selected:new Set(),target,action};
  if(level===0){finishPayment();return}
  document.querySelector('#paymentTitle').textContent=`${card.alt} · 레벨 ${level} 비용`;
  document.querySelector('#confirmPayment').textContent=`비용 지불 후 ${action}`;
  const choices=document.querySelector('#paymentCards');choices.replaceChildren();
  for(const cost of candidates){
    const button=document.createElement('button');button.type='button';button.className='payment-choice';button.costCard=cost;button.setAttribute('aria-pressed','false');
    const preview=document.createElement('img');preview.src=cost.src;preview.alt=cost.alt;
    const source=document.createElement('span');source.className='payment-source';source.textContent=cost.parentElement===hand?'손패':`필드 · ${cost.classList.contains('rested')?'레스트':'액티브'}`;button.append(preview,source);
    button.onclick=()=>{
      if(!payment)return;
      if(payment.selected.has(cost))payment.selected.delete(cost);else if(payment.selected.size<payment.level)payment.selected.add(cost);
      const active=payment.selected.has(cost);button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));refreshPayment();
    };choices.append(button);
  }
  refreshPayment();update();paymentView.show('비용 카드 선택',{image:card.src,label:`${CardInfo[card.dataset.cardId].name} · 비용 ${level}장`,detail:'선택한 비용 카드를 유지하고 필드를 확인합니다.'});
}
document.querySelector('#confirmPayment').onclick=finishPayment;
document.querySelector('#cancelPayment').onclick=cancelPayment;
paymentDialog.addEventListener('cancel',event=>{event?.preventDefault?.();cancelPayment()});
paymentDialog.addEventListener('close',()=>{if(paymentView.active())return;payment=null;update()});
const trashDialog=document.querySelector('#trashDialog');
function updateTrash(){
  const log=document.querySelector('[data-zone="log"]'),cards=[...log.children].filter(c=>c.dataset.cardId);
  log.dataset.count=String(cards.length);
  const count=document.querySelector('#trashCount');if(count)count.textContent=`${cards.length}장`;
  if(!trashDialog?.open)return;
  document.querySelector('#trashTitle').textContent=`${playerId==='player'?'내':'상대'} 트래시 · ${cards.length}장`;
  const list=document.querySelector('#trashCards');list.replaceChildren();
  for(const [i,card] of [...cards].reverse().entries()){
    const item=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');
    image.src=card.src;image.alt=CardInfo[card.dataset.cardId]?.name||card.alt;image.dataset.cardId=card.dataset.cardId;image.dataset.owner=playerId;image.tabIndex=0;image.draggable=false;
    caption.textContent=`${i===0?'최근 · ':''}${image.alt}`;item.append(image,caption);list.append(item);
  }
  if(!cards.length){const empty=document.createElement('p');empty.textContent='트래시가 비어 있습니다.';list.append(empty)}
}
const openTrash=document.querySelector('#openTrash');
if(openTrash)openTrash.onclick=()=>{trashDialog.showModal();updateTrash()};
const closeTrash=document.querySelector('#closeTrash');if(closeTrash)closeTrash.onclick=()=>trashDialog.close();
const colorCards=[];
const colorNames=['빨강','주황','노랑','초록','파랑','남색','보라'];
function setColorFace(button,faceUp){
  const image=button.querySelector('img');
  const name=colorNames['ROYGBIV'.indexOf(button.dataset.color)];
  button.dataset.faceUp=String(faceUp);
  image.src=faceUp?`output/color-cards/color-${button.dataset.color}.png`:'output/color-cards/color-back.png';
  image.alt=faceUp?`${name} 컬러 카드`:'컬러 카드 뒷면';
  button.setAttribute('role','img');
  button.setAttribute('aria-label',faceUp?`${name} 컬러 카드`:'컬러 카드 뒷면');
}
for(let i=0;i<7;i++){
  const card=document.createElement('div');card.tabIndex=0;card.className='color-card';card.dataset.color='ROYGBIV'[i];
  const image=document.createElement('img');image.draggable=false;card.append(image);
  colorCards.push(card);setColorFace(card,false);document.querySelector('#colors').append(card);
  const slot=document.createElement('div');slot.className='niji-slot';slot.style.setProperty('--color',colors[i]);slot.textContent='ROYGBIV'[i];document.querySelector('#niji').append(slot);
}
function update(){hand.style.setProperty('--hand-count',String(Math.max(1,hand.children.length)));document.querySelector('#deckCount').textContent=deck.length;document.querySelector('#handCount').textContent=hand.children.length;document.querySelector('#empty').hidden=hand.children.length>0;document.querySelector('#turnCount').textContent=`${role==='first'?'선공':'후공'} · 내 ${turn}번째 턴`;document.querySelector('#mulligan').disabled=!setupOpen||mulliganUsed;
  updateTrash();
  const underLabel=document.querySelector('#channelUnderCount');if(underLabel){const n=cardEffects.underCards(document.querySelector('.channel img')).length;underLabel.textContent='축적 '+n+'/3';underLabel.hidden=n===0}
  document.querySelector('#next').textContent=phase===4?'다음 턴 시작 →':'다음 페이즈 →';
  document.querySelector('#next').disabled=!!payment||cardEffects.blocked();document.querySelector('#deck').disabled=!!payment||cardEffects.blocked();
  const skip=document.querySelector('#skip');if(skip){skip.disabled=!!payment||cardEffects.blocked();skip.textContent=phase===4?'턴 종료':'스킵 →'}
  const hint=document.querySelector('#phaseAction');if(hint)hint.textContent=[
    '유닛 활성화 · 손패 5장까지 자동 보충',
    '라이버·이벤트 → 필드 / 스테이지 → 전용 칸',
    '내 액티브 유닛 → 컬러 콜 / 상대 레스트 유닛 → 배틀',
    setUsed?'세트 완료 · 다음 페이즈로 진행하세요':'손패 1장 → 세트 칸 (선택 사항)',
    '턴 종료 · 다음 턴을 시작하세요'
  ][phase];
  document.querySelectorAll('[data-zone]').forEach(zone=>{
    const enabled=zone.dataset.zone==='field'?phase===1:zone.dataset.zone==='stage'?phase===1:zone.dataset.zone==='set'?phase===3&&!setUsed:false;
    zone.classList.toggle('phase-playable',enabled&&!payment&&!cardEffects.blocked());
  });
  for(const [id,source] of [['activateChannel',document.querySelector('.channel img')],['activateStage',document.querySelector('[data-zone="stage"]').querySelector('img')]]){
    const button=document.querySelector('#'+id);if(button){button.hidden=phase!==1||!source||id==='activateChannel'&&[101,201,301].includes(+source.dataset.cardId);button.disabled=!!payment||cardEffects.blocked()||!cardEffects.canActivateMain(playerId,source)}
  }
  const match=matchController?.state();
  if(match?.enabled||match?.scene||match?.winner||match?.ending){
    if(match.enabled||match.scene==='lobby'||match.winner||match.ending)document.querySelector('#deck').disabled=true;
    for(const id of ['reset','role'])document.querySelector('#'+id).disabled=true;
    if(match.scene==='lobby'||match.winner||match.ending||match.enabled&&playerId==='opponent'||match.active!==playerId)for(const id of ['next','skip','deck','mulligan','activateChannel','activateStage']){const control=document.querySelector('#'+id);if(control)control.disabled=true}
  }
}
function makeCard(id){const img=document.createElement('img');img.src=GameDeck.imagePath(id);img.dataset.cardId=id;img.alt=file(id).replace('.png','');img.dataset.owner=playerId;img.id=playerId+'-card-'+(++serial);img.draggable=true;img.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',img.id);e.dataTransfer.effectAllowed='move'});img.addEventListener('dblclick',()=>{if(img.parentElement===hand&&hand.classList.contains('concealed')||img.classList.contains('set-hidden')&&playerId!=='player')return;view(img.src)});img.addEventListener('click',()=>{if(img.parentElement.classList.contains('field-cards'))actionGame.selectUnit(playerId,img)});img.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&img.parentElement.classList.contains('field-cards')){e.preventDefault();actionGame.selectUnit(playerId,img)}});img.tabIndex=0;return img}
function view(src){const d=document.querySelector('#viewer');d.querySelector('img').src=src;d.showModal()}
function draw(count){let drawn=0;while(drawn<count&&deck.length){hand.append(makeCard(deck.shift()));drawn++}if(drawn&&deck.length===0)matchController?.noteDeckEmpty(playerId);return drawn}
document.querySelector('#deck').onclick=()=>{if(payment||actionGame.blocked()||matchController?.state().winner||matchController?.state().ending)return;setupOpen=false;tell(draw(1)?'수동 드로우 1장.':'덱이 비었습니다. 양쪽 니지 에리어의 장수로 승패를 판정합니다.');update()};
function setPhase(i){phase=i;document.querySelectorAll('[data-phase]').forEach(b=>{b.classList.toggle('active',+b.dataset.phase===i);b.disabled=+b.dataset.phase!==i});document.querySelector('#phaseLabel').textContent=labels[i]}
function advancePhase(skipped=false){
  if(matchController?.state().scene==='lobby'||matchController?.state().winner||matchController?.state().ending)return;
  if(payment||actionGame.blocked()){tell('진행 중인 비용 선택 또는 액션을 확정하거나 취소하세요.');return}
  actionGame.cancel();setupOpen=false;
  if(phase===4){
    if(matchController?.managed?.()??matchController?.enabled()){cardEffects.endTurn(playerId,()=>{matchController.endTurn(playerId);update()});return}
    cardEffects.endTurn(playerId,()=>{turn++;setUsed=false;setPhase(0);
    const wanted=NijiRules.startDraw(hand.children.length),drawn=draw(wanted);
    cardEffects.startTurn(playerId);
    setPhase(1);
    tell(`스타트 완료 → 메인 페이즈: 유닛을 액티브로 전환하고 ${drawn}장을 뽑았습니다. 손패 ${hand.children.length}장.${drawn<wanted?' 덱이 부족해 필요한 카드를 모두 뽑지 못했습니다.':''}`);update()});
  }else{
    const previous=phase,next=NijiRules.nextPhase(phase,turn,role);setPhase(next);
    tell(`${labels[previous]} ${skipped?'스킵':'완료'} → ${labels[next]}${next===3&&previous===1?' · 선공 첫 턴 액션 생략':''}`);
  }
  update();
}
document.querySelector('#next').onclick=()=>advancePhase();
const skip=document.querySelector('#skip');if(skip)skip.onclick=()=>advancePhase(true);

for(const zone of [...document.querySelectorAll('[data-zone]'),hand]){zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag-over')});zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));zone.addEventListener('drop',e=>{
  e.preventDefault();zone.classList.remove('drag-over');const img=document.getElementById(e.dataTransfer.getData('text/plain'));if(!img||!img.dataset.cardId||img.dataset.owner!==playerId||zone.dataset.zone==='channel')return;
  const target=zone.dataset.zone==='field'?zone.querySelector('.field-cards'):zone;if(img.parentElement===target)return;
  if(payment||actionGame.blocked())return;
  actionGame.cancel();
  if(zone.dataset.zone==='field'||zone.dataset.zone==='stage'){requestPlay(img,zone.dataset.zone);return}
  if(zone.dataset.zone==='set'){
    if(!NijiRules.canSet(phase,setUsed,img.parentElement===hand)){tell('일반 세트는 세트 페이즈에 손패에서 턴당 1장까지 가능합니다.');return}
    const previous=zone.querySelector('img');if(previous){previous.classList.remove('set-hidden','rested');document.querySelector('[data-zone="log"]').append(previous)}setUsed=true;
  }
  setupOpen=false;img.classList.toggle('placed',zone!==hand);img.classList.toggle('set-hidden',zone.dataset.zone==='set');if(zone.dataset.zone!=='field')img.classList.remove('rested');target.append(img);tell(zone.dataset.zone==='set'?'1장을 뒷면으로 세트했습니다. 기존 세트는 로그로 이동합니다.':'수동 이동. 카드를 수동 이동했습니다. 카드 효과는 직접 처리하세요.');update();
})}
function reset(){ids=GameDeck.createDeck(deckKey);const channel=document.querySelector('.channel img');channel.dataset.cardId=String(GameDeck.decks[deckKey].channel);channel.dataset.owner=playerId;channel.src=GameDeck.imagePath(+channel.dataset.cardId);channel.alt=CardInfo[channel.dataset.cardId].name+' 채널 카드';document.querySelector('#trashDialog')?.close();cardEffects.reset(playerId);actionGame.cancel(true);cancelPayment();for(const card of shuffle([...colorCards])){setColorFace(card,false);document.querySelector('#colors').append(card)}document.querySelectorAll('.placed,#hand img').forEach(e=>e.remove());role=document.querySelector('#role').value;turn=1;setUsed=false;mulliganUsed=false;setupOpen=true;deck=shuffle([...ids]);draw(NijiRules.initialHand(role));setPhase(1);tell(`${ids.length}장 연습 덱으로 준비했습니다. 초기 손패 ${NijiRules.initialHand(role)}장 · 첫 턴 스타트 생략${role==='first'?' · 액션 생략':''}. 덱: ${GameDeck.decks[deckKey].name}.`,false);update()}
function mulligan(){if(payment||actionGame.blocked()||!setupOpen||mulliganUsed)return false;const count=hand.children.length;deck.push(...[...hand.children].map(img=>+img.dataset.cardId));hand.replaceChildren();shuffle(deck);draw(count);mulliganUsed=true;tell('손패 전체를 덱에 섞고 같은 수만큼 다시 뽑았습니다. 다시 뽑기는 1회입니다.');update();return true}
document.querySelector('#mulligan').onclick=()=>{if(matchController?.managed())return;return mulligan()};
document.querySelector('.channel img').ondblclick=e=>view(e.target.src);document.querySelector('#closeViewer').onclick=()=>document.querySelector('#viewer').close();document.querySelector('#viewer').onclick=e=>{if(e.target.id==='viewer')e.target.close()};document.querySelector('#reset').onclick=reset;document.querySelector('#role').onchange=reset;
const toggleHand=document.querySelector('#toggleHand');
if(toggleHand)toggleHand.onclick=()=>{const hidden=hand.classList.toggle('concealed');toggleHand.textContent=hidden?'상대 손패 보기':'상대 손패 가리기';toggleHand.setAttribute('aria-pressed',String(!hidden))};
const boardApi={mulligan,field:document.querySelector('.field-cards'),log:document.querySelector('[data-zone="log"]'),stage:document.querySelector('[data-zone="stage"]'),channel:document.querySelector('.channel img'),hand,niji:document.querySelector('#niji'),colors:colorCards,colorLine:document.querySelector('#colors'),phase:()=>phase,turn:()=>turn,blocked:()=>!!payment,tell,update,setColorFace,colorName:code=>colorNames['ROYGBIV'.indexOf(code)],commit:()=>{setupOpen=false},
  getPayment:()=>payment?{card:payment.card,level:payment.level,selected:[...payment.selected]}:null,
  canSet:()=>NijiRules.canSet(phase,setUsed,true),
  set:document.querySelector('[data-zone="set"]'),role:()=>role,setRole:value=>{document.querySelector('#role').value=value},deckCount:()=>deck.length,advance:()=>advancePhase(),reset,deckKey:()=>deckKey,setDeck:key=>{if(!GameDeck.getDeck(key))return false;deckKey=key;return true},
  suspend:()=>{cancelPayment();document.querySelector('#viewer').close();trashDialog?.close()},
  startTurn:()=>{turn++;setUsed=false;draw(NijiRules.startDraw(hand.children.length));cardEffects.startTurn(playerId);setPhase(1);update()},
  play:(card,costs)=>{if(payment||actionGame.blocked())return false;requestPlay(card,CardInfo[card.dataset.cardId]?.type==='스테이지'?'stage':'field');if(payment){if(costs.length!==payment.level||new Set(costs).size!==costs.length||costs.some(c=>!c||!isCostCard(c,card))){cancelPayment();return false}payment.selected=new Set(costs);finishPayment()}return card.parentElement!==hand&&card.parentElement!==boardApi.set},
  setCard:card=>{if(!NijiRules.canSet(phase,setUsed,card?.parentElement===hand))return false;const old=boardApi.set.querySelector('img');if(old)cardEffects.toLog(playerId,old);card.classList.add('placed','set-hidden');card.classList.remove('rested');boardApi.set.append(card);setUsed=true;setupOpen=false;update();return true},
  takeTop:count=>{const cards=[];while(cards.length<count&&deck.length)cards.push(makeCard(deck.shift()));if(cards.length&&deck.length===0)matchController?.noteDeckEmpty(playerId);update();return cards},
  putBottom:cards=>{for(const card of cards){deck.push(+card.dataset.cardId);card.remove()}update()}
};
actionGame.register(playerId,boardApi);cardEffects.register(playerId,boardApi);
GameBoards.set(playerId,boardApi);
for(const [id,getSource] of [['activateChannel',()=>boardApi.channel],['activateStage',()=>boardApi.stage.querySelector('img')]]){
  const button=document.querySelector('#'+id);if(button)button.onclick=e=>{e?.stopPropagation();if(actionGame.blocked()||payment)return;actionGame.cancel();cardEffects.activateMain(playerId,getSource())};
}
reset();
}
// Each board gets its own state and locally scoped controls.
const playerBoards=[...document.querySelectorAll('[data-player]')];
if(playerBoards.length){
  for(const board of playerBoards){
    const localSelector=selector=>selector.replace(/#([\w-]+)/g,'[data-ui="$1"]');
    initializeBoard({
      body:document.body,
      querySelector:selector=>board.querySelector(localSelector(selector)),
      querySelectorAll:selector=>board.querySelectorAll(localSelector(selector)),
      createElement:tag=>document.createElement(tag),
      getElementById:id=>document.getElementById(id)
    },board.dataset.player);
  }
}else initializeBoard(document);

