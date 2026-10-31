// Korean readings of the local NJ-SD02 card faces. Values are printed/base values.
// Small-print cross-check: https://gamerch.com/247/1020500 and https://gamerch.com/247/1022992
const CardInfo = Object.freeze({
  ...(typeof KagamiCardInfo!=='undefined'?KagamiCardInfo:{}),
  ...(typeof MitoCardInfo!=='undefined'?MitoCardInfo:{}),
  ...(typeof SasakiCardInfo!=='undefined'?SasakiCardInfo:{}),
  1: {name:'쿠즈하',type:'채널',level:null,power:null,colors:[],effect:'[기동 메인 · 턴 1회] 자신의 덱 위에서 1장을 로그에 놓습니다.\n[트리거 · 남색/보라] 자신의 덱 위에서 1장을 로그에 놓습니다. 그 후 자신의 로그가 20장 이상이면, 상대의 파워 4,000 이하 라이버 1장을 로그에 놓습니다.'},
  2: {name:'이브라힘',type:'라이버',level:1,power:3000,colors:['B'],effect:'[블로커] 상대가 공격하거나 컬러 콜을 했을 때, 이 카드를 가로로 하여 그 공격이나 컬러 콜을 중지하고 이 카드와 배틀하게 합니다.'},
  3: {name:'이브라힘',type:'라이버',level:1,power:5000,colors:['Y'],effect:'효과 없음'},
  4: {name:'이브라힘',type:'라이버',level:2,power:5000,colors:['Y','B'],effect:'[등장 시] 이 카드 이외의 자신의 라이버 1장을 선택합니다. 이 턴 동안 선택한 카드의 파워 +3,000. 원래 파워가 7,000 이상이면 대신 +5,000.'},
  5: {name:'이브라힘',type:'라이버',level:3,power:0,colors:['O','Y','B','I'],effect:'[등장 시] 자신의 덱 위에서 3장을 공개하고 원하는 순서로 덱 아래에 놓습니다. 이 턴 동안 이 카드의 파워에 공개한 라이버들의 파워 합계를 더합니다.'},
  6: {name:'엑스 알비오',type:'라이버',level:1,power:4000,colors:['G'],effect:'「엑스 알비오」 이외의 자신의 라이버가 공격받았을 때, 가로 상태인 이 카드를 로그에 놓아도 됩니다. 그렇게 하면 그 배틀을 중지합니다.'},
  7: {name:'엑스 알비오',type:'라이버',level:2,power:5000,colors:['O','G','I'],effect:'[배틀 승리 시] 이 카드로 SP 콜을 합니다. SP 콜은 블로커 등으로 중지되지 않습니다.'},
  8: {name:'엑스 알비오',type:'라이버',level:2,power:6000,colors:['Y','G','B'],effect:'효과 없음'},
  9: {name:'엑스 알비오',type:'라이버',level:3,power:8000,colors:['G','B','I'],effect:'[배틀 승리 시 · 턴 1회] 이 카드가 등장한 턴이라면, 자신의 손패 1장을 로그에 놓아도 됩니다. 그렇게 하면 이 카드를 세로로 합니다.'},
  10: {name:'쿠즈하',type:'라이버',level:0,power:3000,colors:[],effect:'효과 없음'},
  11: {name:'쿠즈하',type:'라이버',level:2,power:5000,colors:['Y','I'],effect:'[상대 턴 중] 이 카드가 배틀로 로그에 놓였을 때, 자신의 로그에서 레벨 0인 「쿠즈하」 라이버 1장을 등장시킵니다.'},
  12: {name:'쿠즈하',type:'라이버',level:3,power:8000,colors:['R','O','I','V'],effect:'효과 없음'},
  13: {name:'쿠즈하',type:'라이버',level:3,power:8000,colors:['R','O','V'],effect:'[등장 시] 자신의 로그가 20장 이상이면, 이 턴 동안 상대 라이버 1장의 파워 -4,000. 그 후 자신의 로그에서 레벨 2 이하 라이버를 2장까지 원하는 순서로 덱 아래에 놓아도 됩니다.'},
  14: {name:'게임 시작',type:'이벤트',level:2,power:null,colors:[],effect:'상대의 레벨 5 이하 라이버 1장을 선택하여 이 턴 동안 파워 -10,000.'},
  15: {name:'영웅의 일격',type:'이벤트',level:3,power:null,colors:[],effect:'이 턴 동안 상대 라이버 1장의 파워 -3,000. 그 후 자신의 로그에서 레벨 2 이하인 「엑스 알비오」 라이버 1장을 등장시켜도 됩니다.'},
  16: {name:'흡혈귀의 밤',type:'스테이지',level:2,power:null,colors:[],effect:'[기동 메인 · 턴 1회] 자신의 덱 위에서 1장을 이 카드 아래에 놓습니다. 그 후 이 카드 아래의 카드가 3장 이상이면, 이 카드와 그 카드들을 원하는 순서로 덱 아래에 놓고, 자신의 로그에서 레벨 4 이하인 「쿠즈하」 라이버 1장을 등장시킵니다.'}
});
