// Local phase rules. Start draw is a user-requested top-up to five (2026-10-29).
(function(root){
  const rules=Object.freeze({
    initialHand:role=>role==='second'?7:5,
    startDraw:count=>Math.max(0,5-count),
    nextPhase:(phase,turn,role)=>phase===1&&turn===1&&role==='first'?3:phase+1,
    canSet:(phase,used,fromHand)=>phase===3&&!used&&fromHand
  });
  if(typeof module!=='undefined'&&module.exports)module.exports=rules;else root.NijiRules=rules;
})(globalThis);
