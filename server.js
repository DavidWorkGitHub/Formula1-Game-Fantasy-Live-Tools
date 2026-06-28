const dgram = require('dgram');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const UDP_PORT = Number(process.env.UDP_PORT || 20777);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);
const HEADER_SIZE = 29;
const LAP_DATA_SIZE = 57;
const FINAL_CLASSIFICATION_SIZE = 46;
const PARTICIPANT_SIZE = 58;

const PACKET = {
  0: 'Motion', 1: 'Session', 2: 'Lap Data', 3: 'Event', 4: 'Participants',
  5: 'Car Setups', 6: 'Car Telemetry', 7: 'Car Status', 8: 'Final Classification',
  9: 'Lobby Info', 10: 'Car Damage', 11: 'Session History', 12: 'Tyre Sets',
  13: 'Motion Ex', 14: 'Time Trial', 15: 'Lap Positions'
};

const RACE_POINTS = {1:25,2:18,3:15,4:12,5:10,6:8,7:6,8:4,9:2,10:1};
const SPRINT_POINTS = {1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1};
const QUALI_POINTS = {1:10,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1};
const RACE_FASTEST_LAP_BONUS = 10;
const SPRINT_FASTEST_LAP_BONUS = 5;
const RACE_DNF_PENALTY = -20;
const SPRINT_DNF_PENALTY = -10;
const QUALI_BAD_PENALTY = -5;

const SESSION_TYPES = {
  0:'Unknown',1:'Practice 1',2:'Practice 2',3:'Practice 3',4:'Short Practice',5:'Qualifying 1',6:'Qualifying 2',7:'Qualifying 3',8:'Short Qualifying',9:'One-Shot Qualifying',
  10:'Sprint Shootout 1',11:'Sprint Shootout 2',12:'Sprint Shootout 3',13:'Short Sprint Shootout',14:'One-Shot Sprint Shootout',15:'Race',16:'Race 2',17:'Race 3',18:'Time Trial'
};
const RACE_QUALIFYING_SESSION_IDS = new Set([5,6,7,8,9]);
const SPRINT_QUALIFYING_SESSION_IDS = new Set([10,11,12,13,14]);
const QUALIFYING_SESSION_IDS = new Set([...RACE_QUALIFYING_SESSION_IDS, ...SPRINT_QUALIFYING_SESSION_IDS]);
const RACE_SESSION_IDS = new Set([15,16,17]);

const TEAM_CODES_BY_ID = {
  0:'MER',1:'FER',2:'RED',3:'WIL',4:'AST',5:'ALP',6:'VRB',7:'HAA',8:'MCL',9:'AUD',
  185:'MER',186:'FER',187:'RED',188:'WIL',189:'AST',190:'ALP',191:'VRB',192:'HAA',193:'MCL',194:'AUD'
};

const DRIVER_BY_ID = {
  0:'SAINZ',3:'ALONSO',7:'HAMILTON',9:'VERSTAPPEN',10:'HULKENBERG',14:'PEREZ',15:'BOTTAS',17:'OCON',19:'STROLL',
  50:'RUSSELL',54:'NORRIS',58:'LECLERC',59:'GASLY',62:'ALBON',94:'TSUNODA',112:'PIASTRI',113:'LAWSON',
  136:'DOOHAN',147:'BEARMAN',149:'HADJAR',161:'BORTOLETO',162:'COLAPINTO',165:'ANTONELLI',169:'MARTI'
};

const DRIVER_BY_RACE_NUMBER = {
  1:'VERSTAPPEN',4:'NORRIS',5:'BORTOLETO',6:'HADJAR',10:'GASLY',11:'PEREZ',12:'ANTONELLI',14:'ALONSO',16:'LECLERC',18:'STROLL',
  22:'TSUNODA',23:'ALBON',27:'HULKENBERG',30:'LAWSON',31:'OCON',43:'COLAPINTO',44:'HAMILTON',55:'SAINZ',63:'RUSSELL',
  77:'BOTTAS',81:'PIASTRI',87:'BEARMAN',41:'LINDBLAD'
};

const DRIVER_META = {
  VERSTAPPEN:{code:'VER', fullName:'Max Verstappen', team:'RED'}, HADJAR:{code:'HAD', fullName:'Isack Hadjar', team:'RED'}, TSUNODA:{code:'TSU', fullName:'Yuki Tsunoda', team:'RED'},
  RUSSELL:{code:'RUS', fullName:'George Russell', team:'MER'}, ANTONELLI:{code:'ANT', fullName:'Kimi Antonelli', team:'MER'},
  HAMILTON:{code:'HAM', fullName:'Lewis Hamilton', team:'FER'}, LECLERC:{code:'LEC', fullName:'Charles Leclerc', team:'FER'},
  PIASTRI:{code:'PIA', fullName:'Oscar Piastri', team:'MCL'}, NORRIS:{code:'NOR', fullName:'Lando Norris', team:'MCL'},
  LAWSON:{code:'LAW', fullName:'Liam Lawson', team:'VRB'}, LINDBLAD:{code:'LIN', fullName:'Arvid Lindblad', team:'VRB'},
  GASLY:{code:'GAS', fullName:'Pierre Gasly', team:'ALP'}, COLAPINTO:{code:'COL', fullName:'Franco Colapinto', team:'ALP'}, DOOHAN:{code:'DOO', fullName:'Jack Doohan', team:'ALP'},
  HULKENBERG:{code:'HUL', fullName:'Nico Hulkenberg', team:'AUD'}, BORTOLETO:{code:'BOR', fullName:'Gabriel Bortoleto', team:'AUD'},
  OCON:{code:'OCO', fullName:'Esteban Ocon', team:'HAA'}, BEARMAN:{code:'BEA', fullName:'Oliver Bearman', team:'HAA'},
  ALONSO:{code:'ALO', fullName:'Fernando Alonso', team:'AST'}, STROLL:{code:'STR', fullName:'Lance Stroll', team:'AST'},
  ALBON:{code:'ALB', fullName:'Alex Albon', team:'WIL'}, SAINZ:{code:'SAI', fullName:'Carlos Sainz', team:'WIL'},
  PEREZ:{code:'PER', fullName:'Sergio Perez', team:'CAD'}, BOTTAS:{code:'BOT', fullName:'Valtteri Bottas', team:'CAD'},
  MARTI:{code:'MAR', fullName:'Pepe Marti', team:'CAD'}
};

const TEAM_META = {
  MER:{name:'Mercedes', color:'#00d2be'}, RED:{name:'Red Bull', color:'#1e41ff'}, FER:{name:'Ferrari', color:'#e10600'}, MCL:{name:'McLaren', color:'#ff8700'},
  VRB:{name:'Racing Bulls', color:'#2b6cff'}, ALP:{name:'Alpine', color:'#ff87bc'}, AUD:{name:'Audi', color:'#00e701'}, HAA:{name:'Haas', color:'#ffffff'},
  AST:{name:'Aston Martin', color:'#006f62'}, WIL:{name:'Williams', color:'#00a0de'}, CAD:{name:'Cadillac', color:'#c9a646'}, CR:{name:'Custom Team', color:'#777777'}
};

try {
  const colorFile = path.join(__dirname, 'team-colors.json');
  if (fs.existsSync(colorFile)) {
    const overrides = JSON.parse(fs.readFileSync(colorFile, 'utf8'));
    for (const [code, data] of Object.entries(overrides)) {
      if (!TEAM_META[code]) TEAM_META[code] = { name: code, color: '#777777' };
      if (data.name) TEAM_META[code].name = data.name;
      if (data.color) TEAM_META[code].color = data.color;
    }
  }
} catch (err) {
  console.warn('Could not load team-colors.json:', err.message);
}

const state = {
  connected: false,
  packets: 0,
  lastPacketAt: null,
  lastRemote: null,
  packetCounts: {},
  participants: Array.from({ length: 22 }, (_, i) => defaultParticipant(i)),
  carsByIndex: {},
  cars: [],
  final: [],
  qualifyingFinal: [],
  sprintQualifyingFinal: [],
  raceFinal: [],
  sprintFinal: [],
  session: { type: 0, name: 'Unknown', kind: 'unknown', totalLaps: 0, trackId: null },
  manualKind: 'auto',
  dotdIndex: null,
  events: [],
  fastestLap: null,
  sessionUID: null,
  overtakes: Array(22).fill(0),
  driverBestPitstop: Array(22).fill(null),
  history: { drivers: {}, constructors: {} },
  lastFinalKey: '',
  udpBound: false,
  udpError: null,
  parseErrors: [],
  lastPacketSummary: null,
  packetBytes: 0,
};
const clients = new Set();

function defaultParticipant(i) {
  return { index: i, driverId: 255, teamId: 255, raceNumber: 0, name: `CAR ${i}`, fullName: `Car ${i}`, code: `C${i}`, team: 'CR', teamName: 'Custom Team' };
}

function readHeader(buf) {
  if (buf.length < HEADER_SIZE) return null;
  return {
    packetFormat: buf.readUInt16LE(0), gameYear: buf.readUInt8(2), major: buf.readUInt8(3), minor: buf.readUInt8(4), packetVersion: buf.readUInt8(5), packetId: buf.readUInt8(6),
    sessionUID: buf.readBigUInt64LE(7).toString(), sessionTime: buf.readFloatLE(15), frame: buf.readUInt32LE(19), overallFrame: buf.readUInt32LE(23),
    playerCarIndex: buf.readUInt8(27), secondaryPlayerCarIndex: buf.readUInt8(28),
  };
}

function cleanText(buf) {
  return buf.toString('utf8').replace(/\0.*$/g, '').replace(/\u2026/g, '').replace(/[^\x20-\x7EÀ-ž]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeDriverKey(name) {
  const up = String(name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!up || up.length < 3) return '';
  if (up.includes('VERSTAPPEN')) return 'VERSTAPPEN';
  if (up.includes('NORRIS')) return 'NORRIS';
  if (up.includes('PIASTRI')) return 'PIASTRI';
  if (up.includes('LECLERC')) return 'LECLERC';
  if (up.includes('HAMILTON')) return 'HAMILTON';
  if (up.includes('RUSSELL')) return 'RUSSELL';
  if (up.includes('ANTONELLI')) return 'ANTONELLI';
  if (up.includes('SAINZ')) return 'SAINZ';
  if (up.includes('ALBON')) return 'ALBON';
  if (up.includes('HULKENBERG') || up.includes('HULKENBURG')) return 'HULKENBERG';
  if (up.includes('BORTOLETO')) return 'BORTOLETO';
  if (up.includes('ALONSO')) return 'ALONSO';
  if (up.includes('STROLL')) return 'STROLL';
  if (up.includes('GASLY')) return 'GASLY';
  if (up.includes('COLAPINTO')) return 'COLAPINTO';
  if (up.includes('OCON')) return 'OCON';
  if (up.includes('BEARMAN')) return 'BEARMAN';
  if (up.includes('LAWSON')) return 'LAWSON';
  if (up.includes('HADJAR')) return 'HADJAR';
  if (up.includes('LINDBLAD')) return 'LINDBLAD';
  if (up.includes('TSUNODA')) return 'TSUNODA';
  if (up.includes('PEREZ') || up.includes('PREZ')) return 'PEREZ';
  if (up.includes('BOTTAS')) return 'BOTTAS';
  if (up.includes('MARTI')) return 'MARTI';
  return DRIVER_META[up] ? up : '';
}

function buildParticipant(index, driverId, teamId, raceNumber, rawName, manual) {
  let key = manual || DRIVER_BY_ID[driverId] || DRIVER_BY_RACE_NUMBER[raceNumber] || normalizeDriverKey(rawName);
  if (!key && normalizeDriverKey(rawName)) key = normalizeDriverKey(rawName);
  if (!key) return { ...defaultParticipant(index), driverId, teamId, raceNumber, rawName: rawName || '' };
  const meta = DRIVER_META[key] || { code: key.slice(0,3), fullName: key, team: TEAM_CODES_BY_ID[teamId] || 'CR' };
  const team = meta.team || TEAM_CODES_BY_ID[teamId] || 'CR';
  return { index, driverId, teamId, raceNumber, name: key, fullName: meta.fullName || key, code: meta.code || key.slice(0,3), team, teamName: TEAM_META[team]?.name || team, rawName: rawName || '' };
}

function parseSession(buf) {
  if (buf.length < HEADER_SIZE + 8) return;
  const totalLaps = buf.readUInt8(HEADER_SIZE + 3);
  const sessionType = buf.readUInt8(HEADER_SIZE + 6);
  const trackId = buf.readInt8(HEADER_SIZE + 7);
  const name = SESSION_TYPES[sessionType] || `Session ${sessionType}`;
  const autoKind = SPRINT_QUALIFYING_SESSION_IDS.has(sessionType) ? 'sprintQualifying' : RACE_QUALIFYING_SESSION_IDS.has(sessionType) ? 'qualifying' : RACE_SESSION_IDS.has(sessionType) ? 'race' : 'practice';
  const previousType = state.session.type;
  const previousUid = state.sessionUID;
  state.session = { type: sessionType, name, autoKind, kind: scoringKind(autoKind), totalLaps, trackId };
  if (previousType !== sessionType || previousUid !== state.sessionUID) {
    state.final = [];
    state.fastestLap = null;
    state.overtakes = Array(22).fill(0);
    state.driverBestPitstop = Array(22).fill(null);
    state.lastFinalKey = '';
    addEvent(`Session detected: ${name} (${state.session.kind})`);
  }
}

function readParticipantCandidate(buf, o, recordSize) {
  if (o + 7 > buf.length) return null;
  const driverId = buf.readUInt8(o + 1);
  const teamId = buf.readUInt8(o + 3);
  const raceNumber = buf.readUInt8(o + 5);
  let bestName = '';
  let bestKey = '';
  // F1 2025/2026 participant packets can be 57/58 bytes depending on revision.
  // The name is normally after nationality at offset 7 and can be 48 bytes.
  // Older examples used 32 bytes, which caused broken repeated names like SAI/Car.
  for (const start of [7, 8, 6, 9, 10, 5]) {
    for (const len of [48, 32, 40]) {
      if (o + start + len <= buf.length && o + start + len <= o + recordSize + 2) {
        const candidate = cleanText(buf.subarray(o + start, o + start + len));
        const key = normalizeDriverKey(candidate);
        if (key) return { driverId, teamId, raceNumber, rawName: candidate, key };
        if (candidate.length > bestName.length && /^[A-ZÀ-ž .'-]{3,}$/.test(candidate)) bestName = candidate;
      }
    }
  }
  return { driverId, teamId, raceNumber, rawName: bestName, key: '' };
}

function candidateScore(candidates) {
  let score = 0;
  const seen = new Set();
  for (const c of candidates) {
    if (!c) continue;
    const key = c.key || DRIVER_BY_ID[c.driverId] || DRIVER_BY_RACE_NUMBER[c.raceNumber] || normalizeDriverKey(c.rawName);
    if (key && !seen.has(key)) { score += 10; seen.add(key); }
    else if (key) score -= 8;
    if (DRIVER_BY_RACE_NUMBER[c.raceNumber]) score += 4;
    if (DRIVER_BY_ID[c.driverId]) score += 3;
    if (TEAM_CODES_BY_ID[c.teamId]) score += 2;
    if (c.rawName && c.rawName.length >= 3) score += 1;
  }
  return score;
}

function parseParticipants(buf, header) {
  const active = Math.min(buf.readUInt8(HEADER_SIZE), 22);
  const base = HEADER_SIZE + 1;
  const manualNames = loadManualNames();
  const remaining = buf.length - base;
  const possibleSizes = Array.from(new Set([
    Math.floor(remaining / 22), 58, 57, 56, 60, PARTICIPANT_SIZE
  ].filter(n => n >= 50 && n <= 70)));

  let best = { score: -Infinity, size: PARTICIPANT_SIZE, candidates: [] };
  for (const size of possibleSizes) {
    const candidates = [];
    for (let i = 0; i < 22; i++) {
      const o = base + i * size;
      if (o + 7 > buf.length) break;
      candidates.push(readParticipantCandidate(buf, o, size));
    }
    const score = candidateScore(candidates);
    if (score > best.score) best = { score, size, candidates };
  }

  const participants = [];
  for (let i = 0; i < 22; i++) {
    const c = best.candidates[i];
    if (!c) { participants.push(defaultParticipant(i)); continue; }
    const manual = manualNames[i] || manualNames[String(i)];
    participants.push(buildParticipant(i, c.driverId, c.teamId, c.raceNumber, c.rawName, manual || c.key));
  }

  // If the parser still produced lots of repeated placeholder names, keep the previous known good names.
  const uniqueCodes = new Set(participants.map(p => p.code).filter(c => !/^C\d+$/i.test(c)));
  if (uniqueCodes.size < 10 && new Set(state.participants.map(p => p.code).filter(c => !/^C\d+$/i.test(c))).size >= 10) {
    addEvent(`Participants packet ignored: low confidence (${uniqueCodes.size} unique driver codes)`);
    return;
  }

  state.participants = participants.concat(state.participants.slice(participants.length));
  addEvent(`Participants updated: ${active} cars, record size ${best.size}, confidence ${best.score}, UDP ${header.packetFormat}`);
}

function parseLapData(buf) {
  const cars = [];
  let fastest = state.fastestLap;
  for (let i = 0; i < 22; i++) {
    const o = HEADER_SIZE + i * LAP_DATA_SIZE;
    if (o + LAP_DATA_SIZE > buf.length) break;
    const lastLap = buf.readUInt32LE(o);
    const currentLap = buf.readUInt32LE(o + 4);
    const carPosition = buf.readUInt8(o + 32);
    const currentLapNum = buf.readUInt8(o + 33);
    const penalties = buf.readUInt8(o + 38);
    const gridPosition = buf.readUInt8(o + 43);
    const resultStatus = buf.readUInt8(o + 45);
    const pitStopTimerMs = buf.readUInt16LE(o + 49);
    if (lastLap > 0 && (!fastest || lastLap < fastest.ms)) fastest = { vehicleIdx: i, ms: lastLap, name: driverDisplay(i).fullName, code: driverDisplay(i).code };
    if (pitStopTimerMs >= 1000 && pitStopTimerMs <= 10000) {
      const previous = state.driverBestPitstop[i];
      if (!previous || pitStopTimerMs < previous) state.driverBestPitstop[i] = pitStopTimerMs;
    }
    if (carPosition > 0 && carPosition < 30) {
      const baseRow = { index: i, position: carPosition, grid: gridPosition, penaltiesTime: penalties, resultStatus, bestLapMs: lastLap };
      const breakdown = scoreBreakdown(baseRow, fastest);
      const d = driverDisplay(i);
      cars.push({
        ...d, index: i, position: carPosition, lap: currentLapNum, grid: gridPosition || null, lastLapMs: lastLap, currentLapMs: currentLap,
        penaltiesTime: penalties, resultStatus, pitStopTimerMs, overtakes: state.overtakes[i] || 0, ...breakdown, fantasy: breakdown.total,
      });
    }
  }
  cars.sort((a, b) => a.position - b.position);
  state.cars = cars;
  state.carsByIndex = Object.fromEntries(cars.map(c => [c.index, c]));
  state.fastestLap = fastest;
}

function parseFinalClassification(buf) {
  const numCars = Math.min(buf.readUInt8(HEADER_SIZE), 22);
  const rows = [];
  let best = null;
  for (let i = 0; i < numCars; i++) {
    const o = HEADER_SIZE + 1 + i * FINAL_CLASSIFICATION_SIZE;
    if (o + FINAL_CLASSIFICATION_SIZE > buf.length) break;
    const row = {
      index: i,
      position: buf.readUInt8(o), laps: buf.readUInt8(o + 1), grid: buf.readUInt8(o + 2), gamePoints: buf.readUInt8(o + 3), pitStops: buf.readUInt8(o + 4),
      resultStatus: buf.readUInt8(o + 5), resultReason: buf.readUInt8(o + 6), bestLapMs: buf.readUInt32LE(o + 7), totalRaceTime: buf.readDoubleLE(o + 11),
      penaltiesTime: buf.readUInt8(o + 19), numPenalties: buf.readUInt8(o + 20),
    };
    const d = driverDisplay(i);
    Object.assign(row, d);
    if (row.bestLapMs > 0 && (!best || row.bestLapMs < best.ms)) best = { vehicleIdx: i, ms: row.bestLapMs, name: d.fullName, code: d.code };
    rows.push(row);
  }
  state.fastestLap = best || state.fastestLap;
  const scored = rows.map(r => {
    const breakdown = scoreBreakdown(r, state.fastestLap);
    return { ...r, overtakes: state.overtakes[r.index] || 0, ...breakdown, fantasy: breakdown.total };
  }).sort((a, b) => a.position - b.position);
  state.final = scored;
  if (state.session.kind === 'qualifying') state.qualifyingFinal = scored;
  else if (state.session.kind === 'sprintQualifying') state.sprintQualifyingFinal = scored;
  else if (state.session.kind === 'sprint') state.sprintFinal = scored;
  else if (state.session.kind === 'race') state.raceFinal = scored;
  addToHistory(scored);
  addEvent(`Final classification received — ${state.session.name} (${state.session.kind}) calculated`);
}

function parseEvent(buf) {
  if (buf.length < HEADER_SIZE + 4) return;
  const code = buf.subarray(HEADER_SIZE, HEADER_SIZE + 4).toString('ascii');
  const detail = HEADER_SIZE + 4;
  if (code === 'FTLP' && buf.length >= detail + 5) {
    const vehicleIdx = buf.readUInt8(detail);
    const lapTime = buf.readFloatLE(detail + 1);
    const d = driverDisplay(vehicleIdx);
    state.fastestLap = { vehicleIdx, ms: Math.round(lapTime * 1000), name: d.fullName, code: d.code };
    addEvent(`Fastest lap: ${d.fullName} ${formatMs(lapTime * 1000)}`);
  } else if (code === 'OVTK' && buf.length >= detail + 2) {
    const overtaker = buf.readUInt8(detail);
    const overtaken = buf.readUInt8(detail + 1);
    state.overtakes[overtaker] = (state.overtakes[overtaker] || 0) + 1;
    addEvent(`Overtake: ${driverDisplay(overtaker).code} passed ${driverDisplay(overtaken).code}`);
  } else if (code === 'RTMT' && buf.length >= detail + 1) {
    addEvent(`Retirement: ${driverDisplay(buf.readUInt8(detail)).fullName}`);
  } else if (code === 'PENA' && buf.length >= detail + 7) {
    addEvent(`Penalty: ${driverDisplay(buf.readUInt8(detail + 2)).code} +${buf.readUInt8(detail + 4)}s`);
  } else if (code === 'RCWN' && buf.length >= detail + 1) {
    addEvent(`Race winner: ${driverDisplay(buf.readUInt8(detail)).fullName}`);
  } else if (!['SSTA','SEND'].includes(code)) {
    addEvent(`Event: ${code}`);
  }
}

function scoringKind(autoKind = state.session.autoKind || state.session.kind) {
  return state.manualKind && state.manualKind !== 'auto' ? state.manualKind : autoKind;
}

function isBadResult(status) { return [4,5,6,7].includes(Number(status)); }

function scoreBreakdown(row, fastest) {
  const kind = scoringKind();
  const overtakes = state.overtakes[row.index] || 0;
  const isFastest = fastest && fastest.vehicleIdx === row.index;
  const dotdBonus = kind === 'race' && state.dotdIndex === row.index ? 10 : 0;
  if (kind === 'qualifying' || kind === 'sprintQualifying') {
    const noTimeOrBad = !row.bestLapMs || isBadResult(row.resultStatus);
    const resultPoints = noTimeOrBad ? 0 : (QUALI_POINTS[row.position] || 0);
    const badPenalty = noTimeOrBad ? QUALI_BAD_PENALTY : 0;
    return { resultPoints, positionGainLoss: 0, overtakes: 0, fastestLapBonus: 0, dotdBonus: 0, badPenalty, penaltySeconds: 0, total: resultPoints + badPenalty };
  }
  const sprint = kind === 'sprint';
  const bad = isBadResult(row.resultStatus);
  const resultPoints = bad ? 0 : (sprint ? (SPRINT_POINTS[row.position] || 0) : (RACE_POINTS[row.position] || 0));
  let positionGainLoss = 0;
  if (!bad && row.grid > 0 && row.position > 0) {
    const raw = row.grid - row.position;
    positionGainLoss = sprint && raw < 0 ? Math.max(raw, -10) : raw;
  }
  const fastestLapBonus = isFastest ? (sprint ? SPRINT_FASTEST_LAP_BONUS : RACE_FASTEST_LAP_BONUS) : 0;
  const badPenalty = bad ? (sprint ? SPRINT_DNF_PENALTY : RACE_DNF_PENALTY) : 0;
  const penaltySeconds = 0; // F1 Fantasy rules do not subtract normal time penalties as fantasy points.
  const total = resultPoints + positionGainLoss + overtakes + fastestLapBonus + dotdBonus + badPenalty;
  return { resultPoints, positionGainLoss, overtakes, fastestLapBonus, dotdBonus, badPenalty, penaltySeconds, total };
}

function driverDisplay(index) {
  const p = state.participants[index] || defaultParticipant(index);
  return { index, name: p.name, fullName: p.fullName, code: p.code, team: p.team, teamName: TEAM_META[p.team]?.name || p.team };
}

function constructorPitstopPoints(teamCode) {
  const drivers = state.participants.filter(p => p.team === teamCode).map(p => p.index);
  const times = drivers.map(i => state.driverBestPitstop[i]).filter(Boolean);
  if (!times.length) return { pitstopPoints: 0, bestPitstopMs: null };
  const best = Math.min(...times);
  let pts = 0;
  if (best < 1800) pts = 35;
  else if (best < 2000) pts = 20;
  else if (best <= 2199) pts = 10;
  else if (best <= 2499) pts = 5;
  else if (best <= 2999) pts = 2;
  return { pitstopPoints: pts, bestPitstopMs: best };
}

function qualiTeamwork(teamRows) {
  const good = teamRows.filter(r => !isBadResult(r.resultStatus));
  const q3 = good.filter(r => r.position && r.position <= 10).length;
  const q2 = good.filter(r => r.position && r.position <= 15).length;
  const dsq = teamRows.filter(r => isBadResult(r.resultStatus)).length;
  let teamwork = -1;
  if (q3 >= 2) teamwork = 10;
  else if (q3 === 1) teamwork = 5;
  else if (q2 >= 2) teamwork = 3;
  else if (q2 === 1) teamwork = 1;
  return teamwork + (dsq * QUALI_BAD_PENALTY);
}


function recalcScoredRows(rows, kindOverride) {
  const oldManual = state.manualKind;
  if (kindOverride) state.manualKind = kindOverride;
  const out = (rows || []).map(r => {
    const b = scoreBreakdown(r, state.fastestLap);
    return { ...r, ...b, fantasy: b.total };
  });
  state.manualKind = oldManual;
  return out;
}

function latestByIndex(rows) {
  const map = new Map();
  for (const r of rows || []) map.set(Number(r.index), r);
  return map;
}

function weekendDriverRows() {
  // Use final results when they exist, but keep scoring the current live session before final classification arrives.
  // This fixes the dashboard looking frozen/empty during the race or quali.
  const currentKind = scoringKind(state.session.autoKind);
  const liveSource = state.final?.length ? state.final : state.cars;
  const liveScored = recalcScoredRows(liveSource || [], currentKind);
  const live = latestByIndex(liveScored);
  let qRows = state.qualifyingFinal || [];
  let sqRows = state.sprintQualifyingFinal || [];
  let sprintRows = state.sprintFinal || [];
  let raceRows = state.raceFinal || [];
  if (currentKind === 'qualifying' && !qRows.length) qRows = liveScored;
  if (currentKind === 'sprintQualifying' && !sqRows.length) sqRows = liveScored;
  if (currentKind === 'sprint' && !sprintRows.length) sprintRows = liveScored;
  if (currentKind === 'race' && !raceRows.length) raceRows = liveScored;
  const q = latestByIndex(recalcScoredRows(qRows, 'qualifying'));
  const sq = latestByIndex(recalcScoredRows(sqRows, 'sprintQualifying'));
  const sprint = latestByIndex(recalcScoredRows(sprintRows, 'sprint'));
  const race = latestByIndex(recalcScoredRows(raceRows, 'race'));
  const ids = new Set([...q.keys(), ...sq.keys(), ...sprint.keys(), ...race.keys(), ...live.keys()]);
  if (!ids.size) for (const p of state.participants) ids.add(p.index);
  const rows = [];
  for (const idx of ids) {
    const d = driverDisplay(idx);
    const qr = q.get(idx);
    const sqr = sq.get(idx);
    const sr = sprint.get(idx);
    const rr = race.get(idx);
    const lr = live.get(idx);
    const base = rr || sr || sqr || qr || lr || { index: idx };
    const qTotal = qr ? Number(qr.fantasy || 0) : 0;
    const sprintQualifyingTotal = sqr ? Number(sqr.fantasy || 0) : 0;
    const sprintTotal = sr ? Number(sr.fantasy || 0) : 0;
    const raceTotal = rr ? Number(rr.fantasy || 0) : 0;
    const total = qTotal + sprintQualifyingTotal + sprintTotal + raceTotal;
    rows.push({
      ...d,
      index: idx,
      currentPosition: base.position || null,
      fantasy: total,
      total,
      qPosition: qr?.position || null,
      qPoints: qr ? Number(qr.resultPoints || 0) : 0,
      qPenalty: qr ? Number(qr.badPenalty || 0) : 0,
      sprintQualifyingPosition: sqr?.position || null,
      sprintQualifyingPoints: sqr ? Number(sqr.resultPoints || 0) : 0,
      sprintQualifyingPenalty: sqr ? Number(sqr.badPenalty || 0) : 0,
      sprintPosition: sr?.position || null,
      sprintPoints: sr ? Number(sr.resultPoints || 0) : 0,
      racePosition: rr?.position || null,
      resultPoints: rr ? Number(rr.resultPoints || 0) : 0,
      positionGainLoss: rr ? Number(rr.positionGainLoss || 0) : 0,
      overtakes: rr ? Number(rr.overtakes || 0) : 0,
      fastestLapBonus: rr ? Number(rr.fastestLapBonus || 0) : 0,
      dotdBonus: rr ? Number(rr.dotdBonus || 0) : 0,
      badPenalty: (rr ? Number(rr.badPenalty || 0) : 0) + (sr ? Number(sr.badPenalty || 0) : 0) + (sqr ? Number(sqr.badPenalty || 0) : 0) + (qr ? Number(qr.badPenalty || 0) : 0),
      qTotal,
      sprintQualifyingTotal,
      sprintTotal,
      raceTotal,
      grid: rr?.grid || base.grid || null,
      position: rr?.position || sr?.position || sqr?.position || qr?.position || base.position || null,
      fullName: d.fullName,
      team: d.team,
      teamName: d.teamName,
    });
  }
  return rows.filter(r => !/^C\d+$/i.test(r.code) || r.qPosition || r.racePosition || r.total !== 0).sort((a,b)=>b.total-a.total);
}

function weekendConstructorsSnapshot() {
  const drivers = weekendDriverRows();
  const map = new Map();
  for (const d of drivers) {
    const code = d.team || 'CR';
    if (!map.has(code)) map.set(code, { code, name: TEAM_META[code]?.name || code, color: TEAM_META[code]?.color || '#777', total: 0, qualiPos: 0, qualiTeamwork: 0, sprintQualiPos: 0, sprintQualiTeamwork: 0, sprintResult: 0, sprintTotal: 0, raceResult: 0, positionGainLoss: 0, overtakes: 0, fastestLapBonus: 0, pitstopPoints: 0, drivers: 0 });
    const t = map.get(code);
    t.drivers++;
    t.total += Number(d.total || 0) - Number(d.dotdBonus || 0); // DOTD is driver-only
    t.qualiPos += Number(d.qPoints || 0) + Number(d.qPenalty || 0);
    t.sprintQualiPos += Number(d.sprintQualifyingPoints || 0) + Number(d.sprintQualifyingPenalty || 0);
    t.sprintResult += Number(d.sprintPoints || 0);
    t.sprintTotal += Number(d.sprintTotal || 0);
    t.raceResult += Number(d.resultPoints || 0);
    t.positionGainLoss += Number(d.positionGainLoss || 0);
    t.overtakes += Number(d.overtakes || 0);
    t.fastestLapBonus += Number(d.fastestLapBonus || 0);
  }
  const qByTeam = new Map();
  for (const r of recalcScoredRows(state.qualifyingFinal || [], 'qualifying')) {
    const d = driverDisplay(r.index);
    if (!qByTeam.has(d.team)) qByTeam.set(d.team, []);
    qByTeam.get(d.team).push({ ...r, team: d.team });
  }
  for (const [code, rows] of qByTeam.entries()) {
    if (!map.has(code)) map.set(code, { code, name: TEAM_META[code]?.name || code, color: TEAM_META[code]?.color || '#777', total: 0, qualiPos: 0, qualiTeamwork: 0, sprintQualiPos: 0, sprintQualiTeamwork: 0, sprintResult: 0, sprintTotal: 0, raceResult: 0, positionGainLoss: 0, overtakes: 0, fastestLapBonus: 0, pitstopPoints: 0, drivers: 0 });
    const tw = qualiTeamwork(rows);
    map.get(code).qualiTeamwork = tw;
    map.get(code).total += tw;
  }
  const sqByTeam = new Map();
  for (const r of recalcScoredRows(state.sprintQualifyingFinal || [], 'sprintQualifying')) {
    const d = driverDisplay(r.index);
    if (!sqByTeam.has(d.team)) sqByTeam.set(d.team, []);
    sqByTeam.get(d.team).push({ ...r, team: d.team });
  }
  for (const [code, rows] of sqByTeam.entries()) {
    if (!map.has(code)) map.set(code, { code, name: TEAM_META[code]?.name || code, color: TEAM_META[code]?.color || '#777', total: 0, qualiPos: 0, qualiTeamwork: 0, sprintQualiPos: 0, sprintQualiTeamwork: 0, sprintResult: 0, sprintTotal: 0, raceResult: 0, positionGainLoss: 0, overtakes: 0, fastestLapBonus: 0, pitstopPoints: 0, drivers: 0 });
    const tw = qualiTeamwork(rows);
    map.get(code).sprintQualiTeamwork = tw;
    map.get(code).total += tw;
  }
  for (const t of map.values()) {
    const pit = constructorPitstopPoints(t.code);
    t.pitstopPoints = pit.pitstopPoints;
    t.bestPitstopMs = pit.bestPitstopMs;
    t.total += t.pitstopPoints;
  }
  return Array.from(map.values()).sort((a,b)=>b.total-a.total);
}

function constructorsSnapshot() {
  const source = state.final.length ? state.final : state.cars;
  const map = new Map();
  for (const c of source || []) {
    const code = c.team || 'CR';
    if (!map.has(code)) map.set(code, { code, name: TEAM_META[code]?.name || code, color: TEAM_META[code]?.color || '#777', total: 0, drivers: 0, qualiPos: 0, qualiTeamwork: 0, sprintQualiPos: 0, sprintQualiTeamwork: 0, sprintResult: 0, sprintTotal: 0, raceResult: 0, positionGainLoss: 0, overtakes: 0, fastestLapBonus: 0, dotdBonusExcluded: 0, pitstopPoints: 0, bestPitstopMs: null, rows: [] });
    const t = map.get(code);
    t.rows.push(c);
    t.drivers += 1;
    t.qualiPos += state.session.kind === 'qualifying' ? Number(c.resultPoints || 0) : 0;
    t.raceResult += state.session.kind !== 'qualifying' ? Number(c.resultPoints || 0) : 0;
    t.positionGainLoss += Number(c.positionGainLoss || 0);
    t.overtakes += Number(c.overtakes || 0);
    t.fastestLapBonus += Number(c.fastestLapBonus || 0);
    t.dotdBonusExcluded += Number(c.dotdBonus || 0);
  }
  for (const t of map.values()) {
    if (state.session.kind === 'qualifying' || state.session.kind === 'sprintQualifying') {
      t.qualiTeamwork = qualiTeamwork(t.rows);
      t.total = t.rows.reduce((sum, r) => sum + Number(r.resultPoints || 0) + Number(r.badPenalty || 0), 0) + t.qualiTeamwork;
    } else {
      const pit = constructorPitstopPoints(t.code);
      t.pitstopPoints = pit.pitstopPoints;
      t.bestPitstopMs = pit.bestPitstopMs;
      t.total = t.rows.reduce((sum, r) => sum + Number(r.fantasy || 0) - Number(r.dotdBonus || 0), 0) + t.pitstopPoints;
    }
    delete t.rows;
  }
  return Array.from(map.values()).sort((a,b)=>b.total-a.total);
}

function addToHistory(scored) {
  const round = currentRound();
  const kind = scoringKind();
  const key = `${state.sessionUID}-${kind}-${round}-${scored.map(r=>`${r.index}:${r.position}:${r.total}`).join('|')}`;
  if (key === state.lastFinalKey) return;
  state.lastFinalKey = key;
  for (const r of scored) {
    const id = r.code;
    if (!state.history.drivers[id]) state.history.drivers[id] = { code: r.code, name: r.fullName, team: r.team, rounds: {} };
    state.history.drivers[id].rounds[round] = r.fantasy;
  }
  for (const c of constructorsSnapshot()) {
    if (!state.history.constructors[c.code]) state.history.constructors[c.code] = { code: c.code, name: c.name, rounds: {} };
    state.history.constructors[c.code].rounds[round] = c.total;
  }
}

function loadManualNames() {
  try {
    const file = path.join(__dirname, 'driver-overrides.json');
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = {};
    for (const [k,v] of Object.entries(parsed)) out[k] = normalizeDriverKey(v) || String(v).toUpperCase();
    return out;
  } catch { return {}; }
}

function formatMs(ms) {
  if (!ms) return '-';
  const total = Math.round(ms);
  const mins = Math.floor(total / 60000);
  const secs = ((total % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${mins}:${secs}`;
}

function addEvent(text) {
  state.events.unshift({ at: new Date().toLocaleTimeString(), text });
  state.events = state.events.slice(0, 25);
}

function publicIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) for (const net of entries || []) if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
  return ips;
}

function currentRound() {
  return state.session.trackId != null ? Math.max(1, Math.min(24, Number(state.session.trackId) + 1)) : 1;
}

function allDriversForControls() {
  return state.participants.map(p => ({ index: p.index, code: p.code, name: p.fullName, team: p.team })).filter(p => !String(p.code).startsWith('C'));
}

function snapshot() {
  state.session.kind = scoringKind(state.session.autoKind);
  return {
    ...state,
    teamMeta: TEAM_META,
    localIps: publicIps(), udpPort: UDP_PORT, webPort: WEB_PORT, round: currentRound(),
    constructors: weekendConstructorsSnapshot(),
    driverRows: weekendDriverRows(),
    fastestLapFormatted: state.fastestLap ? { ...state.fastestLap, time: formatMs(state.fastestLap.ms) } : null,
    driversForControls: allDriversForControls(),
  };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(payload);
}

const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
udp.on('error', (err) => {
  state.udpError = err.message;
  addEvent(`UDP listener error: ${err.message}`);
  console.error('UDP listener error:', err);
});

udp.on('message', (buf, rinfo) => {
  const header = readHeader(buf);
  if (!header) {
    state.parseErrors.unshift({ at: new Date().toLocaleTimeString(), text: `Short/invalid packet: ${buf.length} bytes from ${rinfo.address}:${rinfo.port}` });
    state.parseErrors = state.parseErrors.slice(0, 20);
    return;
  }
  state.connected = true;
  state.packets++;
  state.lastPacketAt = new Date().toISOString();
  state.lastRemote = `${rinfo.address}:${rinfo.port}`;
  state.packetBytes += buf.length;
  state.lastPacketSummary = { id: header.packetId, name: PACKET[header.packetId] || `Packet ${header.packetId}`, format: header.packetFormat, year: header.gameYear, version: header.packetVersion, bytes: buf.length, from: state.lastRemote, at: state.lastPacketAt };
  if (state.packets === 1 || state.packets % 250 === 0) console.log(`UDP ${state.packets}: ${state.lastPacketSummary.name} (${buf.length} bytes) from ${state.lastRemote}`);
  const oldUid = state.sessionUID;
  state.sessionUID = header.sessionUID;
  if (oldUid && oldUid !== header.sessionUID) {
    state.overtakes = Array(22).fill(0);
    state.driverBestPitstop = Array(22).fill(null);
    state.fastestLap = null;
    state.final = [];
  }
  state.packetCounts[header.packetId] = (state.packetCounts[header.packetId] || 0) + 1;
  if (header.packetFormat !== 2025 && header.packetFormat !== 2026) addEvent(`Warning: unsupported UDP format ${header.packetFormat}`);
  try {
    if (header.packetId === 1) parseSession(buf);
    else if (header.packetId === 2) parseLapData(buf);
    else if (header.packetId === 3) parseEvent(buf);
    else if (header.packetId === 4) parseParticipants(buf, header);
    else if (header.packetId === 8) parseFinalClassification(buf);
    if (state.packets % 5 === 0) broadcast();
  } catch (err) {
    const text = `Parse error on ${PACKET[header.packetId] || header.packetId}: ${err.message} (${buf.length} bytes)`;
    state.parseErrors.unshift({ at: new Date().toLocaleTimeString(), text });
    state.parseErrors = state.parseErrors.slice(0, 20);
    addEvent(text);
    console.error(text);
  }
});
udp.bind(UDP_PORT, '0.0.0.0', () => {
  state.udpBound = true;
  console.log(`F1 25 UDP listener ready on 0.0.0.0:${UDP_PORT}`);
  console.log(`Dashboard: http://localhost:${WEB_PORT}`);
  console.log(`Use one of these IPs in F1 25 UDP IP Address: ${publicIps().join(', ') || '127.0.0.1'}`);
});

function sendJson(res, payload) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${WEB_PORT}`);
  if (url.pathname === '/api/state' || url.pathname === '/api/debug') return sendJson(res, snapshot());
  if (url.pathname === '/api/mode') {
    const kind = String(url.searchParams.get('kind') || 'auto');
    if (['auto','qualifying','sprintQualifying','sprint','race'].includes(kind)) {
      state.manualKind = kind;
      state.session.kind = scoringKind(state.session.autoKind);
      state.final = recalcScoredRows(state.final, state.session.kind);
      state.cars = recalcScoredRows(state.cars, state.session.kind);
      addEvent(`Scoring mode set to ${kind}`);
    }
    return sendJson(res, snapshot());
  }
  if (url.pathname === '/api/dotd') {
    const value = url.searchParams.get('index');
    state.dotdIndex = value === null || value === '' || value === 'none' ? null : Number(value);
    state.final = recalcScoredRows(state.final, state.session.kind);
    state.cars = recalcScoredRows(state.cars, state.session.kind);
    state.raceFinal = recalcScoredRows(state.raceFinal, 'race');
    state.sprintFinal = recalcScoredRows(state.sprintFinal, 'sprint');
    state.sprintQualifyingFinal = recalcScoredRows(state.sprintQualifyingFinal, 'sprintQualifying');
    state.qualifyingFinal = recalcScoredRows(state.qualifyingFinal, 'qualifying');
    addEvent(`Driver of the Day set to ${state.dotdIndex == null ? 'none' : driverDisplay(state.dotdIndex).fullName}`);
    return sendJson(res, snapshot());
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    clients.add(res);
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    req.on('close', () => clients.delete(res));
    return;
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  const full = path.join(__dirname, 'public', file);
  const publicDir = path.join(__dirname, 'public');
  if (!full.startsWith(publicDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const type = full.endsWith('.html') ? 'text/html' : full.endsWith('.js') ? 'application/javascript' : full.endsWith('.css') ? 'text/css' : 'text/plain';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});
server.listen(WEB_PORT, () => console.log(`Web dashboard listening on http://localhost:${WEB_PORT}`));
setInterval(broadcast, 500);
