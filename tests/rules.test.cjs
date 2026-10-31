const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../rules.js');
test('선후공 초기 손패가 다르다',()=>{
  assert.equal(rules.initialHand('first'),5);assert.equal(rules.initialHand('second'),7);
});
test('스타트 드로우는 5장 미만이면 보충, 정확히 5장이면 1장, 초과면 유지한다',()=>{
  for(const [hand,draw] of [[0,5],[1,4],[4,1],[5,1],[6,0],[7,0]])assert.equal(rules.startDraw(hand),draw);
});
test('선공 첫 턴만 액션을 건너뛴다',()=>{
  const sequence=(turn,role)=>{let phase=turn===1?1:0;const phases=[phase];while(phase<4){phase=rules.nextPhase(phase,turn,role);phases.push(phase)}return phases};
  assert.deepEqual(sequence(1,'first'),[1,3,4]);
  assert.deepEqual(sequence(1,'second'),[1,2,3,4]);
  assert.deepEqual(sequence(2,'first'),[0,1,2,3,4]);
  assert.deepEqual(sequence(2,'second'),[0,1,2,3,4]);
});
test('일반 세트는 세트 중 손패에서 1번만 허용한다',()=>{
  for(let phase=0;phase<5;phase++)for(const used of [false,true])for(const hand of [false,true])assert.equal(rules.canSet(phase,used,hand),phase===3&&!used&&hand);
});
