// Yazıların içindeki canlı ladder bileşenleri. engine.js'ten sonra yüklenir.
{
const CW = 104, RH = 76, LEFT = 26, TOP = 42, PWR = '#16a34a', OFF = '#5b6b7a', INK = '#1c2833';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderRung(rung, res, st) {
  const rows = rung.cells.length;
  let lastCol = 0; for (let r = 0; r < rows; r++) for (let c = 0; c < L; c++) if (rung.cells[r][c]) lastCol = Math.max(lastCol, c);
  const Lv = Math.min(L, lastCol + 2), W = LEFT + (Lv + 1) * CW + 30, H = TOP + (rows - 1) * RH + 40;
  const yc = r => TOP + r * RH, N = res.N, info = res.info, pc = on => on ? PWR : OFF, RX = LEFT + (Lv + 1) * CW;
  const used = (r, c) => { const [a, b] = wireRange(rung, r); return rung.cells[r][c] || (c >= a && c < b); };
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" style="max-width:${W}px;display:block">`;
  s += `<line x1="${LEFT}" y1="8" x2="${LEFT}" y2="${H - 8}" stroke="${PWR}" stroke-width="4"/>`;
  s += `<line x1="${RX}" y1="8" x2="${RX}" y2="${H - 8}" stroke="${OFF}" stroke-width="4"/>`;
  for (let r = 0; r < rows; r++) {
    const y = yc(r);
    for (let c = 0; c < Lv; c++) {
      const x = LEFT + c * CW, cell = rung.cells[r][c], inf = info[r][c], pin = inf.pin, pout = inf.out;
      if (!cell) { if (used(r, c)) s += `<line x1="${x}" y1="${y}" x2="${x + CW}" y2="${y}" stroke="${pc(pin)}" stroke-width="2.5"/>`; continue; }
      if (cell.t === 'W') { s += `<line x1="${x}" y1="${y}" x2="${x + CW}" y2="${y}" stroke="${pc(pin)}" stroke-width="2.5"/>`; continue; }
      if (CONTACTS.includes(cell.t)) {
        const cl = inf.closed, bc = cl ? PWR : INK;
        s += `<line x1="${x}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="${pc(pin)}" stroke-width="2.5"/>`;
        s += `<line x1="${x + 64}" y1="${y}" x2="${x + CW}" y2="${y}" stroke="${pc(pout)}" stroke-width="2.5"/>`;
        if (cl) s += `<rect x="${x + 40}" y="${y - 13}" width="24" height="26" fill="#bbf7d0"/>`;
        s += `<line x1="${x + 40}" y1="${y - 14}" x2="${x + 40}" y2="${y + 14}" stroke="${bc}" stroke-width="3"/><line x1="${x + 64}" y1="${y - 14}" x2="${x + 64}" y2="${y + 14}" stroke="${bc}" stroke-width="3"/>`;
        if (cell.t === 'NC') s += `<line x1="${x + 44}" y1="${y + 12}" x2="${x + 60}" y2="${y - 12}" stroke="${bc}" stroke-width="2"/>`;
        s += `<text x="${x + 52}" y="${y - 22}" font-size="13" font-weight="700" text-anchor="middle" fill="${INK}">${esc(cell.a)}</text>`;
        s += `<text x="${x + 52}" y="${y + 30}" font-size="11" text-anchor="middle" fill="#5b6b7a">${esc(SYM[cell.a] || '')}</text>`;
      } else if (BLOCKS.includes(cell.t)) {
        s += `<line x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${pc(pin)}" stroke-width="2.5"/><line x1="${x + 90}" y1="${y}" x2="${x + CW}" y2="${y}" stroke="${pc(pout)}" stroke-width="2.5"/>`;
        s += `<rect x="${x + 14}" y="${y - 28}" width="76" height="58" fill="${pout ? '#dcfce7' : '#fff'}" stroke="${pout ? PWR : INK}" stroke-width="1.6" rx="3"/>`;
        s += `<text x="${x + 52}" y="${y - 31}" font-size="12" font-weight="700" text-anchor="middle" fill="${INK}">${esc(cell.a)}</text><text x="${x + 52}" y="${y - 10}" font-size="12" font-weight="700" text-anchor="middle" fill="#1d4ed8">${cell.t}</text>`;
        const t0 = st.T[cell.a] || { et: 0 };
        s += `<text x="${x + 52}" y="${y + 8}" font-size="11" text-anchor="middle" fill="${INK}">PT ${(+cell.pt).toFixed(1)} s</text><text x="${x + 52}" y="${y + 23}" font-size="11" text-anchor="middle" fill="#b45309">ET ${(t0.et / 1000).toFixed(1)} s</text>`;
      }
    }
    const x = LEFT + Lv * CW, coil = rung.coils[r], pin = N[r][L];
    if (coil) {
      const on = coil.t === 'OUT' ? pin : readBit(st, coil.a), cc = on ? PWR : INK;
      s += `<line x1="${x}" y1="${y}" x2="${x + 38}" y2="${y}" stroke="${pc(pin)}" stroke-width="2.5"/><line x1="${x + 66}" y1="${y}" x2="${RX}" y2="${y}" stroke="${OFF}" stroke-width="2.5"/>`;
      if (on) s += `<circle cx="${x + 52}" cy="${y}" r="13" fill="#bbf7d0"/>`;
      s += `<path d="M${x + 44} ${y - 14} Q${x + 34} ${y} ${x + 44} ${y + 14}" fill="none" stroke="${cc}" stroke-width="2.5"/><path d="M${x + 60} ${y - 14} Q${x + 70} ${y} ${x + 60} ${y + 14}" fill="none" stroke="${cc}" stroke-width="2.5"/>`;
      if (coil.t !== 'OUT') s += `<text x="${x + 52}" y="${y + 5}" font-size="13" font-weight="700" text-anchor="middle" fill="${cc}">${coil.t}</text>`;
      s += `<text x="${x + 52}" y="${y - 22}" font-size="13" font-weight="700" text-anchor="middle" fill="${INK}">${esc(coil.a)}</text><text x="${x + 52}" y="${y + 30}" font-size="11" text-anchor="middle" fill="#5b6b7a">${esc(SYM[coil.a] || '')}</text>`;
    }
  }
  for (let r = 0; r < rows - 1; r++) for (let k = 0; k <= L; k++) if (hasLink(rung, k, r)) {
    if (k > Lv && k < L) continue;
    const x = LEFT + (k === L ? Lv : k) * CW; s += `<line x1="${x}" y1="${yc(r)}" x2="${x}" y2="${yc(r + 1)}" stroke="${pc(N[r][k])}" stroke-width="2.5"/>`;
  }
  return s + '</svg>';
}
window.renderRung = renderRung;

const MOTOR = on => `<svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true"><rect x="6" y="18" width="50" height="44" rx="8" fill="${on ? '#16a34a' : '#64748b'}"/><rect x="56" y="34" width="10" height="12" fill="#94a3b8"/><g class="${on ? 'spin' : ''}" style="transform-origin:70px 40px"><rect x="68" y="22" width="4" height="36" rx="2" fill="#334155"/></g><text x="31" y="45" font-size="12" font-weight="700" text-anchor="middle" fill="#fff">M</text></svg>`;

// Canlı devre: butonlar + motor/lamba + ladder
window.liveRung = function (el, cfg) {
  const ctl = {}; (cfg.controls || []).forEach(c => ctl[c.id] = !!c.init);
  const st = newState(); let res = [];
  const rungs = cfg.rungs();
  el.classList.add('live');
  el.innerHTML = `<div class="live-side"><div class="ctls"></div><div class="outs"></div></div><div class="live-main"><div class="figs"></div><div class="chips"></div>${cfg.hint ? `<p class="hint">${cfg.hint}</p>` : ''}</div>`;
  const ctlEl = el.querySelector('.ctls'), outEl = el.querySelector('.outs'), figEl = el.querySelector('.figs'), chipEl = el.querySelector('.chips');
  (cfg.controls || []).forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pbtn ' + (c.color || 'g') + (c.kind === 'toggle' ? ' tog' : '');
    b.innerHTML = `<span class="cap"></span><span>${c.label}</span>`;
    if (c.kind === 'toggle') b.onclick = () => { ctl[c.id] = !ctl[c.id]; };
    else {
      const dn = e => { e.preventDefault(); ctl[c.id] = true; b.classList.add('down'); }, up = () => { ctl[c.id] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') dn(e); }); b.addEventListener('keyup', up);
    }
    b._c = c; ctlEl.appendChild(b);
  });
  function tick() {
    Object.assign(st.bits, cfg.map(ctl));
    res = rungs.map((r, i) => evalRung(r, st, 0.05, i));
  }
  function draw() {
    figEl.innerHTML = rungs.map((r, i) => `<div class="fig">${renderRung(r, res[i], st)}</div>`).join('');
    outEl.innerHTML = (cfg.outputs || []).map(o => {
      const on = readBit(st, o.addr);
      return o.kind === 'motor' ? `<div class="out">${MOTOR(on)}<b class="${on ? 'on' : 'off'}">${on ? 'BANT DÖNÜYOR' : 'BANT DURUYOR'}</b><small>${o.addr}</small></div>`
        : `<div class="out"><span class="lamp" style="--c:${o.color}${on ? ';opacity:1;box-shadow:0 0 18px ' + o.color : ''}"></span><b>${o.label}</b><small>${o.addr}</small></div>`;
    }).join('');
    ctlEl.querySelectorAll('.tog').forEach(b => b.classList.toggle('down', ctl[b._c.id]));
    chipEl.innerHTML = (cfg.watch || []).map(a => { const v = readBit(st, a); return `<span class="chip ${v ? 'c1' : 'c0'}">${a} ${SYM[a] ? SYM[a] + ' ' : ''}= ${v ? 1 : 0}</span>`; }).join('');
  }
  tick(); draw();
  setInterval(() => { tick(); draw(); }, 80);
};

// Tarama adımlayıcı: her tıklamada bir tarama
window.scanStepper = function (el, cfg) {
  let i = -1, st = newState(); const rung = cfg.rung();
  el.classList.add('stepper');
  el.innerHTML = `<div class="sbar"><button type="button" class="btn" data-a="next">Sonraki tarama ▶</button><button type="button" class="btn ghost" data-a="reset">Baştan</button><span class="snum"></span></div><p class="stext"></p><div class="fig sfig"></div><table class="stbl"><tr><th>Tarama</th><th>Ne yaptın</th><th>I0.0</th><th>I0.1</th><th>Q0.0</th></tr>${cfg.seq.map((s, k) => `<tr data-k="${k}"><td>${k + 1}</td><td>${s.label}</td><td>${s.bits['I0.0'] ? 1 : 0}</td><td>${s.bits['I0.1'] ? 1 : 0}</td><td class="q">?</td></tr>`).join('')}</table>`;
  const fig = el.querySelector('.sfig'), txt = el.querySelector('.stext'), num = el.querySelector('.snum');
  function show() {
    if (i < 0) { st = newState(); Object.assign(st.bits, { 'I0.1': true, 'I0.2': true }); fig.innerHTML = renderRung(rung, evalRungDry(), st); txt.innerHTML = cfg.intro; num.textContent = ''; }
    el.querySelectorAll('tr[data-k]').forEach(tr => { const k = +tr.dataset.k; tr.classList.toggle('cur', k === i); if (k > i) tr.querySelector('.q').textContent = '?'; });
  }
  function evalRungDry() { const s2 = JSON.parse(JSON.stringify(st)); return evalRung(rung, s2, 0.05, 0); }
  el.addEventListener('click', e => {
    const a = e.target.closest('button') && e.target.closest('button').dataset.a; if (!a) return;
    if (a === 'reset') { i = -1; show(); return; }
    if (i >= cfg.seq.length - 1) return;
    i++; const s = cfg.seq[i];
    Object.assign(st.bits, s.bits, { 'I0.2': true });
    const r = evalRung(rung, st, 0.05, 0);
    fig.innerHTML = renderRung(rung, r, st); txt.innerHTML = `<b>Tarama ${i + 1}:</b> ${s.text}`; num.textContent = `${i + 1} / ${cfg.seq.length}`;
    const q = readBit(st, 'Q0.0'), cell = el.querySelector(`tr[data-k="${i}"] .q`); cell.textContent = q ? 1 : 0; cell.className = 'q ' + (q ? 'on' : 'off');
    show();
  });
  show();
};
}
