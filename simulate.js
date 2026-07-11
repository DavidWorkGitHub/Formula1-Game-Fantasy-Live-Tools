const dgram = require('dgram');
const client = dgram.createSocket('udp4');
const fs = require('fs');
const path = require('path');
let savedPort = 20777;
try { savedPort = Number(JSON.parse(fs.readFileSync(path.join(__dirname, 'app-settings.json'), 'utf8')).udpPort || 20777); } catch {}
const PORT = Number(process.env.UDP_PORT || savedPort || 20777);
const FORMAT = Number(process.env.UDP_FORMAT || 2025);
const SESSION_UID = 456n;
const drivers = [
  ['PIASTRI',112,8,81], ['LECLERC',58,1,16], ['RUSSELL',50,0,63], ['VERSTAPPEN',9,2,1], ['NORRIS',54,8,4], ['HAMILTON',7,1,44],
  ['ANTONELLI',165,0,12], ['HADJAR',149,2,6], ['GASLY',59,5,10], ['LAWSON',113,6,30], ['ALONSO',3,4,14], ['ALBON',62,3,23],
  ['BORTOLETO',161,9,5], ['HULKENBERG',10,9,27], ['OCON',17,7,31], ['BEARMAN',147,7,87], ['COLAPINTO',162,5,43], ['STROLL',19,4,18],
  ['PEREZ',14,104,11], ['BOTTAS',15,104,77], ['SAINZ',0,3,55], ['LINDBLAD',255,6,41]
];
function header(packetId, size){
  const b=Buffer.alloc(size); b.writeUInt16LE(FORMAT,0); b.writeUInt8(FORMAT === 2025 ? 25 : 26,2); b.writeUInt8(1,3); b.writeUInt8(0,4); b.writeUInt8(1,5); b.writeUInt8(packetId,6); b.writeBigUInt64LE(SESSION_UID,7); b.writeFloatLE(Date.now()/1000,15); b.writeUInt32LE(Math.floor(Math.random()*999999),19); b.writeUInt32LE(Math.floor(Math.random()*999999),23); b.writeUInt8(0,27); b.writeUInt8(255,28); return b;
}
function sendSession(sessionType=15){
 const b=header(1,753); b.writeUInt8(5,32); b.writeUInt16LE(5300,33); b.writeUInt8(sessionType,35); b.writeInt8(4,36); client.send(b,PORT,'127.0.0.1');
}
function sendParticipants(){
 const size=1284,b=header(4,size); b.writeUInt8(22,29);
 for(let i=0;i<22;i++){ const [name,driverId,teamId,num]=drivers[i]; const o=30+i*57; b.writeUInt8(1,o); b.writeUInt8(driverId,o+1); b.writeUInt8(0,o+2); b.writeUInt8(teamId,o+3); b.writeUInt8(0,o+4); b.writeUInt8(num,o+5); b.writeUInt8(0,o+6); Buffer.from(name).copy(b,o+7,0,32); }
 client.send(b,PORT,'127.0.0.1');
}
function sendOvertake(idx, other){ const b=header(3,45); Buffer.from('OVTK').copy(b,29); b.writeUInt8(idx,33); b.writeUInt8(other,34); client.send(b,PORT,'127.0.0.1'); }
let tick=0;
const finishOrder=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const gridByIndex=[3,2,5,1,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
function sendLap(){
 const b=header(2,1285);
 for(let pos=1;pos<=22;pos++){ const i=finishOrder[pos-1]; const o=29+i*57; const lap=75000 + pos*140; b.writeUInt32LE(i===0?74321:lap, o); b.writeUInt32LE((tick*1000)%90000,o+4); b.writeUInt8(pos,o+32); b.writeUInt8(Math.floor(tick/3)+1,o+33); b.writeUInt8(0,o+38); b.writeUInt8(gridByIndex[i],o+43); b.writeUInt8(3,o+45); }
 client.send(b,PORT,'127.0.0.1'); tick++;
}
function sendFinal(){
 const b=header(8,1042); b.writeUInt8(22,29);
 for(let i=0;i<22;i++){ const pos=finishOrder.indexOf(i)+1; const o=30+i*46; b.writeUInt8(pos,o); b.writeUInt8(5,o+1); b.writeUInt8(gridByIndex[i],o+2); b.writeUInt8(0,o+3); b.writeUInt8(1,o+4); b.writeUInt8(3,o+5); b.writeUInt8(2,o+6); b.writeUInt32LE(i===0?74321:75000+pos*140,o+7); b.writeDoubleLE(4800+pos,o+11); b.writeUInt8(0,o+19); b.writeUInt8(0,o+20); }
 client.send(b,PORT,'127.0.0.1');
}
sendSession(15); sendParticipants(); setInterval(()=>{sendSession(15); sendLap(); if(tick===2){sendOvertake(0,3);sendOvertake(0,2);sendOvertake(2,3)} if(tick===7) sendFinal();},1000); console.log(`Sending fake F1 packets (format ${FORMAT}) to 127.0.0.1:${PORT}. Stop with Ctrl+C.`);
