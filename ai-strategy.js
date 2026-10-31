// The strategy receives an observation only. Hidden color identities and enemy hands
// are deliberately absent; revealed cards are the only color-specific targets.
(function(root){
  function createStrategy(overrides={}){
  // Only public own cards identify the starter. Tuning never sees hidden cards.
  const tuning={callBoost:0,battleScale:1,coverage:0,logValue:0,reviveValue:0,stageValue:0,fieldCost:0,debuffCare:0,spValue:0,...overrides};
  const kuzuha=s=>[...(s.hand||[]),...(s.units||[]),...(s.log||[]),...(s.stage?[s.stage]:[])].some(c=>c.id>=2&&c.id<=16);
  const COLORS=[...'ROYGBIV'];
  const need=s=>COLORS.filter(c=>!s.captured.includes(c));
  const active=c=>!c.rested;
  function value(c,s){
    const ownTuning=kuzuha(s);
    const useful=c.colors.filter(x=>need(s).includes(x)).length;
    if(c.type==='라이버')return 2.8+Math.max(0,c.power)/2300+useful*.8+([2,102,203,302].includes(c.id)?1.8:0)+([7,111,211,308].includes(c.id)?1.2:0)+(c.id===9?.8:0)+(c.id===104?1.4:0)+([305,309,313].includes(c.id)?1:0)+(c.id===311?.8:0)+(ownTuning?((c.id===7?tuning.spValue:0)+(c.id===11&&s.log.some(x=>x.id===10)?tuning.reviveValue:0)+(c.id===13&&s.log.length>=17?tuning.logValue:0)):0);
    if(c.id===314)return s.colors.some(c=>!c.faceUp)?1.5:s.log.some(c=>c.type==='라이버'&&c.level<=1&&c.tags?.includes('エンカウンター'))?4:0;
    if(c.id===315)return s.enemyUnits.some(c=>c.level<=5)?6:0;
    if(c.id===316)return s.log.some(c=>c.type==='라이버'&&c.level<=3&&c.tags?.includes('エンカウンター'))?3:1;
    if(c.id===214)return s.enemyUnits.some(x=>x.level<=5)?7:0;
    if(c.id===215)return Math.max(0,s.enemyUnits.reduce((n,x)=>n+Math.max(0,x.power)/2300+2,0)-s.units.reduce((n,x)=>n+Math.max(0,x.power)/2300+2,0));
    if(c.id===14)return s.enemyUnits.length?4:0;
    if(c.id===15)return s.log.some(x=>[6,7,8].includes(x.id))?5:1;
    if(c.id===114)return s.units.length?4:0;
    if(c.id===115)return s.enemyUnits.some(c=>c.rested&&c.level<=6)?7:0;
    return [16,116,216].includes(c.id)&&s.deckCount>8?2.5+(c.id===16?tuning.stageValue:0):0;
  }
  function cardPriority(c,s){
    const unique=c.colors.filter(color=>need(s).includes(color)&&!s.units.some(u=>u.colors.includes(color))).length;
    return value(c,s)+unique*2-c.level*.5;
  }
  function call(s,unit){
    if(unit.canCall===false)return {target:undefined,probability:0};
    const known=s.colors.filter(c=>c.faceUp&&unit.colors.includes(c.color));
    if(known.length)return {target:known[0].token,probability:1};
    const hidden=s.colors.filter(c=>!c.faceUp),seen=s.colors.filter(c=>c.faceUp).map(c=>c.color);
    const possible=need(s).filter(c=>!seen.includes(c));
    const probability=possible.length?unit.colors.filter(c=>possible.includes(c)).length/possible.length:0;
    return {target:hidden[0]?.token,probability};
  }
  function score(s){
    let result=(s.information||0)+s.units.reduce((n,c)=>n+value(c,s),0);
    // A field covering every remaining color is worth more than duplicates.
    for(const color of need(s))if(s.units.some(c=>c.colors.includes(color)))result+=2+s.captured.length*2+(kuzuha(s)?tuning.coverage:0);
    result+=s.hand.reduce((n,c)=>n+.42+Math.min(value(c,s),9)*.09,0);
    result+=s.stage?2:0;result-=s.enemyUnits.reduce((n,c)=>n+value(c,s)*.75,0);
    if(kuzuha(s))result+=Math.min(20,s.log.length)*tuning.logValue*.12+s.units.length*tuning.fieldCost;
    return result;
  }
  function combinations(cards,n,limit=32){
    const result=[];
    function go(start,chosen){if(result.length>=limit)return;if(chosen.length===n){result.push(chosen);return}for(let i=start;i<=cards.length-(n-chosen.length);i++)go(i+1,[...chosen,cards[i]])}
    go(0,[]);return result;
  }
  function simulate(s,card,costs){
    const next={...s,set:s.set===card?null:s.set,hand:s.hand.filter(c=>c!==card&&!costs.includes(c)),units:s.units.filter(c=>!costs.includes(c)),enemyUnits:[...s.enemyUnits],log:[...s.log,...costs]};
    if(card.type==='라이버'){
      let unit={...card,rested:false};
      if(card.id===5)unit.power=8500; // Expected reveal power; never inspect deck order.
      next.units.push(unit);
      if(next.units.length>5){const replace=[...next.units].filter(c=>c!==unit).sort((a,b)=>value(a,s)-value(b,s))[0];next.units=next.units.filter(c=>c!==replace);next.log.push(replace)}
      const allies=next.units.filter(c=>c!==unit);
      if([4,108,204,307].includes(card.id)&&allies.length){const target=[...allies].sort((a,b)=>value(b,s)-value(a,s))[0];next.units=next.units.map(c=>c===target?{...c,power:c.power+(c.power>=7000?5000:3000)}:c)}
      if(card.id===205){const extra=next.log.filter(c=>c.name===card.name&&c.type==='라이버'&&c.level<=1).sort((a,b)=>value(b,s)-value(a,s))[0];if(extra&&next.units.length<5){next.log=next.log.filter(c=>c!==extra);next.units.push({...extra,rested:s.ownCaptured.length<5})}}
      if(card.id===104){const limit=s.ownCaptured.length>=5?2:1,extra=next.hand.filter(c=>c.type==='라이버'&&c.tags?.includes('JK')&&c.level<=limit).sort((a,b)=>value(b,s)-value(a,s))[0];if(extra&&next.units.length<5){next.hand=next.hand.filter(c=>c!==extra);next.units.push({...extra,rested:false})}}
      if(card.id===13&&next.log.length>=20&&next.enemyUnits.length){const t=[...next.enemyUnits].sort((a,b)=>value(b,s)-value(a,s))[0];next.enemyUnits=next.enemyUnits.map(c=>c===t?{...c,power:c.power-4000}:c)}
    }else if(card.type==='스테이지')next.stage=card;
    else if(card.id===314){if(s.colors.some(c=>!c.faceUp))next.information=(s.information||0)+1.6;if(s.colors.filter(c=>!c.faceUp).length<=1){const revived=next.log.filter(c=>c.type==='라이버'&&c.level<=1&&c.tags?.includes('エンカウンター')).sort((a,b)=>value(b,s)-value(a,s))[0];if(revived){if(next.units.length>=5){const old=[...next.units].sort((a,b)=>value(a,s)-value(b,s))[0];next.units=next.units.filter(c=>c!==old);next.log.push(old)}next.units.push({...revived,rested:true});next.log=next.log.filter(c=>c!==revived)}}}
    else if(card.id===315){const target=next.enemyUnits.filter(c=>c.level<=5).sort((a,b)=>value(b,s)-value(a,s))[0];next.enemyUnits=next.enemyUnits.filter(c=>c!==target)}
    else if(card.id===214){const target=next.enemyUnits.filter(c=>c.level<=5).sort((a,b)=>value(b,s)-value(a,s))[0];next.enemyUnits=next.enemyUnits.filter(c=>c!==target)}
    else if(card.id===215){next.log.push(...next.units);next.units=[];next.enemyUnits=[]}
    else if(card.id===114){const target=[...next.units].sort((a,b)=>value(b,s)-value(a,s))[0];next.units=next.units.map(c=>c===target?{...c,power:c.power+5000}:c)}
    else if(card.id===115){const target=next.enemyUnits.filter(c=>c.rested&&c.level<=6).sort((a,b)=>value(b,s)-value(a,s))[0];next.enemyUnits=next.enemyUnits.filter(c=>c!==target)}
    else{
      const targets=[...next.enemyUnits].sort((a,b)=>value(b,s)-value(a,s));
      if(card.id===14&&tuning.debuffCare)targets.sort((a,b)=>(b.rested?100:0)+value(b,s)-((a.rested?100:0)+value(a,s)));
      if(targets[0])next.enemyUnits=next.enemyUnits.map(c=>c!==targets[0]?c:{...c,power:c.power-(card.id===14?10000:3000)});
      if(card.id===14&&tuning.debuffCare&&(!targets[0]?.rested||!next.units.some(c=>!c.rested&&c.power>=targets[0].power-10000)))next.information=(next.information||0)-tuning.debuffCare;
      if(card.id===15){const revived=next.log.filter(c=>[6,7,8].includes(c.id)).sort((a,b)=>value(b,s)-value(a,s))[0];if(revived){const fresh={...revived,rested:false};if(next.units.length>=5){const replace=[...next.units].sort((a,b)=>value(a,s)-value(b,s))[0];next.units=next.units.filter(c=>c!==replace);next.log.push(replace)}next.units.push(fresh);next.log=next.log.filter(c=>c!==revived)}}
    }
    return next;
  }
  function plays(s,requestedToken){
    const result=[];
    for(const card of [...s.hand,...(s.set?[s.set]:[])]){
      if(requestedToken!==undefined&&card.token!==requestedToken)continue;
      if(card.id===315&&!s.enemyUnits.some(c=>c.level<=5)||card.id===214&&!s.enemyUnits.some(c=>c.level<=5)||card.type==='스테이지'&&s.stage||card.id===114&&!s.units.length||card.id===115&&!s.enemyUnits.some(c=>c.rested&&c.level<=6)||card.type==='이벤트'&&![114,115,314,315].includes(card.id)&&!s.enemyUnits.length&&!(card.id===15&&s.log.some(c=>[6,7,8].includes(c.id))))continue;
      const resources=[...s.hand,...s.units.filter(c=>c.type==='라이버')].filter(c=>c!==card).sort((a,b)=>{
        const sacrifice=c=>cardPriority(c,s)+(s.units.includes(c)?3:0);
        return sacrifice(a)-sacrifice(b);
      });
      if(resources.length<card.level)continue;
      for(const costs of combinations(resources,card.level)){
        const next=simulate(s,card,costs);result.push({card:card.token,costs:costs.map(c=>c.token),next,gain:score(next)-score(s)});
      }
    }
    return result.sort((a,b)=>b.gain-a.gain).slice(0,10);
  }
  function main(s){
    const options=plays(s);let best=null;
    for(const move of options){const follow=plays(move.next)[0];const total=move.gain+Math.max(0,follow?.gain||0)*.85;if(!best||total>best.score)best={...move,score:total}}
    return best&&best.score>.1?{card:best.card,costs:best.costs}:null;
  }
  function action(s){
    let best={kind:'pass',score:.05};const k=kuzuha(s),urgency=8+s.captured.length*1.6+(k?tuning.callBoost:0);
    const blockers=s.enemyUnits.filter(c=>[2,102,203,302].includes(c.id)&&active(c));
    for(const unit of s.units.filter(active)){
      const reserve=[2,102,203,302].includes(unit.id)&&s.units.filter(c=>[2,102,203,302].includes(c.id)&&active(c)).length===1&&s.enemyUnits.some(active)?2:0;
      const intercept=blockers.length?Math.min(...blockers.map(b=>unit.power>=b.power?1.1:-value(unit,s))):null;
      const color=call(s,unit);
      if(color.target&&color.probability){const gain=intercept??color.probability*urgency-reserve-.6;if(gain>best.score)best={kind:'call',unit:unit.token,target:color.target,score:gain}}
      for(const target of s.enemyUnits.filter(c=>c.rested&&c.power<=unit.power)){
        let gain=2+value(target,s)*.7+([7,111,211,308].includes(unit.id)?call(s,unit).probability*urgency:0)+(unit.id===209&&unit.enteredTurn===s.turn?urgency:0)+(unit.id===9&&unit.enteredTurn===s.turn&&s.hand.length?2:0)-reserve;
        if(k)gain*=tuning.battleScale;
        if(blockers.length)gain=intercept;
        if(gain>best.score)best={kind:'battle',unit:unit.token,target:target.token,score:gain};
      }
    }
    return best;
  }
  function reaction(s,d){
    let best=null,bestScore=0;
    for(const option of d.options){
      const c=option.card;
      const danger=d.action==='color'?d.probability*(9+s.ownCaptured.length*2):d.target&&d.unit.power>=d.target.power?value(d.target,s):0;
      const trade=option.kind==='block'?(c.power>d.unit.power?value(d.unit,s):-value(c,s)): -value(c,s);
      const protection=option.kind==='protect'&&d.target?value(d.target,s):0;
      const gain=danger+trade+protection-.5;
      if(gain>bestScore){bestScore=gain;best=option.token}
    }
    return best;
  }
  function effect(s,d){
    if(d.kind==='endChannel')return s.units.some(c=>c.rested&&c.level<=1)&&!(s.ownCaptured.length>=6&&!s.units.some(c=>c.id===302&&c.rested))?d.cards.slice(0,1).map(c=>c.token):[];
    if(d.kind==='reveal')return d.cards.slice(0,1).map(c=>c.token);
    const ranked=[...d.cards].sort((a,b)=>cardPriority(b,s)-cardPriority(a,s));
    if(d.kind==='discard')return ranked.slice(-1).map(c=>c.token);
    if(d.kind==='replace')return ranked.slice(-d.max).map(c=>c.token);
    if(d.kind==='enemy')return [...d.cards].sort((a,b)=>value(b,s)+(tuning.debuffCare&&d.title?.startsWith('게임 시작')&&b.rested?100:0)-value(a,s)-(tuning.debuffCare&&d.title?.startsWith('게임 시작')&&a.rested?100:0)).slice(0,1).map(c=>c.token);
    if(d.kind==='buff')return [...d.cards].sort((a,b)=>(b.rested?0:3)+(b.power>=7000?2:0)+value(b,s)-((a.rested?0:3)+(a.power>=7000?2:0)+value(a,s))).slice(0,1).map(c=>c.token);
    if(d.kind==='returnLog'&&s.log.length-d.max<20&&s.deckCount>8)return [];
    return ranked.slice(0,d.max).map(c=>c.token);
  }
  function set(s){
    if(!s.hand.length)return null;
    if(!s.set)return [...s.hand].sort((a,b)=>cardPriority(b,s)-cardPriority(a,s))[0].token;
    // Replacing a set card is legal once per turn. Free a hand slot when
    // every field color is already collected and neither side offers a battle.
    if(tuning.cycle&&kuzuha(s)&&s.hand.length>=5&&s.units.length&&s.units.every(c=>call(s,c).probability===0)&&!s.enemyUnits.some(e=>e.rested&&s.units.some(c=>c.power>=e.power)))return [...s.hand].sort((a,b)=>cardPriority(a,s)-cardPriority(b,s))[0].token;
    return null;
  }
  const api={main,action,call,reaction,effect,cardPriority,set,payment:(s,token)=>plays(s,token)[0]?.costs||null};
  return api;
  }
  const api=createStrategy({"callBoost":-1,"battleScale":1.5,"coverage":1,"logValue":0.5,"reviveValue":-1,"stageValue":1,"fieldCost":-1,"debuffCare":4,"spValue":-1,"cycle":true});api.create=createStrategy;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NijiAI=api;
})(globalThis);
