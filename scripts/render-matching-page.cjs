const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
fs.writeFileSync(path.join(root,'lobby.html'),source.replace('<title>7colors · 대전</title>','<title>7colors · 온라인 로비</title>').replace('<body data-screen="lobby">','<body data-route="matching" data-screen="lobby">'));
