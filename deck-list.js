// 50-card starter configurations selected by seeded simulation. Original lists are
// preserved in output/starter-optimization/baseline.json and deck-list.original.js.
(function(root){
 const freeze=xs=>Object.freeze(xs.map(Object.freeze));
 const entries=freeze([{"id":2,"count":3},{"id":3,"count":4},{"id":4,"count":3},{"id":5,"count":0},{"id":6,"count":4},{"id":7,"count":4},{"id":8,"count":4},{"id":9,"count":2},{"id":10,"count":4},{"id":11,"count":4},{"id":12,"count":4},{"id":13,"count":4},{"id":14,"count":3},{"id":15,"count":4},{"id":16,"count":3}]);
 const mitoEntries=freeze([{"id":102,"count":4},{"id":103,"count":4},{"id":104,"count":4},{"id":105,"count":4},{"id":106,"count":4},{"id":107,"count":4},{"id":108,"count":2},{"id":109,"count":4},{"id":110,"count":3},{"id":111,"count":4},{"id":112,"count":2},{"id":113,"count":3},{"id":114,"count":4},{"id":115,"count":2},{"id":116,"count":2}]);
 const sasakiEntries=freeze([{"id":202,"count":4},{"id":203,"count":4},{"id":204,"count":3},{"id":205,"count":4},{"id":206,"count":4},{"id":207,"count":4},{"id":208,"count":3},{"id":209,"count":2},{"id":210,"count":4},{"id":211,"count":2},{"id":212,"count":4},{"id":213,"count":3},{"id":214,"count":4},{"id":215,"count":1},{"id":216,"count":4}]);
 const kagamiEntries=freeze([{"id":302,"count":4},{"id":303,"count":4},{"id":304,"count":2},{"id":305,"count":2},{"id":306,"count":4},{"id":307,"count":3},{"id":308,"count":4},{"id":309,"count":4},{"id":310,"count":4},{"id":311,"count":4},{"id":312,"count":3},{"id":313,"count":2},{"id":314,"count":4},{"id":315,"count":4},{"id":316,"count":2}]);
 const decks=Object.freeze({kagami:Object.freeze({key:'kagami',name:'카가미 하야토 덱',channel:301,entries:kagamiEntries}),kuzuha:Object.freeze({key:'kuzuha',name:'쿠즈하 스타터',channel:1,entries}),mito:Object.freeze({key:'mito',name:'츠키노 미토 덱',channel:101,entries:mitoEntries}),sasaki:Object.freeze({key:'sasaki',name:'사사키 사쿠 덱',channel:201,entries:sasakiEntries})});
 const series=id=>id>=300?'04':id>=200?'03':id>=100?'01':'02';
 const cardCode=id=>`NJ-SD${series(id)}-${String(id>=300?id-300:id>=200?id-200:id>=100?id-100:id).padStart(3,'0')}`;
 const imagePath=id=>`output/cards/NJ-SD${series(id)}/${cardCode(id)}.png`;
 const deck=Object.freeze({decks,cardCode,imagePath,getDeck:key=>decks[key]||null,entries,total:entries.reduce((n,e)=>n+e.count,0),optimization:Object.freeze({mainCount:50,maxCopies:4,simulationGames:144864}),createDeck:(key='kuzuha')=>(decks[key]||decks.kuzuha).entries.flatMap(e=>Array(e.count).fill(e.id))});
 if(typeof module!=='undefined'&&module.exports)module.exports=deck;else root.GameDeck=deck;
})(globalThis);
