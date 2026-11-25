// ===== LADDER MOTORU + SAHNE MODELİ =====
const L = 6; // mantık sütunu sayısı (sonra bobin sütunu gelir)

const TAGLIST = [
  ['I0.0','START','Start butonu (NO)'],
  ['I0.1','STOP','Stop butonu (NC kablolu: basılı değilken 1)'],
  ['I0.2','ACIL_STOP','Acil stop (NC kablolu: basılı değilken 1)'],
  ['I0.3','SNS_GIRIS','Giriş fotoseli'],
  ['I0.4','SNS_YUKSEK','Yükseklik sensörü (sadece uzun kutu)'],
  ['I0.5','SNS_PISTON','Piston önü fotoseli'],
  ['I0.6','PST_ILERI','Piston ileri limit'],
  ['I0.7','PST_GERI','Piston geri limit'],
  ['I1.0','RESET','Reset butonu (NO)'],
  ['I1.1','OTO_MAN','Seçici anahtar (1 = OTO)'],
  ['Q0.0','KONVEYOR','Konveyör motoru'],
  ['Q0.1','PISTON','Piston ileri valfi'],
  ['Q0.2','BESLEYICI','Kutu besleyici (yükselen kenarda 1 kutu)'],
  ['Q0.3','L_YESIL','Yeşil lamba'],
  ['Q0.4','L_KIRMIZI','Kırmızı lamba'],
  ['Q0.5','L_SARI','Sarı lamba'],
  ['Q0.6','KORNA','Korna'],
];
for (let b = 0; b < 2; b++) for (let i = 0; i < 8; i++) TAGLIST.push([`M${b}.${i}`, '', 'Hafıza biti']);
for (let i = 0; i < 8; i++) TAGLIST.push([`T${i}`, '', 'Zamanlayıcı']);
for (let i = 0; i < 4; i++) TAGLIST.push([`C${i}`, '', 'Sayıcı']);
const SYM = Object.fromEntries(TAGLIST.map(t => [t[0], t[1]]));

const CONTACTS = ['NO', 'NC', 'P', 'N'];
const BLOCKS = ['TON', 'TOF', 'CTU'];
const COILS = ['OUT', 'S', 'R'];

function newState() { return { bits: {}, T: {}, C: {}, edge: {} }; }
function getT(st, a) { return st.T[a] || (st.T[a] = { et: 0, pt: 0, q: false }); }
function getC(st, a) { return st.C[a] || (st.C[a] = { cv: 0, pv: 0, q: false }); }
function readBit(st, a) {
  if (!a) return false;
  if (a[0] === 'T') return !!(st.T[a] && st.T[a].q);
  if (a[0] === 'C') return !!(st.C[a] && st.C[a].q);
  return !!st.bits[a];
}

function newRung(comment = '') {
  return { comment, cells: [Array(L).fill(null)], coils: [null], links: [] };
}
function hasLink(rung, k, r) { return rung.links.includes(k + ':' + r); }

// Satırdaki boş hücre kablo sayılır mı? (Satır 0: hep evet. Alt satırlar: dal bağlantıları arasında)
function wireRange(rung, r) {
  if (r === 0) return [0, L];
  let mn = Infinity, mx = -Infinity;
  for (let k = 0; k <= L; k++) if (hasLink(rung, k, r - 1) || hasLink(rung, k, r)) { mn = Math.min(mn, k); mx = Math.max(mx, k); }
  if (rung.coils[r]) mx = L;
  if (mn === Infinity) return [0, 0];
  return [mn, mx];
}

function evalRung(rung, st, dt, ri) {
  const rows = rung.cells.length;
  const N = Array.from({ length: rows }, () => Array(L + 1).fill(false));
  const info = Array.from({ length: rows }, () => Array(L).fill(null));
  const merge = (k) => {
    let r = 0;
    while (r < rows) {
      let e = r; while (e < rows - 1 && hasLink(rung, k, e)) e++;
      if (e > r) { let v = false; for (let i = r; i <= e; i++) v = v || N[i][k]; for (let i = r; i <= e; i++) N[i][k] = v; }
      r = e + 1;
    }
  };
  for (let r = 0; r < rows; r++) N[r][0] = (r === 0);
  merge(0);
  const ranges = Array.from({ length: rows }, (_, r) => wireRange(rung, r));
  for (let k = 0; k < L; k++) {
    for (let r = 0; r < rows; r++) {
      const cell = rung.cells[r][k], pin = N[r][k];
      let out = false, closed = false;
      if (!cell) { const [a, b] = ranges[r]; out = (k >= a && k < b) ? pin : false; }
      else {
        const key = ri + ':' + r + ':' + k;
        switch (cell.t) {
          case 'W': out = pin; break;
          case 'NO': closed = readBit(st, cell.a); out = pin && closed; break;
          case 'NC': closed = !readBit(st, cell.a); out = pin && closed; break;
          case 'P': { const cur = readBit(st, cell.a), prev = !!st.edge[key]; st.edge[key] = cur; closed = cur && !prev; out = pin && closed; break; }
          case 'N': { const cur = readBit(st, cell.a), prev = !!st.edge[key]; st.edge[key] = cur; closed = !cur && prev; out = pin && closed; break; }
          case 'TON': { const t = getT(st, cell.a), pt = (cell.pt || 0) * 1000; t.pt = pt;
            if (pin) t.et = Math.min(t.et + dt * 1000, pt); else t.et = 0;
            t.q = pin && t.et >= pt; out = t.q; break; }
          case 'TOF': { const t = getT(st, cell.a), pt = (cell.pt || 0) * 1000; t.pt = pt;
            if (pin) { t.q = true; t.et = 0; } else if (t.q) { t.et = Math.min(t.et + dt * 1000, pt); if (t.et >= pt) t.q = false; }
            out = t.q; break; }
          case 'CTU': { const c = getC(st, cell.a); c.pv = cell.pv || 0; const prev = !!st.edge[key]; st.edge[key] = pin;
            if (pin && !prev) c.cv++; c.q = c.cv >= c.pv; out = c.q; break; }
        }
      }
      N[r][k + 1] = out; info[r][k] = { pin, out, closed };
    }
    merge(k + 1);
  }
  for (let r = 0; r < rows; r++) {
    const coil = rung.coils[r]; if (!coil || !coil.a) continue;
    const p = N[r][L], a = coil.a;
    if (coil.t === 'OUT') { if (a[0] !== 'T' && a[0] !== 'C') st.bits[a] = p; }
    else if (coil.t === 'S') { if (p && a[0] !== 'T' && a[0] !== 'C') st.bits[a] = true; }
    else if (coil.t === 'R') { if (p) { if (a[0] === 'T') { const t = getT(st, a); t.et = 0; t.q = false; } else if (a[0] === 'C') { const c = getC(st, a); c.cv = 0; c.q = false; } else st.bits[a] = false; } }
  }
  return { N, info };
}

function scan(prog, st, dt) { return prog.map((r, i) => evalRung(r, st, dt, i)); }

// ===== SAHNE (konveyör hattı) =====
const BELT = { x0: 70, x1: 690, y: 120, h: 60 };
const S_ENTRY = 140, S_HEIGHT = 330, S_PUSH = 540, PUSH_HALF = 36, BOX = 40;

function newScene() { return { boxes: [], p: 0, sorted: 0, normal: 0, wrong: 0, missed: 0, prevFeed: false, phase: 0, id: 1, motorAng: 0, tallNext: [] }; }
function boxTop(b) { return BELT.y + (BELT.h - BOX) / 2 + b.dy; }
function spawnBox(sc, tall) {
  if (sc.boxes.some(b => b.st === 'belt' && b.x < BELT.x0 + BOX + 8)) return false;
  if (tall === undefined) tall = sc.tallNext.length ? sc.tallNext.shift() : Math.random() < 0.4;
  sc.boxes.push({ id: sc.id++, x: BELT.x0, dy: 0, tall, st: 'belt', t: 0 });
  return true;
}
function stepScene(sc, out, dt) {
  const v = out['Q0.0'] ? 90 : 0;
  sc.phase += v * dt; if (out['Q0.0']) sc.motorAng += dt * 10;
  sc.p = Math.max(0, Math.min(1, sc.p + (out['Q0.1'] ? 1 : -1) * dt / 0.45));
  const headY = BELT.y - 16 + sc.p * (BELT.h + 26);
  sc.headY = headY;
  if (out['Q0.2'] && !sc.prevFeed) spawnBox(sc);
  sc.prevFeed = !!out['Q0.2'];
  const belt = sc.boxes.filter(b => b.st === 'belt').sort((a, b) => b.x - a.x);
  for (let i = 0; i < belt.length; i++) {
    const b = belt[i];
    const under = b.x + BOX > S_PUSH - PUSH_HALF && b.x < S_PUSH + PUSH_HALF;
    if (under && headY > boxTop(b)) {
      b.dy = headY - (BELT.y + (BELT.h - BOX) / 2);
      if (b.dy > (BELT.h + BOX) / 2) { b.st = 'chute'; b.t = 0; }
      continue;
    }
    let nx = b.x + v * dt;
    const ahead = belt.slice(0, i).filter(a => a.st === 'belt' && a.x > b.x && Math.abs(a.dy - b.dy) < BOX).pop();
    if (ahead) nx = Math.min(nx, ahead.x - BOX - 4);
    if (nx > b.x) b.x = nx;
    if (b.x > BELT.x1 - 6) { b.st = 'end'; b.t = 0; if (b.tall) sc.missed++; else sc.normal++; }
  }
  for (const b of sc.boxes) {
    if (b.st === 'chute') { b.t += dt; b.dy += 140 * dt; if (b.t > 0.55) { b.st = 'gone'; if (b.tall) sc.sorted++; else sc.wrong++; } }
    else if (b.st === 'end') { b.t += dt; b.x += 70 * dt; if (b.t > 0.5) b.st = 'gone'; }
  }
  sc.boxes = sc.boxes.filter(b => b.st !== 'gone');
}
function covers(b, x) { return b.x <= x && x <= b.x + BOX; }
function sceneInputs(sc) {
  const onBelt = sc.boxes.filter(b => b.st === 'belt');
  return {
    'I0.3': onBelt.some(b => covers(b, S_ENTRY) && b.dy < 10),
    'I0.4': onBelt.some(b => b.tall && covers(b, S_HEIGHT) && b.dy < 10),
    'I0.5': onBelt.some(b => covers(b, S_PUSH) && b.dy < 6),
    'I0.6': sc.p >= 0.97,
    'I0.7': sc.p <= 0.03,
  };
}

// ===== ÖRNEK PROGRAMLAR =====
function R(comment, rows, coils, links) {
  const rung = newRung(comment);
  rung.cells = rows.map(row => { const a = Array(L).fill(null); row.forEach((c, i) => { if (c) a[i] = c; }); return a; });
  rung.coils = coils.slice(0, rows.length); while (rung.coils.length < rows.length) rung.coils.push(null);
  rung.links = links || [];
  return rung;
}
const no = a => ({ t: 'NO', a }), nc = a => ({ t: 'NC', a });
const out = a => ({ t: 'OUT', a }), set = a => ({ t: 'S', a }), rst = a => ({ t: 'R', a });

const SEAL = () => R('Start-Stop mühürleme: START basınca konveyör çalışır, kendini tutar. STOP ve ACİL NC olduğu için NO kontakla okunur.',
  [[no('I0.0'), no('I0.1'), no('I0.2')], [no('Q0.0')]], [out('Q0.0')], ['0:0', '1:0']);

const EXAMPLES = {
  bos: { name: 'Boş program', prog: () => [newRung()] },
  seal: { name: '1) Start-Stop mühürleme', prog: () => [
    SEAL(),
    R('Konveyör çalışırken yeşil lamba', [[no('Q0.0')]], [out('Q0.3')]),
    R('Konveyör dururken kırmızı lamba', [[nc('Q0.0')]], [out('Q0.4')]),
  ] },
  feed: { name: '2) Zamanlayıcıyla kutu besleme', prog: () => [
    SEAL(),
    R('T0 kendini sıfırlayan zamanlayıcı: her 3 sn bir tarama boyunca 1 olur', [[no('Q0.0'), nc('T0'), { t: 'TON', a: 'T0', pt: 3 }]], [null]),
    R('T0 dolunca besleyiciye bir darbe → 1 kutu', [[no('T0')]], [out('Q0.2')]),
    R('Konveyörde kutu varken (giriş sensörü) sarı lamba 1 sn yanık kalsın', [[no('I0.3'), { t: 'TOF', a: 'T1', pt: 1 }]], [out('Q0.5')]),
    R('Yeşil lamba', [[no('Q0.0')]], [out('Q0.3')]),
    R('Kırmızı lamba', [[nc('Q0.0')]], [out('Q0.4')]),
  ] },
  sort: { name: '3) Uzun kutu ayırma + sayıcı', prog: () => [
    SEAL(),
    R('Her 3 sn bir kutu besle (T0 osilatör)', [[no('Q0.0'), nc('T0'), { t: 'TON', a: 'T0', pt: 3 }]], [null]),
    R('Besleyici darbesi', [[no('T0')]], [out('Q0.2')]),
    R('Yükseklik sensörü uzun kutu gördü → M0.1 hafızaya al', [[no('I0.4')]], [set('M0.1')]),
    R('Uzun kutu piston önüne geldi ve piston gerideyse → piston ileri', [[no('M0.1'), no('I0.5'), no('I0.7')]], [set('Q0.1')]),
    R('Piston ileri limite gelince geri çek, hafızayı sil', [[no('I0.6')], []], [rst('Q0.1'), rst('M0.1')], ['6:0']),
    R('Ayrılan kutuları say: 5 olunca sarı lamba', [[no('I0.6'), { t: 'CTU', a: 'C0', pv: 5 }]], [out('Q0.5')]),
    R('RESET butonu sayıcıyı sıfırlar', [[no('I1.0')]], [rst('C0')]),
    R('Yeşil lamba', [[no('Q0.0')]], [out('Q0.3')]),
    R('Kırmızı lamba', [[nc('Q0.0')]], [out('Q0.4')]),
    R('Acil stop basılıysa korna', [[nc('I0.2')]], [out('Q0.6')]),
  ] },
};

