// The room host runs the same card/phase/effect engine. Peers send commands,
// never board state. Snapshots omit the other seat's hidden card identities.
function createOnlineEngine({playerDeck='mito',opponentDeck='kuzuha',first='player',dice=null,random}={}){
  if(!GameDeck.getDeck(playerDeck)||!GameDeck.getDeck(opponentDeck)||!['player','opponent'].includes(first))throw Error('잘못된 대전 설정입니다.');
  const rng=random||(()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296});
  class Node{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.className='';this.style={setProperty(){}};this.classList={contains:c=>this.className.split(' ').includes(c),add:(...cs)=>{for(const c of cs)if(!this.classList.contains(c))this.className+=' '+c},remove:(...cs)=>{this.className=this.className.split(' ').filter(c=>!cs.includes(c)).join(' ')},toggle:(c,on)=>{if(on===undefined)on=!this.classList.contains(c);on?this.classList.add(c):this.classList.remove(c);return on}}}
    append(...xs){for(const x of xs){x.remove();this.children.push(x);x.parentElement=this}}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null}
    replaceChildren(...xs){for(const x of [...this.children])x.remove();this.append(...xs)}
    setAttribute(k,v){this.attrs[k]=v}addEventListener(){}showModal(){this.open=true}close(){this.open=false}
    querySelector(s){const walk=n=>n.children.flatMap(x=>[x,...walk(x)]);return walk(this).find(x=>s.startsWith('.')?x.classList.contains(s.slice(1)):x.tagName===s.toUpperCase())||null}
  }
  const document={body:new Node(),createElement:t=>new Node(t),addEventListener(){}},effects=createCardEffects(document,CardInfo),actions=createActionGame(document,CardInfo,effects),boards=new Map(),refs=new Map();let serial=0,revision=0,match,resetting=true;
  const other=o=>o==='player'?'opponent':'player',ref=x=>{if(!x.id){x.id='n'+(++serial);refs.set(x.id,x)}return x.id};
  const card=(owner,id)=>{const x=new Node('img');x.dataset={owner,cardId:String(id)};x.src=GameDeck.imagePath(id);ref(x);return x};
  const shuffle=xs=>{for(let i=xs.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]]}return xs};
  effects.setSpecialCallHandler((o,c,done,actor)=>actions.specialColorCall(o,c,done,actor));
  for(const [owner,key] of [['player',playerDeck],['opponent',opponentDeck]]){
    let turn=1,phase=1,role=owner===first?'first':'second',setUsed=false;
    const b={field:new Node(),log:new Node(),stage:new Node(),set:new Node(),hand:new Node(),niji:new Node(),colorLine:new Node(),channel:card(owner,GameDeck.getDeck(key).channel),colors:[],deck:[],messages:[],key};
    b.phase=()=>phase;b.turn=()=>turn;b.role=()=>role;b.setRole=x=>role=x;b.blocked=()=>false;b.update=()=>{};b.tell=t=>{b.messages=[String(t).slice(0,500)]};b.commit=()=>{};b.colorName=c=>c;b.deckCount=()=>b.deck.length;
    b.setColorFace=(x,up)=>{x.dataset.faceUp=String(up);x.querySelector('img').src=up?'front-'+x.dataset.color:'back'};
    b.takeTop=n=>{const xs=b.deck.splice(0,n);if(xs.length&&!b.deck.length&&!resetting)match.noteDeckEmpty(owner);return xs};b.putBottom=xs=>{for(const x of xs){x.remove();b.deck.push(x)}};
    b.reset=()=>{turn=1;phase=1;setUsed=false;for(const z of ['hand','field','log','stage','set','niji','colorLine'])b[z].replaceChildren();b.messages=[];b.colors=[];for(const code of 'ROYGBIV'){b.niji.append(new Node());const x=new Node();x.className='color-card';x.dataset={color:code,faceUp:'false'};x.append(new Node('img'));b.colors.push(x)}for(const x of shuffle([...b.colors])){ref(x);b.setColorFace(x,false);b.colorLine.append(x)}b.deck=shuffle(GameDeck.createDeck(key)).map(id=>card(owner,id));b.hand.append(...b.takeTop(NijiRules.initialHand(role)))};
    b.startTurn=()=>{turn++;setUsed=false;b.hand.append(...b.takeTop(NijiRules.startDraw(b.hand.children.length)));effects.startTurn(owner);phase=1};
    b.advance=()=>{if(phase===4)effects.endTurn(owner,()=>match.endTurn(owner));else phase=NijiRules.nextPhase(phase,turn,role)};
    b.play=(x,costs)=>{if(phase!==1||!(x.parentElement===b.hand||x.parentElement===b.set))return false;const m=CardInfo[x.dataset.cardId];if(!m||m.type==='채널'||costs.length!==m.level||new Set(costs).size!==costs.length||costs.some(c=>!c||c===x||!(c.parentElement===b.hand||c.parentElement===b.field&&CardInfo[c.dataset.cardId]?.type==='라이버')))return false;if(m.type==='스테이지'&&b.stage.children.length)return false;for(const c of costs)effects.toLog(owner,c);x.classList.add('placed');x.classList.remove('rested','set-hidden');x.dataset.enteredTurn=String(turn);b[m.type==='라이버'?'field':m.type==='스테이지'?'stage':'log'].append(x);effects.played(owner,x);return true};
    b.setCard=x=>{if(!NijiRules.canSet(phase,setUsed,x?.parentElement===b.hand))return false;const old=b.set.querySelector('img');if(old)effects.toLog(owner,old);x.classList.add('placed','set-hidden');x.classList.remove('rested');b.set.append(x);setUsed=true;return true};
    boards.set(owner,b);effects.register(owner,b);actions.register(owner,b);
  }
  match=createAIMatch({boards,effects,actions,strategy:{},info:CardInfo});match.reset(false,first);resetting=false;
  const drain=()=>{if(!effects.blocked()&&!actions.blocked())match.step()};
  function command(owner,input){
    if(!boards.has(owner)||!input||input.revision!==revision||match.state().winner)throw Error('상태가 변경되었습니다. 다시 선택해 주세요.');
    const b=boards.get(owner),fx=effects.getChoice(),d=actions.getDecision();let ok=false;
    if(fx){if(fx.owner!==owner||input.type!=='effect'||!Array.isArray(input.cards)||input.cards.length>50)throw Error('효과 선택을 기다리고 있습니다.');ok=fx.resolve(input.cards.map(x=>refs.get(x)));}
    else if(d){if(d.owner!==owner)throw Error('상대의 선택을 기다리고 있습니다.');if(d.kind==='reaction'&&input.type==='react'&&(input.option===null||Number.isInteger(input.option)&&input.option>=0&&input.option<d.options.length)){d.resolve(input.option===null?null:d.options[input.option]);ok=true}else if(d.kind==='color'&&input.type==='color'){const x=refs.get(input.target);if(d.targets.includes(x)){d.resolve(x);ok=true}}}
    else{
      if(effects.blocked()||owner!==match.state().active)throw Error('내 차례를 기다려 주세요.');
      if(input.type==='advance'){b.advance();ok=true}
      if(input.type==='play'&&Array.isArray(input.costs)&&input.costs.length<=10){const x=refs.get(input.card);if(x)ok=b.play(x,input.costs.map(x=>refs.get(x)))}
      if(input.type==='set')ok=b.setCard(refs.get(input.card));
      if(input.type==='activate'&&['channel','stage'].includes(input.source)){const x=input.source==='channel'?b.channel:b.stage.querySelector('img');if(x&&effects.canActivateMain(owner,x)){effects.activateMain(owner,x);ok=true}}
      if(input.type==='act'&&b.phase()===2){const x=refs.get(input.unit),target=refs.get(input.target);if(x?.parentElement===b.field&&!x.classList.contains('rested')){if(input.action==='call'&&CardInfo[x.dataset.cardId].colors.length&&effects.canColorCall(x)){actions.selectUnit(owner,x);actions.beginColorCall();ok=true}else if(input.action==='battle'&&target?.parentElement===boards.get(other(owner)).field&&target.classList.contains('rested')){actions.selectUnit(owner,x);actions.selectUnit(other(owner),target);ok=true}}}
    }
    if(!ok)throw Error('지금은 이 행동을 할 수 없습니다.');revision++;drain();return revision;
  }
  const visibleCard=(x,shown)=>({ref:ref(x),...(shown?{id:+x.dataset.cardId,power:effects.power(x)}:{}),rested:x.classList.contains('rested')});
  function snapshot(viewer){
    if(!boards.has(viewer))throw Error('관전자는 지원하지 않습니다.');
    const result={revision,viewer,first,dice,state:match.state(),boards:{},choice:null};
    for(const [owner,b] of boards){const own=owner===viewer;result.boards[owner]={key:b.key,turn:b.turn(),phase:b.phase(),role:b.role(),deckCount:b.deckCount(),channel:{...visibleCard(b.channel,true),under:effects.underCards(b.channel).length},hand:[...b.hand.children].map(x=>visibleCard(x,own)),field:[...b.field.children].map(x=>visibleCard(x,true)),set:[...b.set.children].map(x=>visibleCard(x,own)),stage:[...b.stage.children].map(x=>({...visibleCard(x,true),under:effects.underCards(x).length})),log:[...b.log.children].map(x=>visibleCard(x,true)),colors:[...b.colorLine.children].map(x=>({ref:ref(x),faceUp:x.dataset.faceUp==='true',...(x.dataset.faceUp==='true'?{color:x.dataset.color}:{})})),niji:b.colors.filter(x=>x.parentElement!==b.colorLine).map(x=>x.dataset.color),notice:own?b.messages.at(-1)||'':''}}
    const fx=effects.getChoice(),d=actions.getDecision();if(fx){result.waiting=fx.owner;if(fx.owner===viewer)result.choice={kind:'effect',title:fx.title||document.body.children.find(x=>x.id==='effect-dialog')?.querySelector('h2')?.textContent||'카드 효과 선택',min:fx.min,max:fx.max,ordered:fx.ordered,optional:fx.optional,cards:fx.cards.map(x=>CardInfo[x.dataset.cardId]?visibleCard(x,true):{ref:ref(x),faceUp:x.dataset.faceUp==='true',...(x.dataset.faceUp==='true'?{color:x.dataset.color}:{})})}}
    else if(d){result.waiting=d.owner;result.attack={actor:d.actor||d.owner,unit:visibleCard(d.unit,true),action:d.action||d.kind,target:d.target?visibleCard(d.target,true):null};if(d.owner===viewer)result.choice=d.kind==='reaction'?{kind:'reaction',title:'수비 측 반응',options:d.options.map((o,i)=>({index:i,label:o.label,card:visibleCard(o.card,true)}))}:{kind:'color',title:d.special?'SP 콜 · 상대 컬러 선택':'상대 컬러 선택',cards:d.targets.map(x=>({ref:ref(x),faceUp:x.dataset.faceUp==='true',...(x.dataset.faceUp==='true'?{color:x.dataset.color}:{})}))}}
    return result;
  }
  return {command,snapshot};
}
