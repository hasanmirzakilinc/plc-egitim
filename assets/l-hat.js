// L konveyör + döner platform + asansör: ladder programları, saha modeli, 3D çizim.
// engine.js ve live.js'ten sonra yüklenir.
{
Object.assign(SYM, {
  'I0.0': 'START', 'I0.1': 'STOP', 'I0.2': 'ACIL STOP', 'I0.3': 'SENSOR 1', 'I0.4': 'SENSOR 2', 'I0.5': 'SENSOR 3',
  'I0.6': 'PLAT. LIM.', 'I0.7': 'ASANS. LIM.', 'I1.0': 'PLAT. DÖN.',
  'Q1.0': 'KONVEYOR 1', 'Q1.1': 'KONVEYOR 2', 'Q1.2': 'PLAT. ILERI', 'Q1.3': 'PLAT. DÖNDÜR', 'Q1.4': 'ASANS. ILERI', 'Q1.5': 'ASANS. YUKARI'
});

// ---------- LADDER PROGRAMLARI ----------
const NO = a => ({ t: 'NO', a }), NC = a => ({ t: 'NC', a }), NE = a => ({ t: 'N', a });
const OUT = a => ({ t: 'OUT', a }), SET = a => ({ t: 'S', a }), RST = a => ({ t: 'R', a });
function rung(comment, rows, coils, links) {
  const r = newRung(comment);
  r.cells = rows.map(row => { const a = Array(L).fill(null); row.forEach((c, i) => { if (c) a[i] = c; }); return a; });
  r.coils = rows.map((_, i) => coils[i] || null);
  r.links = links || [];
  return r;
}
function lhatProgram(fixed) {
  const p = [
    rung('Network 1: Mühürleme. START ile Konveyör 1 çalışır, kendini tutar.',
      [[NO('I0.0'), NO('I0.1'), NO('I0.2')], [NO('Q1.0')]], [OUT('Q1.0')], ['0:0', '1:0']),
    rung('Network 2: Sensör 1 görünce ya da dönüş bitince platform ileri. Limit sensörü veya Konveyör 2 çalışırken durur.',
      [[NO('I0.3'), NC('I0.6'), NO('I0.1'), NC('Q1.1')], [NO('Q1.2')], [NO('I1.0')]], [OUT('Q1.2')], ['0:0', '0:1', '1:0', '1:1']),
  ];
  if (fixed) {
    p.push(rung('Network 3a: Limit sensörü ürünü görünce dönüşü SET et.', [[NO('I0.6')]], [SET('Q1.3')]));
    p.push(rung('Network 3b: Ürün Sensör 2\'nin önünden tamamen çıkınca (düşen kenar) dönüşü RESET et.', [[NE('I0.4')]], [RST('Q1.3')]));
  } else {
    p.push(rung('Network 3: Limit sensörü veya Sensör 2 görürken platformu döndür (ilk hâli).',
      [[NO('I0.6')], [NO('I0.4')]], [OUT('Q1.3')], ['0:0', '1:0']));
  }
  p.push(rung('Network 4: Sensör 2 görünce Konveyör 2 çalışır, asansör limitine kadar devam eder.',
    [[NO('I0.4'), NO('I0.1'), NC('I0.7')], [NO('Q1.1')]], [OUT('Q1.1')], ['0:0', '1:0']));
  p.push(rung('Network 5: Sensör 3 görünce asansör konveyörü çalışır, asansör limitinde durur.',
    [[NO('I0.5'), NC('I0.7'), NO('I0.1')], [NO('Q1.4')]], [OUT('Q1.4')], ['0:0', '1:0']));
  p.push(rung('Network 6: Asansör limiti görünce asansör yukarı.', [[NO('I0.7')]], [OUT('Q1.5')]));
  return p;
}

// ---------- SAHA MODELİ ----------
// Ürünlerin hepsi tek bir yol koordinatı (p, metre) üzerinde ilerler:
// Konveyör 1: 0–5.4 | Platform: 5.4–6.5 (merkez 5.95) | Konveyör 2: 6.5–11.95 | Asansör: 11.95–13.05
const K1E = 5.4, PC = 5.95, PE = 6.5, K2E = 11.95, EE = 13.05;
const HL = 0.3, HW = 0.21, GAP = 0.06, V = 0.9, ROT = 90 / 1.4, LIFT_V = 0.8, LIFT_MAX = 2.4, BELT_Y = 0.8;
function lhatScene() { return { items: [], ang: 0, lift: 0, ph: { k1: 0, k2: 0, p: 0, e: 0 }, delivered: 0, id: 1, feedT: 0 }; }
function seg(p) { return p < K1E ? 'K1' : p < PE ? 'P' : p < K2E ? 'K2' : 'E'; }
function addItem(sc) {
  if (sc.items.some(it => it.st === 'belt' && it.p < 0.35 + 2 * HL + GAP)) return false;
  sc.items.push({ id: sc.id++, p: 0.35, st: 'belt', topT: 0, t: 0, hue: sc.id % 3 });
  return true;
}
function pose(it, sc) {
  if (it.st === 'up') return { x: EE - PC + it.t * 0.9, y: BELT_Y + LIFT_MAX, z: 0, r: Math.PI / 2 };
  const s = seg(it.p);
  if (s === 'K1') return { x: 0, y: BELT_Y, z: it.p - PC, r: 0 };
  if (s === 'P') { const a = sc.ang * Math.PI / 180, l = it.p - PC; return { x: l * Math.sin(a), y: BELT_Y, z: l * Math.cos(a), r: a }; }
  if (s === 'K2') return { x: it.p - PC, y: BELT_Y, z: 0, r: Math.PI / 2 };
  return { x: it.p - PC, y: BELT_Y + sc.lift, z: 0, r: Math.PI / 2 };
}
function covers(it, sc, px, pz) {
  const q = pose(it, sc), dx = px - q.x, dz = pz - q.z;
  const u = dx * Math.sin(q.r) + dz * Math.cos(q.r), v = dx * Math.cos(q.r) - dz * Math.sin(q.r);
  return Math.abs(u) <= HL && Math.abs(v) <= HW;
}
const LIM_Z = 0.25; // sabit platform limit sensörü ışını: z = 0.25, x boyunca
function lhatInputs(sc) {
  const belt = sc.items.filter(it => it.st === 'belt');
  const on = (sg, lo, hi) => belt.some(it => seg(it.p) === sg && it.p >= lo && it.p <= hi);
  let lim = false;
  for (const it of belt) if (seg(it.p) === 'P') for (let x = -0.55; x <= 0.55 && !lim; x += 0.02) if (covers(it, sc, x, LIM_Z)) lim = true;
  return {
    'I0.3': on('K1', 5.1 - HL, 5.1 + HL),
    'I0.6': lim,
    'I1.0': sc.ang >= 89,
    'I0.4': on('K2', PC + 0.9 - HL, PC + 0.9 + HL),
    'I0.5': on('K2', PC + 5.6 - HL, PC + 5.6 + HL),
    'I0.7': belt.some(it => seg(it.p) === 'E' && it.p >= PC + 6.65),
  };
}
function lhatStep(sc, out, dt) {
  sc.ang = Math.max(0, Math.min(90, sc.ang + (out['Q1.3'] ? 1 : -1) * ROT * dt));
  sc.lift = Math.max(0, Math.min(LIFT_MAX, sc.lift + (out['Q1.5'] ? 1 : -1) * LIFT_V * dt));
  for (const [k, q] of [['k1', 'Q1.0'], ['k2', 'Q1.1'], ['p', 'Q1.2'], ['e', 'Q1.4']]) if (out[q]) sc.ph[k] += V * dt;
  const belt = sc.items.filter(it => it.st === 'belt').sort((a, b) => b.p - a.p);
  for (let i = 0; i < belt.length; i++) {
    const it = belt[i], s = seg(it.p);
    // ürünün altındaki bantlardan biri dönüyorsa ürün ilerler
    const segDrive = g => g === 'K1' ? out['Q1.0'] : g === 'P' ? (out['Q1.2'] && (sc.ang <= 1 || sc.ang >= 89)) : g === 'K2' ? out['Q1.1'] : (out['Q1.4'] && sc.lift <= 0.02);
    const under = new Set([seg(it.p - HL + 0.02), s, seg(it.p + HL - 0.02)]);
    let drive = false; for (const g of under) if (segDrive(g)) drive = true;
    if (s === 'P' && sc.ang > 1 && sc.ang < 89) drive = false;      // dönerken taşıma yok
    if (s === 'E' && sc.lift > 0.02) drive = false;                  // asansör kalkıkken taşıma yok
    let np = it.p + (drive ? V * dt : 0);
    if (s === 'K1' && sc.ang > 1) np = Math.min(np, Math.max(it.p, K1E - HL));           // platform hizalı değilse ürünün ucu platforma girmez
    if (s === 'P' && sc.ang <= 1) np = Math.min(np, PC + 0.25);                          // platformun karşı kenarında stoper
    if (s === 'P' && sc.ang < 89 && np >= PE) np = Math.min(np, PE - 0.001);
    if (s === 'K2' && sc.lift > 0.02) np = Math.min(np, Math.max(it.p, K2E - HL));       // asansör aşağıda değilse bekle
    if (s === 'E') np = Math.min(np, EE - 0.33);                                          // asansör stoperi
    const ahead = belt[i - 1];
    if (ahead) np = Math.min(np, ahead.p - 2 * HL - GAP);
    if (np > it.p) it.p = np;
    if (seg(it.p) === 'E' && sc.lift >= LIFT_MAX - 0.01) { it.topT += dt; if (it.topT > 1) { it.st = 'up'; it.t = 0; } }
  }
  for (const it of sc.items) if (it.st === 'up') { it.t += dt; if (it.t > 1.6) { it.st = 'gone'; sc.delivered++; } }
  sc.items = sc.items.filter(it => it.st !== 'gone');
}
window.LHAT = { lhatProgram, lhatScene, lhatInputs, lhatStep, addItem, pose, seg };

// ---------- 3D ÇİZİM (izometrik, kendi küçük motorumuz) ----------
function makeView(cv) {
  const ctx = cv.getContext('2d');
  const view = { yaw: -0.62, pitch: 0.62, S: 60, cx: 0, cy: 0, w: 0, h: 0 };
  const CX = 3.2, CZ = -2.2;
  function resize() {
    const d = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    view.w = r.width; view.h = r.height; cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    view.S = Math.min(view.w / (view.w < 560 ? 10.2 : 12.5), view.h / 7.2); view.small = view.w < 560; view.cx = view.w / 2; view.cy = view.h * 0.56;
  }
  function P(x, y, z) {
    x -= CX; z -= CZ;
    const c = Math.cos(view.yaw), s = Math.sin(view.yaw), xr = x * c - z * s, zr = x * s + z * c;
    return { X: view.cx + xr * view.S, Y: view.cy + (zr * Math.sin(view.pitch) - y * Math.cos(view.pitch)) * view.S, d: zr * Math.cos(view.pitch) + y * Math.sin(view.pitch) };
  }
  function visible(n) {
    const c = Math.cos(view.yaw), s = Math.sin(view.yaw), nz = n[0] * s + n[2] * c;
    return n[1] * Math.sin(view.pitch) + nz * Math.cos(view.pitch) > 1e-6;
  }
  const LIGHT = (() => { const v = [0.45, 0.8, 0.35], m = Math.hypot(...v); return v.map(a => a / m); })();
  function shade(hex, n) {
    const k = 0.55 + 0.45 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  }
  // kutu: merkez, yarı boyutlar, y ekseni etrafında dönüş
  function box(cx, cy, cz, hx, hy, hz, rot, color, opts) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const W = (lx, ly, lz) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
    const N = (lx, lz) => [lx * c + lz * s, 0, -lx * s + lz * c];
    const v = [W(-hx, -hy, -hz), W(hx, -hy, -hz), W(hx, -hy, hz), W(-hx, -hy, hz), W(-hx, hy, -hz), W(hx, hy, -hz), W(hx, hy, hz), W(-hx, hy, hz)];
    const faces = [
      { i: [4, 5, 6, 7], n: [0, 1, 0], top: true }, { i: [0, 3, 2, 1], n: [0, -1, 0] },
      { i: [3, 7, 6, 2], n: N(0, 1) }, { i: [0, 1, 5, 4], n: N(0, -1) },
      { i: [1, 2, 6, 5], n: N(1, 0) }, { i: [0, 4, 7, 3], n: N(-1, 0) },
    ];
    return { d: P(cx, cy, cz).d, draw() {
      for (const f of faces) {
        if (!visible(f.n)) continue;
        const pts = f.i.map(k => P(...v[k]));
        ctx.beginPath(); pts.forEach((q, j) => j ? ctx.lineTo(q.X, q.Y) : ctx.moveTo(q.X, q.Y)); ctx.closePath();
        ctx.fillStyle = shade(color, f.n); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 0.6; ctx.stroke();
        if (f.top && opts && opts.onTop) opts.onTop(W);
      }
    } };
  }
  function prism(cx, cy, cz, r, hy, sides, color) {
    const top = [], bot = [];
    for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2; top.push([cx + r * Math.cos(a), cy + hy, cz + r * Math.sin(a)]); bot.push([cx + r * Math.cos(a), cy - hy, cz + r * Math.sin(a)]); }
    return { d: P(cx, cy, cz).d - 0.5, draw() {
      for (let k = 0; k < sides; k++) {
        const a = (k + 0.5) / sides * Math.PI * 2, n = [Math.cos(a), 0, Math.sin(a)];
        if (!visible(n)) continue;
        const q = [bot[k], bot[(k + 1) % sides], top[(k + 1) % sides], top[k]].map(p => P(...p));
        ctx.beginPath(); q.forEach((p, j) => j ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y)); ctx.closePath();
        ctx.fillStyle = shade(color, n); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.stroke();
      }
      const q = top.map(p => P(...p));
      ctx.beginPath(); q.forEach((p, j) => j ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y)); ctx.closePath();
      ctx.fillStyle = shade(color, [0, 1, 0]); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
    } };
  }
  function line(a, b, color, w, dash) {
    const p = P(...a), q = P(...b);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(p.X, p.Y); ctx.lineTo(q.X, q.Y); ctx.stroke(); ctx.restore();
  }
  function label(x, y, z, text, color, bg) {
    const p = P(x, y, z);
    ctx.font = (view.small ? '600 10px' : '600 12px') + ' Inter, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = bg || 'rgba(15,23,42,.82)'; ctx.beginPath();
    const hh = view.small ? 16 : 20; ctx.roundRect ? ctx.roundRect(p.X - w / 2, p.Y - hh / 2, w, hh, 5) : ctx.rect(p.X - w / 2, p.Y - hh / 2, w, hh); ctx.fill();
    ctx.fillStyle = color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, p.X, p.Y);
  }
  function rollers(W, hx, hz, along, phase, n, color) {
    // along='z' → rulolar x yönünde çizgi, z boyunca dizili
    const step = (2 * (along === 'z' ? hz : hx)) / n, off = (phase % step + step) % step;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    for (let t = -(along === 'z' ? hz : hx) + off; t < (along === 'z' ? hz : hx); t += step) {
      const a = along === 'z' ? W(-hx * 0.92, 0.001, t) : W(t, 0.001, -hz * 0.92), b = along === 'z' ? W(hx * 0.92, 0.001, t) : W(t, 0.001, hz * 0.92);
      const p = P(...a), q = P(...b); ctx.beginPath(); ctx.moveTo(p.X, p.Y); ctx.lineTo(q.X, q.Y); ctx.stroke();
    }
    ctx.restore();
  }

  function render(sc, ins, out, running) {
    const dark = matchMedia && matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = dark ? '#1b2130' : '#e9edf3'; ctx.fillRect(0, 0, view.w, view.h);
    // zemin ızgarası
    for (let x = -2; x <= 10; x++) line([x, 0, -7], [x, 0, 2.5], dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)', 1);
    for (let z = -7; z <= 2.5; z++) line([-2, 0, z], [10, 0, z], dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)', 1);
    const BED = '#7b8794', BED_ON = '#4f9d69', base = [], top = [];
    // ayaklar
    for (const z of [-5.5, -3.5, -1.4]) for (const x of [-0.42, 0.42]) base.push(box(x, 0.33, z, 0.05, 0.33, 0.05, 0, '#5b6470'));
    for (const x of [1.3, 3.3, 5.3]) for (const z of [-0.42, 0.42]) base.push(box(x, 0.33, z, 0.05, 0.33, 0.05, 0, '#5b6470'));
    // Konveyör 1 (z boyunca)
    base.push(box(0, 0.72, -3.27, 0.5, 0.08, 2.67, 0, out['Q1.0'] ? BED_ON : BED, { onTop: W => rollers(W, 0.5, 2.67, 'z', sc.ph.k1, 30, 'rgba(0,0,0,.35)') }));
    // Konveyör 2 (x boyunca)
    base.push(box(3.275, 0.72, 0, 2.725, 0.08, 0.5, 0, out['Q1.1'] ? BED_ON : BED, { onTop: W => rollers(W, 2.725, 0.5, 'x', -sc.ph.k2, 30, 'rgba(0,0,0,.35)') }));
    // Döner platform gövdesi
    base.push(prism(0, 0.33, 0, 0.78, 0.33, 20, '#64748b'));
    for (const o of base.sort((a, b) => a.d - b.d)) o.draw();
    // döner tabla
    const a = sc.ang * Math.PI / 180;
    top.push(Object.assign(box(0, 0.73, 0, 0.55, 0.07, 0.55, a, out['Q1.2'] ? BED_ON : '#94a3b8', { onTop: W => rollers(W, 0.55, 0.55, 'z', sc.ph.p, 7, 'rgba(0,0,0,.4)') }), { d: P(0, 0.73, 0).d - 0.3 }));
    // asansör: direkler, kabin, üst kat
    for (const [x, z] of [[6.0, -0.62], [7.1, -0.62], [6.0, 0.62], [7.1, 0.62]]) top.push(box(x, 1.75, z, 0.06, 1.75, 0.06, 0, '#475569'));
    top.push(box(6.55, 3.52, -0.62, 0.61, 0.04, 0.05, 0, '#475569'));
    top.push(box(6.55, 3.52, 0.62, 0.61, 0.04, 0.05, 0, '#475569'));
    top.push(box(6.55, 0.72 + sc.lift, 0, 0.55, 0.08, 0.55, 0, out['Q1.4'] ? BED_ON : '#d97706', { onTop: W => rollers(W, 0.55, 0.55, 'x', -sc.ph.e, 7, 'rgba(0,0,0,.35)') }));
    top.push(box(7.9, 3.12, 0, 0.75, 0.08, 0.6, 0, '#8b95a3'));
    top.push(box(7.9, 1.55, -0.5, 0.05, 1.55, 0.05, 0, '#5b6470'), box(7.9, 1.55, 0.5, 0.05, 1.55, 0.05, 0, '#5b6470'));
    // ürünler
    const COLS = ['#c98a4b', '#2aa7a0', '#c2410c'];
    for (const it of sc.items) {
      const q = pose(it, sc);
      top.push(box(q.x, q.y + 0.2, q.z, HW, 0.2, HL, q.r, COLS[it.hue], {
        onTop: W => { const p1 = P(...W(0, 0.001, -HL * 0.85)), p2 = P(...W(0, 0.001, HL * 0.85)); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p1.X, p1.Y); ctx.lineTo(p2.X, p2.Y); ctx.stroke(); ctx.restore(); }
      }));
    }
    // sensör direkleri
    const sensors = [
      { k: 'I0.3', a: [-0.62, 1.0, -0.85], b: [0.62, 1.0, -0.85] },
      { k: 'I0.6', a: [-0.68, 1.0, LIM_Z], b: [0.68, 1.0, LIM_Z] },
      { k: 'I0.4', a: [0.9, 1.0, -0.62], b: [0.9, 1.0, 0.62] },
      { k: 'I0.5', a: [5.6, 1.0, -0.62], b: [5.6, 1.0, 0.62] },
    ];
    for (const s of sensors) { top.push(box(s.a[0], 0.55, s.a[2], 0.05, 0.55, 0.05, 0, '#334155')); top.push(box(s.b[0], 0.55, s.b[2], 0.05, 0.55, 0.05, 0, '#334155')); }
    for (const o of top.sort((a, b) => a.d - b.d)) o.draw();
    // ışınlar
    for (const s of sensors) line(s.a, s.b, ins[s.k] ? '#ef4444' : 'rgba(34,197,94,.75)', ins[s.k] ? 3 : 1.6, ins[s.k] ? null : [5, 4]);
    // asansör limit (kabin üstünde)
    line([6.95, 0.95 + sc.lift, -0.55], [6.95, 0.95 + sc.lift, 0.55], ins['I0.7'] ? '#ef4444' : 'rgba(34,197,94,.75)', ins['I0.7'] ? 3 : 1.6, ins['I0.7'] ? null : [5, 4]);
    // etiketler
    const L1 = (x, y, z, t, on) => label(x, y, z, t, on ? '#052e16' : '#fff', on ? '#4ade80' : 'rgba(15,23,42,.82)');
    L1(0, 1.45, -0.85, 'S1 I0.3', ins['I0.3']);
    L1(-1.05, 1.15, LIM_Z, 'Limit I0.6', ins['I0.6']);
    L1(0.9, 1.45, -0.75, 'S2 I0.4', ins['I0.4']);
    L1(5.6, 1.45, -0.75, 'S3 I0.5', ins['I0.5']);
    L1(6.95, 1.45 + sc.lift, -0.9, 'Lim I0.7', ins['I0.7']);
    L1(-0.9, 0.9, 0.75, 'Dönüş I1.0', ins['I1.0']);
    label(0.75, 0.75, -4.6, 'Konveyör 1 · Q1.0', '#fff', out['Q1.0'] ? '#15803d' : 'rgba(71,85,105,.9)');
    label(3.3, 0.75, 0.9, 'Konveyör 2 · Q1.1', '#fff', out['Q1.1'] ? '#15803d' : 'rgba(71,85,105,.9)');
    label(-0.2, 0.35, 1.15, 'Platform · Q1.2 / Q1.3', '#fff', out['Q1.2'] || out['Q1.3'] ? '#15803d' : 'rgba(71,85,105,.9)');
    label(6.3, 4.0, -0.9, 'Asansör · Q1.4 / Q1.5', '#fff', out['Q1.4'] || out['Q1.5'] ? '#15803d' : 'rgba(71,85,105,.9)');
    label(8.0, 3.25, -0.4, `Üst kat: ${sc.delivered}`, '#fff', '#1240e0');
    if (!running) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, view.w, view.h); }
  }
  return { view, resize, render };
}

// ---------- SAYFA BİLEŞENİ ----------
window.lhatWidget = function (root) {
  root.innerHTML = `
  <div class="lh-sim">
    <div class="lh-bar">
      <div class="lh-speed" role="group" aria-label="Simülasyon hızı">
        <span>Hız:</span>
        <button type="button" data-sp="1" class="on">Normal</button>
        <button type="button" data-sp="0.5">½ yavaş</button>
        <button type="button" data-sp="0.25">¼ yavaş</button>
        <button type="button" data-sp="0.1">Çok yavaş</button>
        <button type="button" data-sp="0" class="lh-pause">Durdur</button>
      </div>
      <span class="lh-hint">Sürükleyerek açıyı çevir</span>
    </div>
    <canvas class="lh-cv" aria-label="L konveyör hattının 3D simülasyonu"></canvas>
    <div class="lh-panel">
      <div class="ctls"></div>
      <div class="lh-btns">
        <button type="button" class="btn ghost" data-a="add">+ Ürün ekle</button>
        <label class="lh-auto"><input type="checkbox" checked> Otomatik besleme</label>
        <button type="button" class="btn ghost" data-a="reset">Sahneyi sıfırla</button>
        <button type="button" class="btn ghost" data-a="view">Açıyı sıfırla</button>
      </div>
    </div>
    <div class="chips lh-chips"></div>
  </div>
  <div class="lh-lad"><div class="lh-ladh">Canlı ladder <small>enerji akan yer yeşil</small></div><div class="lh-figs"></div></div>`;
  const cv = root.querySelector('.lh-cv'), V3 = makeView(cv);
  let prog = lhatProgram(true), st = newState(), sc = lhatScene(), res = [], ins = {}, out = {}, speed = 1;
  const ctl = { s: false, p: false, e: false };
  addItem(sc);
  const ctlEl = root.querySelector('.ctls');
  [['s', 'START', 'g'], ['p', 'STOP', 'r'], ['e', 'ACİL STOP', 'y', true]].forEach(([id, label, color, tog]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pbtn ' + color; b.innerHTML = `<span class="cap"></span><span>${label}</span>`;
    if (tog) b.onclick = () => { ctl[id] = !ctl[id]; b.classList.toggle('down', ctl[id]); };
    else {
      const dn = e => { e.preventDefault(); ctl[id] = true; b.classList.add('down'); }, up = () => { ctl[id] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') dn(e); }); b.addEventListener('keyup', up);
    }
    ctlEl.appendChild(b);
  });
  const auto = root.querySelector('.lh-auto input');
  function setSpeed(v) {
    speed = v;
    root.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === v));
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp != null) setSpeed(+b.dataset.sp);
    if (b.dataset.a === 'add') addItem(sc);
    if (b.dataset.a === 'reset') { st = newState(); sc = lhatScene(); addItem(sc); }
    if (b.dataset.a === 'view') { V3.view.yaw = -0.62; }
  });
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = e.clientX; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (drag != null) { V3.view.yaw += (e.clientX - drag) * 0.008; drag = e.clientX; } });
  cv.addEventListener('pointerup', () => { drag = null; });
  const ro = new ResizeObserver(() => V3.resize()); ro.observe(cv);
  const DT = 0.05;
  // Yavaş çekim: her gerçek adımda bir tarama yapılır, ama simülasyon zamanı hız kadar ilerler.
  // Böylece yavaşta da hareket akıcı olur, durdurulmuşken de butonlar ladder'da görünür.
  function scan(dt) {
    ins = lhatInputs(sc);
    Object.assign(st.bits, ins, { 'I0.0': ctl.s, 'I0.1': !ctl.p, 'I0.2': !ctl.e });
    res = prog.map((r, i) => evalRung(r, st, dt, i));
    out = {}; for (const k in st.bits) if (k[0] === 'Q') out[k] = st.bits[k];
    lhatStep(sc, out, dt);
    if (auto.checked && out['Q1.0']) { sc.feedT += dt; if (sc.feedT > 7) { if (addItem(sc)) sc.feedT = 0; } }
  }
  function tick() { scan(DT * speed); }
  const figs = root.querySelector('.lh-figs'), chips = root.querySelector('.lh-chips');
  const W = ['I0.3', 'I0.6', 'I1.0', 'I0.4', 'I0.5', 'I0.7', 'Q1.0', 'Q1.2', 'Q1.3', 'Q1.1', 'Q1.4', 'Q1.5'];
  function drawLadder() {
    figs.innerHTML = prog.map((r, i) => `<p class="lh-cmt">${r.comment}</p><div class="fig">${renderRung(r, res[i], st)}</div>`).join('');
    chips.innerHTML = W.map(a => { const v = readBit(st, a); return `<span class="chip ${v ? 'c1' : 'c0'}">${a} ${SYM[a]} = ${v ? 1 : 0}</span>`; }).join('');
  }
  tick(); V3.resize(); drawLadder();
  let n = 0;
  setInterval(() => { tick(); if (++n % 3 === 0) drawLadder(); }, DT * 1000);
  (function loop() { V3.render(sc, ins, out, true); requestAnimationFrame(loop); })();
  return { get sc() { return sc; }, get st() { return st; }, setSpeed, ctl };
};
}
