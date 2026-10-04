/* Interface */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const f1 = v => (v == null || isNaN(v) ? '–' : v.toFixed(1).replace('.', ',') + '%');
const fN = v => Math.round(v).toLocaleString('pt-BR');
const fD = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
const cand = k => CANDIDATES[k] || { name: k, color: '#888', party: '' };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

const App = { avg: null, sim: null, fc: null, now: null, hist: [], lastPst: {}, charts: {}, sel: null, map: null, layer: null, geo: null, next: 0, filters: { states: { region: '', q: '', leader: '', sort: 'voters' }, polls: { inst: '', cand: 'all', from: '', to: '' } } };
const userPolls = () => store.get('userPolls', []);
const allPolls = () => POLLS.concat(userPolls());

/* ---------- dados derivados ---------- */
function recompute() {
  App.avg = Model.average(allPolls());
  App.sim = Model.simulate(App.avg, 12000);
  App.fc = Object.fromEntries(Model.states(App.avg).map(s => [s.uf, s.shares]));
  nowcast();
}
/* Projeção do resultado final: o que já foi apurado em cada estado + previsão para as urnas que faltam.
   A incerteza encolhe conforme a apuração avança. Sem apuração, equivale ao modelo de pesquisas. */
function nowcast(track) {
  let proj = App.avg, pst = 0;
  if (liveOn()) {
    const nat = Live.cache.national; pst = nat.pst || 0;
    const live = sh => { const o = {}; (sh.cands || []).forEach(c => o[c.key || c.name] = c.pct); return o; };
    const keys = [...new Set(Object.keys(live(nat)).concat(MAIN.filter(k => App.avg[k] > 0)))];
    const sts = STATES.filter(st => Live.cache.states[st.uf]), acc = {}; let W = 0;
    const mix = (lv, fc, p) => { const o = {}; keys.forEach(k => o[k] = (p * (lv[k] ?? 0) + (100 - p) * (fc[k] ?? lv[k] ?? 0)) / 100); return o; };
    if (sts.length >= 20) sts.forEach(st => { const d = Live.cache.states[st.uf], m = mix(live(d), App.fc[st.uf] || {}, d.pst || 0); keys.forEach(k => acc[k] = (acc[k] || 0) + m[k] * st.voters); W += st.voters; });
    else { Object.assign(acc, mix(live(nat), App.avg, pst)); W = 1; }
    const t = keys.reduce((a, k) => a + acc[k] / W, 0) || 1; proj = {}; keys.forEach(k => proj[k] = acc[k] / W / t * 100);
  }
  const sim = Model.simulate(proj, 6000, Math.max(0.05, 1 - pst / 100));
  App.now = { proj, sim, pst, live: liveOn(), mode: Live.status };
  if (track) { App.hist.push({ t: Date.now(), p: { ...sim.pWin }, pst }); if (App.hist.length > 80) App.hist.shift(); }
}
const liveOn = () => ['live', 'sim'].includes(Live.status) && Live.cache.national && Live.cache.national.cands.length;
function natNow() {
  if (liveOn() && Live.cache.national.pst > 0) { const o = {}; Live.cache.national.cands.forEach(c => o[c.key || c.name] = c.pct); return { shares: o, live: true, pst: Live.cache.national.pst }; }
  return { shares: App.avg, live: false, pst: 0 };
}
function stateNow(uf) {
  const d = Live.cache.states[uf];
  if (liveOn() && d && d.pst > 0) { const o = {}; d.cands.forEach(c => o[c.key || c.name] = c.pct); return { shares: o, live: true, pst: d.pst }; }
  return { shares: App.fc[uf], live: false, pst: 0 };
}
const ranked = sh => Object.entries(sh).sort((a, b) => b[1] - a[1]);
const leaderOf = sh => { const r = ranked(sh); return { key: r[0][0], pct: r[0][1], margin: r[0][1] - (r[1] ? r[1][1] : 0), second: r[1] }; };
const winner22 = st => st.l22 >= st.b22 ? 'lula' : 'flavio';

function destroy(id) { if (App.charts[id]) { App.charts[id].destroy(); delete App.charts[id]; } }
function chart(id, cfg) {
  destroy(id); const el = document.getElementById(id); if (!el || !window.Chart) return;
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
  Chart.defaults.color = dark ? '#93a0ba' : '#64708a'; Chart.defaults.borderColor = dark ? '#26324a' : '#e1e6ef';
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false }, cfg.options);
  App.charts[id] = new Chart(el, cfg);
}
const bars = (sh, keys, ci) => ranked(sh).filter(([k]) => !keys || keys.includes(k)).map(([k, v]) =>
  `<div class="bar"><span class="n"><i class="dot" style="background:${cand(k).color}"></i>${cand(k).name}</span><span class="t"><i style="width:${Math.min(100, v)}%;background:${cand(k).color}"></i><u style="left:50%"></u></span><span class="p">${f1(v)}</span></div>`).join('');

/* ---------- Visão geral ---------- */
function renderOverview() {
  const n = natNow(), L = leaderOf(n.shares);
  /* Durante a apuração as chances partem dos votos já contados, com incerteza que diminui conforme as urnas são apuradas. */
  if (!App.now) nowcast();
  const s = n.live ? App.now.sim : App.sim; /* mesmo cálculo do painel do mapa (nowcast) */
  const pw = ranked(s.pWin).filter(x => x[1] >= .05);
  const stLead = STATES.map(st => leaderOf(stateNow(st.uf).shares).key);
  const cnt = k => stLead.filter(x => x === k).length;
  const top2 = ranked(n.shares).slice(0, 2);
  $('#overview').innerHTML = `
  <div class="grid g2">
    <div class="card">
      <h2>${n.live ? 'Resultado da apuração (válidos)' : 'Média das pesquisas (votos válidos)'} ${Live.status === 'sim' ? '<span class="ft-sim">SIMULAÇÃO</span>' : ''}</h2>
      ${n.live ? `<div class="small muted">Urnas apuradas: <b>${f1(n.pst)}</b></div><div class="progress"><i style="width:${n.pst}%"></i></div>` : ''}
      ${bars(n.shares, MAIN.concat(Object.keys(n.shares).filter(k => !MAIN.includes(k))))}
      <p class="small muted">A linha vertical marca 50% – maioria dos válidos vence no 1º turno.</p>
    </div>
    <div class="grid g4" style="align-content:start">
      <div class="card kpi"><b style="color:${cand(L.key).color}">${cand(L.key).name}</b><span>Líder ${n.live ? 'na apuração' : 'nas pesquisas'}</span></div>
      <div class="card kpi"><b>${f1(L.margin).replace('%', ' p.p.')}</b><span>Vantagem sobre ${cand(top2[1][0]).name}</span></div>
      <div class="card kpi"><b>${f1(s.pRunoff)}</b><span>Chance de 2º turno</span></div>
      <div class="card kpi"><b>${f1(s.pWin.lula)}</b><span>Chance de Lula vencer a eleição</span></div>
      <div class="card kpi"><b>${cnt('lula')} × ${cnt('flavio')}</b><span>Estados: Lula × Flávio${n.live ? ' (líder atual)' : ' (projeção)'}</span></div>
      <div class="card kpi"><b>${f1(s.pWin.flavio)}</b><span>Chance de Flávio vencer a eleição</span></div>
      <div class="card kpi" style="grid-column:1/-1"><b style="font-size:1rem">${RUNOFF_POLLS.map(r => `${r.inst}: Lula ${f1(r.lula)} × Flávio ${f1(r.flavio)}`).join(' · ')}</b><span>Pesquisa de 2º turno mais recente (${fD(RUNOFF_POLLS[0].date)})</span></div>
    </div>
    <div class="card"><h2>Probabilidade de vencer a presidência</h2>${n.live ? '<p class="small muted">Votos já apurados em cada estado + previsão para as urnas restantes (o mesmo cálculo do painel do Mapa); o 2º turno usa a migração de votos da aba Previsões.</p>' : ''}<div class="chartbox" style="height:240px"><canvas id="chWin"></canvas></div></div>
    <div class="card"><h2>Evolução das pesquisas</h2><div class="chartbox" style="height:240px"><canvas id="chTrend"></canvas></div></div>
  </div>`;
  chart('chWin', { type: 'bar', data: { labels: pw.map(([k]) => cand(k).name), datasets: [{ data: pw.map(x => +x[1].toFixed(1)), backgroundColor: pw.map(([k]) => cand(k).color) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: 100, ticks: { callback: v => v + '%' } } } } });
  trendChart('chTrend', MAIN.slice(0, 4));
}
function trendChart(id, keys, polls) {
  polls = (polls || allPolls()).slice().sort((a, b) => a.date.localeCompare(b.date));
  const labels = [...new Set(polls.map(p => p.date))];
  chart(id, { type: 'line', data: { labels: labels.map(fD), datasets: keys.map(k => ({ label: cand(k).name, borderColor: cand(k).color, backgroundColor: cand(k).color, spanGaps: true, tension: .25, pointRadius: 4,
    data: labels.map(d => { const ps = polls.filter(p => p.date === d && p.v[k] != null); return ps.length ? +(ps.reduce((s, p) => s + p.v[k], 0) / ps.length).toFixed(1) : null; }) })) },
    options: { plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y}%` } } }, scales: { y: { ticks: { callback: v => v + '%' } } } } });
}

/* ---------- Mapa ---------- */
function layerValue(st) {
  const L = $('#mapLayer').value, ck = $('#mapCand').value, nowS = stateNow(st.uf).shares;
  if (L === 'forecast') { const l = leaderOf(App.fc[st.uf]); return { color: cand(l.key).color, op: .35 + Math.min(.6, l.margin / 30), tip: `Projeção: ${cand(l.key).name} +${l.margin.toFixed(1)}` }; }
  if (L === 'w22') { const w = winner22(st), m = Math.abs(st.l22 - st.b22); return { color: cand(w).color, op: .35 + Math.min(.6, m / 40), tip: `2022: ${cand(w).name} (Lula ${st.l22}% × Bolsonaro ${st.b22}%, aprox.)` }; }
  if (L === 'cand') { const v = nowS[ck] ?? 0, mx = Math.max(...STATES.map(s => stateNow(s.uf).shares[ck] ?? 0), 1); return { color: cand(ck).color, op: .12 + .83 * v / mx, tip: `${cand(ck).name}: ${f1(v)}` }; }
  if (L === 'apur') { const p = stateNow(st.uf).pst; return { color: '#0b6b3a', op: .1 + .85 * p / 100, tip: `Apurado: ${f1(p)}` }; }
  const l = leaderOf(nowS); return { color: cand(l.key).color, op: .35 + Math.min(.6, l.margin / 30), tip: `${cand(l.key).name} ${f1(l.pct)} (+${l.margin.toFixed(1)})` };
}
const stateByCode = c => STATES.find(s => String(s.code) === String(c));
function inFilter(st) { const r = $('#mapRegion').value, q = norm($('#mapSearch').value); return (!r || st.region === r) && (!q || norm(st.name).includes(q) || st.uf === q); }
function setupMapControls() {
  $('#mapLayer').innerHTML = [['leader', 'Líder atual'], ['forecast', 'Projeção final'], ['cand', 'Votos do candidato'], ['w22', 'Vencedor em 2022'], ['apur', 'Urnas apuradas']].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');
  $('#mapCand').innerHTML = MAIN.map(k => `<option value="${k}">${cand(k).name}</option>`).join('');
  $('#mapRegion').innerHTML += REGIONS.map(r => `<option>${r}</option>`).join('');
  $('#ufList').innerHTML = STATES.map(s => `<option value="${s.name}">`).join('');
  ['mapLayer', 'mapCand', 'mapRegion', 'mapStyle', 'mapHeight'].forEach(id => $('#' + id).addEventListener('change', renderMap));
  $('#mapSearch').addEventListener('input', () => { const st = STATES.find(s => norm(s.name) === norm($('#mapSearch').value)); if (st) selectState(st.uf); renderMap(); });
}
async function renderMap() {
  const style = $('#mapStyle').value, tab = $('#map').classList.contains('on');
  if (!App.geo && App.geo !== false) App.geo = (await Live.geo()) || false;
  const use3d = style === '3d' && Map3D.init($('#map3d'), uf => selectState(uf, true));
  const useGeo = !use3d && (style === 'geo' || style === '3d') && App.geo && window.L;
  $('#map3d').hidden = !use3d; $('#leaflet').hidden = !useGeo; $('#gridMap').hidden = use3d || useGeo;
  $('#mapHeightL').hidden = !use3d; $('#mapBox').classList.toggle('is3d', use3d);
  if (use3d) render3d();
  else if (useGeo) {
    if (!App.map) { App.map = L.map('leaflet', { zoomSnap: .25, attributionControl: false, minZoom: 3 }); }
    if (!App.layer) {
      App.layer = L.geoJSON(App.geo, { onEachFeature: (f, l) => l.on({ click: () => selectState(stateByCode(f.properties.codarea).uf) }) }).addTo(App.map);
      App.map.fitBounds(App.layer.getBounds());
    }
    App.layer.eachLayer(l => { const st = stateByCode(l.feature.properties.codarea); if (!st) return; const v = layerValue(st), on = inFilter(st);
      l.setStyle({ fillColor: v.color, fillOpacity: on ? v.op : .05, color: App.sel === st.uf ? '#000' : '#fff', weight: App.sel === st.uf ? 3 : 1 });
      l.bindTooltip(`<b>${st.name}</b><br>${v.tip}`, { sticky: true }); });
    if (tab) setTimeout(() => App.map.invalidateSize(), 50);
  } else {
    const g = $('#gridMap'); g.innerHTML = STATES.map(st => { const v = layerValue(st), on = inFilter(st);
      return `<button data-uf="${st.uf}" class="${on ? '' : 'dim'}" title="${st.name} – ${v.tip}" style="grid-column:${st.grid[0] + 1};grid-row:${st.grid[1] + 1};background:color-mix(in srgb,${v.color} ${Math.round(v.op * 100)}%,#8a94a8)${App.sel === st.uf ? ';outline:3px solid #000' : ''}">${st.uf}</button>`; }).join('');
    $$('#gridMap button').forEach(b => b.onclick = () => selectState(b.dataset.uf));
  }
  const L_ = $('#mapLayer').value, keys = L_ === 'cand' ? [] : MAIN.slice(0, 4);
  $('#mapCand').parentElement.style.opacity = L_ === 'cand' ? 1 : .4;
  $('#legend').innerHTML = L_ === 'cand' ? `<span><i style="background:${cand($('#mapCand').value).color}"></i>Mais escuro = maior % de ${cand($('#mapCand').value).name}</span>` :
    L_ === 'apur' ? '<span><i style="background:#0b6b3a"></i>Mais escuro = mais urnas apuradas</span>' : keys.map(k => `<span><i style="background:${cand(k).color}"></i>${cand(k).name}</span>`).join('') + '<span>Intensidade = margem</span>';
  if (use3d) $('#legend').innerHTML += `<span>Altura = ${heightName()}</span>`;
  if (style === '3d' && !use3d) $('#legend').innerHTML += '<br><small>3D indisponível neste navegador – exibindo mapa 2D.</small>';
  if (!App.geo && style !== 'grid') $('#legend').innerHTML += '<br><small>Malha do IBGE indisponível – exibindo cartograma.</small>';
  if (App.sel) renderStateCard(App.sel);
  renderProb();
}
function selectState(uf, from3d) { App.sel = uf; renderMap(); renderStateCard(uf); if (!from3d && Map3D.ok) { Map3D.focus(uf); $('#m3Rotate').classList.remove('on'); } if (from3d && innerWidth < 860) $('#stateCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

/* ---------- Mapa 3D ---------- */
const heightMode = () => { const h = $('#mapHeight').value; return h !== 'auto' ? h : liveOn() ? 'apur' : 'voters'; };
const heightName = () => ({ apur: 'votos já apurados', voters: 'tamanho do eleitorado', margin: 'margem do líder', cand: '% de ' + cand($('#mapCand').value).name })[heightMode()];
function render3d() {
  Map3D.build(App.geo || null);
  const H = heightMode(), ck = $('#mapCand').value, maxV = Math.max(...STATES.map(s => s.voters));
  const mxC = Math.max(1, ...STATES.map(s => stateNow(s.uf).shares[ck] ?? 0)), vals = {};
  Map3D.intensity = Live.status === 'live' || Live.status === 'sim' ? .9 : .3;
  STATES.forEach(st => {
    const n = stateNow(st.uf), l = leaderOf(n.shares), v = layerValue(st), d = Live.cache.states[st.uf];
    const h = H === 'apur' ? Math.sqrt(st.voters / maxV) * (n.pst / 100) : H === 'margin' ? Math.min(1, l.margin / 40) : H === 'cand' ? (n.shares[ck] ?? 0) / mxC : Math.sqrt(st.voters / maxV);
    const prev = App.lastPst[st.uf] ?? n.pst, grow = n.live ? n.pst - prev : 0; App.lastPst[st.uf] = n.pst;
    vals[st.uf] = { h, big: st.voters >= 2.5, color: v.color, op: v.op, dim: !inFilter(st), sel: App.sel === st.uf, label: `${cand(l.key).name.split(' ')[0]} ${f1(l.pct)}`, pulse: grow > 0 ? grow * st.voters * 2 : 0,
      tip: `<b>${st.name}</b><br>${v.tip}${n.live ? `<br>Apurado: ${f1(n.pst)}` : '<br><small>Projeção (sem apuração)</small>'}${d && d.ea ? `<br>Comparecimento: ${fN(d.ea)}` : ''}` };
  });
  Map3D.update(vals);
}

/* ---------- Painel de probabilidades (ao lado do mapa) ---------- */
function renderProb() {
  if (!App.now) nowcast();
  const N = App.now, s = N.sim, pw = ranked(s.pWin).filter(x => x[1] >= .5), proj = ranked(N.proj).filter(x => x[1] >= .3).slice(0, 6);
  const badge = N.mode === 'live' ? ['live', 'AO VIVO · TSE'] : N.mode === 'sim' ? ['sim', 'SIMULAÇÃO'] : ['proj', 'PROJEÇÃO · PESQUISAS'];
  const R = 26, C = 2 * Math.PI * R;
  const close = STATES.map(st => ({ st, l: leaderOf(stateNow(st.uf).shares) })).sort((a, b) => a.l.margin - b.l.margin).slice(0, 5);
  const top2 = pw.slice(0, 2), others = Math.max(0, 100 - top2.reduce((a, x) => a + x[1], 0));
  const pair = s.pairs[0];
  /* evolução da chance nesta sessão */
  const hs = App.hist.slice(-40), keys = [...new Set(top2.map(x => x[0]))];
  const spark = hs.length > 1 ? `<svg viewBox="0 0 200 50" preserveAspectRatio="none" class="pp-spark"><line x1="0" y1="25" x2="200" y2="25" />${keys.map(k => `<polyline style="stroke:${cand(k).color}" points="${hs.map((h, i) => `${(i / (hs.length - 1) * 200).toFixed(1)},${(50 - (h.p[k] || 0) / 2).toFixed(1)}`).join(' ')}"/>`).join('')}</svg>` : '<p class="small muted">O gráfico aparece após as próximas atualizações.</p>';
  $('#probPanel').innerHTML = `
    <div class="pp-head"><div><span class="pp-badge ${badge[0]}">${badge[1]}</span><h3>Probabilidades</h3></div>
      <div class="pp-ring" title="Urnas apuradas"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="bg"/><circle cx="32" cy="32" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - N.pst / 100)}"/></svg><b>${N.pst >= 99.95 ? '100%' : f1(N.pst)}</b><small>apurado</small></div></div>
    <div class="pp-lbl">Chance de vencer a eleição</div>
    <div class="pp-tug">${top2.map(([k, v], i) => `<i style="width:${v}%;background:${cand(k).color};order:${i ? 2 : 0}"></i>`).join('')}${others > .5 ? `<i style="width:${others}%;background:#5b667d;order:1"></i>` : ''}</div>
    <div class="pp-big">${top2.map(([k, v]) => `<div style="--c:${cand(k).color}"><b>${f1(v)}</b><span>${cand(k).name}</span></div>`).join('')}</div>
    <div class="pp-lbl">Resultado final projetado <small>(votos válidos · faixa de 90%)</small></div>
    ${proj.map(([k, v]) => { const ci = s.ci[k] || [v, v], sc = x => Math.min(100, x / 60 * 100); return `<div class="pp-row"><span>${cand(k).name}</span><span class="pp-ci"><em style="left:${sc(ci[0])}%;width:${Math.max(.8, sc(ci[1]) - sc(ci[0]))}%;background:${cand(k).color}"></em><i style="left:${sc(v)}%;background:${cand(k).color}"></i><u style="left:${sc(50)}%"></u></span><b>${f1(v)}</b></div>`; }).join('')}
    <div class="pp-stats"><div><b>${f1(s.pFirstRound)}</b><span>decide no 1º turno</span></div><div><b>${f1(s.pRunoff)}</b><span>vai a 2º turno</span></div>
      <div><b>${pair ? `${cand(pair.a).name.split(' ')[0]} × ${cand(pair.b).name.split(' ')[0]}` : '–'}</b><span>2º turno mais provável${pair ? ` (${f1(pair.p)})` : ''}</span></div></div>
    <div class="pp-lbl">Estados mais disputados</div>
    <div class="pp-close">${close.map(({ st, l }) => `<button data-uf="${st.uf}" style="--c:${cand(l.key).color}"><b>${st.uf}</b> ${cand(l.key).name.split(' ')[0]} +${l.margin.toFixed(1).replace('.', ',')}</button>`).join('')}</div>
    <div class="pp-lbl">Chance de vencer ao longo desta sessão</div>${spark}
    <p class="small muted">${N.live ? 'Une o que já foi apurado em cada estado à previsão para as urnas restantes; a incerteza cai à medida que a apuração avança.' : 'Antes da apuração, vem da média das pesquisas (6.000 simulações).'} Não é previsão oficial.</p>`;
  $$('#probPanel .pp-close button').forEach(b => b.onclick = () => selectState(b.dataset.uf));
}
function renderStateCard(uf) {
  const st = STATES.find(s => s.uf === uf), n = stateNow(uf), f = App.fc[uf], L = leaderOf(n.shares);
  const d = Live.cache.states[uf];
  $('#stateCard').innerHTML = `<h3>${st.name} (${st.uf})</h3><p class="small muted">${st.region} · ${st.voters.toLocaleString('pt-BR')} mi de eleitores (aprox.)</p>
    <p><span class="pill" style="--c:${cand(L.key).color}">${cand(L.key).name} lidera</span> <small>+${L.margin.toFixed(1)} p.p.</small></p>
    <div class="small muted">${n.live ? `Apuração: ${f1(n.pst)} das urnas` : 'Projeção (swing sobre 2022)'}</div>
    ${bars(n.shares, null)}
    ${n.live ? `<details><summary class="small">Projeção do modelo</summary>${bars(f)}</details>` : ''}
    <p class="small muted">2022 (1º turno, aprox.): Lula ${st.l22}% × Bolsonaro ${st.b22}%</p>
    ${d && d.ea ? `<p class="small muted">Comparecimento: ${fN(d.ea)}${d.vb ? ` · brancos ${fN(d.vb)}` : ''}${d.tvn ? ` · nulos ${fN(d.tvn)}` : ''}</p>` : ''}`;
}

/* ---------- Previsões ---------- */
function renderForecast() {
  const s = App.sim, keys = Object.keys(App.avg);
  $('#forecast').innerHTML = `
  <div class="grid g2">
    <div class="card"><h2>Votos válidos previstos – 1º turno</h2><p class="small muted">Média ponderada por data (meia-vida ${Model.halfLifeDays} dias) e tamanho da amostra. Barras = intervalo de 90%.</p><div class="chartbox"><canvas id="chFc"></canvas></div></div>
    <div class="card"><h2>Probabilidades (${fN(s.n)} simulações)</h2>
      <table><tr><th>Candidato</th><th class="r">Média</th><th class="r">1º no 1º turno</th><th class="r">Vence a eleição</th></tr>
      ${ranked(App.avg).map(([k, v]) => `<tr><td><i class="dot" style="background:${cand(k).color}"></i>${cand(k).name}</td><td class="r">${f1(v)}</td><td class="r">${f1(s.pFirst[k])}</td><td class="r"><b>${f1(s.pWin[k])}</b></td></tr>`).join('')}</table>
      <p><b>Chance de decidir no 1º turno:</b> ${f1(s.pFirstRound)} · <b>2º turno:</b> ${f1(s.pRunoff)}</p>
      <p class="small muted">Confrontos mais prováveis no 2º turno: ${s.pairs.slice(0, 3).map(p => `${cand(p.a).name} × ${cand(p.b).name} (${f1(p.p)})`).join(' · ') || '–'}</p></div>
    <div class="card"><h2>Hipóteses do 2º turno</h2><p class="small muted">Que % dos eleitores de cada candidato eliminado vota em Flávio Bolsonaro. Os valores iniciais vêm das pesquisas abaixo. Ajuste e veja o efeito.</p>
      ${['cury', 'caiado', 'renan', 'zema'].map(k => `<label class="small">${cand(k).name}: <b id="tv_${k}">${Model.transfer[k]}</b>% → Flávio<input type="range" min="0" max="100" step=".5" value="${Model.transfer[k]}" data-k="${k}"></label>`).join('')}
      <label class="small">Dos que não vão para Flávio, % que vota em Lula: <b id="tv_rest">${Model.restToLula}</b>% (o resto: branco, nulo ou abstenção)<input type="range" min="0" max="100" step="5" value="${Model.restToLula}" data-k="rest"></label>
      <label class="small">Ruído do 2º turno (p.p.): <b id="tv_noise">${Model.runoffNoise}</b><input type="range" min="0" max="5" step=".5" value="${Model.runoffNoise}" data-k="noise"></label>
      <p class="small muted">Fontes: ${Object.entries(RUNOFF_TRANSFER).map(([k, t]) => `${cand(k).name} ${Object.entries(t.by).map(([i, v]) => `${RUNOFF_SOURCES[i].inst} ${v}%`).join(', ')}`).join(' · ')}. ${Object.values(RUNOFF_SOURCES).map(r => `<a href="${r.src}" target="_blank" rel="noopener">${r.inst} ${fD(r.date)}</a>`).join(', ')}. As pesquisas não dizem quantos dos demais votam em Lula ou anulam; essa divisão é uma hipótese ajustável.</p></div>
    <div class="card"><h2>Projeção por estado</h2><div class="tw" style="max-height:340px;overflow:auto"><table><tr><th>UF</th><th>Líder</th><th class="r">Lula</th><th class="r">Flávio</th></tr>
      ${STATES.slice().sort((a, b) => b.voters - a.voters).map(st => { const sh = App.fc[st.uf], l = leaderOf(sh); return `<tr class="click" data-uf="${st.uf}"><td>${st.uf}</td><td><i class="dot" style="background:${cand(l.key).color}"></i>${cand(l.key).name}</td><td class="r">${f1(sh.lula)}</td><td class="r">${f1(sh.flavio)}</td></tr>`; }).join('')}</table></div></div>
  </div>
  <p class="small muted">Modelo estatístico simples e transparente — não é previsão oficial. Pesquisas erram; o erro histórico de institutos no Brasil costuma passar de 3 p.p. por candidato.</p>`;
  chart('chFc', { type: 'bar', data: { labels: keys.map(k => cand(k).name), datasets: [{ data: keys.map(k => +App.avg[k].toFixed(1)), backgroundColor: keys.map(k => cand(k).color) }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${f1(c.parsed.y)} (IC90: ${f1(s.ci[keys[c.dataIndex]][0])} – ${f1(s.ci[keys[c.dataIndex]][1])})` } } }, scales: { y: { ticks: { callback: v => v + '%' } } } } });
  $$('#forecast input[type=range]').forEach(r => r.oninput = () => { const k = r.dataset.k; if (k === 'noise') Model.runoffNoise = +r.value; else if (k === 'rest') Model.restToLula = +r.value; else Model.transfer[k] = +r.value; $('#tv_' + k).textContent = r.value; clearTimeout(App.t); App.t = setTimeout(() => { App.sim = Model.simulate(App.avg, 12000); renderForecast(); renderOverview(); }, 350); });
  $$('#forecast tr.click').forEach(r => r.onclick = () => { go('map'); selectState(r.dataset.uf); });
}

/* ---------- Pesquisas ---------- */
function renderPolls() {
  const F = App.filters.polls, all = allPolls().slice().sort((a, b) => b.date.localeCompare(a.date));
  const insts = [...new Set(all.map(p => p.inst))];
  const list = all.filter(p => (!F.inst || p.inst === F.inst) && (!F.from || p.date >= F.from) && (!F.to || p.date <= F.to) && (F.cand === 'all' || p.v[F.cand] != null));
  const ck = F.cand === 'all' ? MAIN.slice(0, 4) : [F.cand];
  $('#polls').innerHTML = `
  <div class="filters">
    <label>Instituto<select data-f="inst"><option value="">Todos</option>${insts.map(i => `<option ${F.inst === i ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
    <label>Candidato<select data-f="cand"><option value="all">Principais</option>${MAIN.map(k => `<option value="${k}" ${F.cand === k ? 'selected' : ''}>${cand(k).name}</option>`).join('')}</select></label>
    <label>De<input type="date" data-f="from" value="${F.from}"></label><label>Até<input type="date" data-f="to" value="${F.to}"></label>
    <button class="btn" id="csvPolls">Exportar CSV</button>
  </div>
  <div class="grid g2">
    <div class="card"><h2>Tendência</h2><div class="chartbox"><canvas id="chPolls"></canvas></div></div>
    <div class="card"><h2>Adicionar pesquisa</h2><form id="pollForm" class="grid" style="gap:8px">
      <input name="inst" placeholder="Instituto" required><input name="date" type="date" required><input name="n" type="number" placeholder="Amostra (ex.: 2000)">
      <label class="small"><input type="checkbox" name="valid" style="width:auto"> Percentuais já são de votos válidos</label>
      <div class="grid g4" style="gap:6px">${MAIN.map(k => `<input name="${k}" type="number" step=".1" min="0" max="100" placeholder="${cand(k).name} %">`).join('')}</div>
      <button class="btn">Adicionar (salvo neste navegador)</button></form></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>${list.length} pesquisa(s) · 1º turno estimulado</h2><div class="tw"><table><tr><th>Data</th><th>Instituto</th><th class="r">Amostra</th>${MAIN.map(k => `<th class="r">${cand(k).name.split(' ').pop()}</th>`).join('')}<th></th></tr>
    ${list.map(p => `<tr><td>${fD(p.date)}</td><td>${p.inst}${p.valid ? ' <small class="muted">(válidos)</small>' : ''}</td><td class="r">${p.n ? fN(p.n) : '–'}</td>${MAIN.map(k => `<td class="r">${p.v[k] == null ? '–' : f1(p.v[k])}</td>`).join('')}<td>${p.src ? `<a href="${p.src}" target="_blank" rel="noopener">fonte</a>` : p.user ? `<a href="#" data-del="${p.id}">remover</a>` : ''}</td></tr>`).join('')}</table></div></div>`;
  trendChart('chPolls', ck, list);
  $$('#polls [data-f]').forEach(e => e.onchange = () => { F[e.dataset.f] = e.value; renderPolls(); });
  $$('#polls [data-del]').forEach(a => a.onclick = ev => { ev.preventDefault(); store.set('userPolls', userPolls().filter(p => p.id !== a.dataset.del)); recompute(); renderAll(); });
  $('#pollForm').onsubmit = ev => { ev.preventDefault(); const d = new FormData(ev.target), v = {}; MAIN.forEach(k => v[k] = d.get(k) === '' ? null : +d.get(k));
    store.set('userPolls', userPolls().concat({ id: 'u' + Date.now(), inst: d.get('inst'), date: d.get('date'), n: +d.get('n') || 1000, valid: !!d.get('valid'), v, user: true })); recompute(); renderAll(); };
  $('#csvPolls').onclick = () => download('pesquisas.csv', ['data;instituto;amostra;' + MAIN.join(';')].concat(list.map(p => [p.date, p.inst, p.n, ...MAIN.map(k => p.v[k] ?? '')].join(';'))).join('\n'));
}
function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); }

/* ---------- Estados ---------- */
function renderStates() {
  const F = App.filters.states;
  let rows = STATES.map(st => { const n = stateNow(st.uf), l = leaderOf(n.shares); return { st, n, l }; })
    .filter(r => (!F.region || r.st.region === F.region) && (!F.q || norm(r.st.name).includes(norm(F.q)) || r.st.uf === norm(F.q)) && (!F.leader || r.l.key === F.leader));
  const S = { voters: r => -r.st.voters, name: r => r.st.name, margin: r => r.l.margin, lula: r => -(r.n.shares.lula || 0), flavio: r => -(r.n.shares.flavio || 0) };
  rows.sort((a, b) => { const x = S[F.sort](a), y = S[F.sort](b); return typeof x === 'string' ? x.localeCompare(y) : x - y; });
  $('#states').innerHTML = `<div class="filters">
    <label>Região<select data-f="region"><option value="">Todas</option>${REGIONS.map(r => `<option ${F.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <label>Líder<select data-f="leader"><option value="">Todos</option>${['lula', 'flavio'].map(k => `<option value="${k}" ${F.leader === k ? 'selected' : ''}>${cand(k).name}</option>`).join('')}</select></label>
    <label>Ordenar<select data-f="sort">${[['voters', 'Eleitorado'], ['name', 'Nome'], ['margin', 'Menor margem'], ['lula', 'Mais Lula'], ['flavio', 'Mais Flávio']].map(o => `<option value="${o[0]}" ${F.sort === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
    <label>Busca<input data-f="q" type="search" value="${F.q}" placeholder="Estado ou UF"></label><button class="btn" id="csvSt">Exportar CSV</button></div>
  <div class="card tw"><table><tr><th>UF</th><th>Estado</th><th>Região</th><th class="r">Eleitores (mi)</th><th>Líder</th><th class="r">Margem</th><th class="r">Lula</th><th class="r">Flávio</th><th class="r">Apurado</th><th>2022</th></tr>
  ${rows.map(({ st, n, l }) => `<tr class="click" data-uf="${st.uf}"><td><b>${st.uf}</b></td><td>${st.name}</td><td>${st.region}</td><td class="r">${st.voters.toLocaleString('pt-BR')}</td><td><i class="dot" style="background:${cand(l.key).color}"></i>${cand(l.key).name}</td><td class="r">${l.margin.toFixed(1)}</td><td class="r">${f1(n.shares.lula)}</td><td class="r">${f1(n.shares.flavio)}</td><td class="r">${n.live ? f1(n.pst) : '<span class="muted">projeção</span>'}</td><td><i class="dot" style="background:${cand(winner22(st)).color}"></i>${cand(winner22(st)).name}</td></tr>`).join('')}</table>
  <p class="small muted">${rows.length} estado(s). Eleitorado e resultados de 2022 aproximados; a coluna 2022 usa Lula × Bolsonaro no 1º turno.</p></div>`;
  $$('#states [data-f]').forEach(e => e.addEventListener(e.tagName === 'INPUT' ? 'input' : 'change', () => { F[e.dataset.f] = e.value; const p = e.selectionStart; renderStates(); if (e.tagName === 'INPUT') { const i = $('#states [data-f=q]'); i.focus(); i.setSelectionRange(p, p); } }));
  $$('#states tr.click').forEach(r => r.onclick = () => { go('map'); selectState(r.dataset.uf); });
  $('#csvSt').onclick = () => download('estados.csv', ['uf;estado;regiao;eleitores_mi;lider;margem;lula;flavio'].concat(rows.map(({ st, n, l }) => [st.uf, st.name, st.region, st.voters, cand(l.key).name, l.margin.toFixed(1), (n.shares.lula || 0).toFixed(1), (n.shares.flavio || 0).toFixed(1)].join(';'))).join('\n'));
}

/* ---------- Candidatos / Fontes ---------- */
function renderCands() {
  const n = natNow().shares;
  $('#cands').innerHTML = `<div class="cc">${Object.keys(CANDIDATES).filter(k => !CANDIDATES[k].hidden).map(k => { const c = CANDIDATES[k], inM = App.avg[k] != null; const won = STATES.filter(st => leaderOf(App.fc[st.uf]).key === k).length;
    return `<div class="card cand" style="--c:${c.color}"><span class="pill" style="--c:${c.color}">${c.party} · ${c.num}</span><h3>${c.name}</h3><p class="small muted">${c.role}</p>
      ${inM ? `<p>Atual: <b>${f1(n[k])}</b> · Média pesquisas: <b>${f1(App.avg[k])}</b><br>Vence a eleição: <b>${f1(App.sim.pWin[k])}</b> · Passa ao 2º turno: <b>${f1(App.sim.pFirst[k] + 0)}</b> (1º lugar)<br>Estados liderados (proj.): <b>${won}</b><br>IC90 1º turno: ${f1(App.sim.ci[k][0])} – ${f1(App.sim.ci[k][1])}</p>` : '<p class="muted">Sem pesquisas recentes incluídas no modelo.</p>'}</div>`; }).join('')}</div>`;
}
function renderAbout() {
  $('#about').innerHTML = `<div class="card"><h2>Fontes e metodologia</h2>
  <ul><li><b>Apuração:</b> arquivos JSON públicos do TSE (<code>resultados.tse.jus.br</code>), consultados pelo seu navegador a cada ${Live.cfg.every}s. O código da eleição de 2026 (6257 no 1º turno) é detectado automaticamente e pode ser trocado em ⚙. O modo <i>Replay 2022</i> usa o resultado oficial de 2022 para testar o painel.</li>
  <li><b>Mapa:</b> malha estadual do IBGE (API de malhas v3). Se indisponível, usa-se um cartograma.</li>
  <li><b>Pesquisas:</b> ${POLLS.map(p => `<a href="${p.src}" target="_blank" rel="noopener">${p.inst} ${fD(p.date)}</a>`).join(', ')}. Adicione novas na aba Pesquisas ou em <code>js/data.js</code>.</li>
  <li><b>Previsão nacional:</b> média ponderada (tempo e amostra), normalizada para votos válidos; 12.000 simulações Monte Carlo com erro compartilhado Lula/Flávio; 2º turno com migração configurável.</li>
  <li><b>Previsão estadual:</b> swing uniforme sobre o 1º turno de 2022 (valores aproximados).</li>
  <li><b>Limitações:</b> candidatos sem divulgação em um instituto são ignorados naquela pesquisa; eleitorado e resultados de 2022 por UF são aproximados; a candidatura de Pablo Marçal está sub judice e fora do modelo.</li></ul>
  <p class="small muted">Projeto independente, sem vínculo com o TSE ou institutos de pesquisa. Não use como fonte oficial de resultados.</p></div>`;
}

/* ---------- Ciclo de atualização ---------- */
function renderAll() { renderOverview(); renderForecast(); renderPolls(); renderStates(); renderCands(); renderAbout(); renderMap(); }
function updateChip() {
  const c = $('#liveChip'), b = $('#banner'); const t = { live: 'AO VIVO · TSE', sim: 'SIMULAÇÃO', unavailable: 'TSE indisponível', off: 'Somente pesquisas', idle: 'Conectando…' }[Live.status];
  c.className = 'chip' + (Live.status === 'live' || Live.status === 'sim' ? ' live' : ''); c.textContent = `${t}${Live.status !== 'off' ? ' · ' + Math.max(0, Math.round((App.next - Date.now()) / 1000)) + 's' : ''}`;
  b.hidden = Live.status === 'live' || Live.status === 'off'; b.className = 'banner' + (Live.status === 'sim' ? ' sim' : '');
  b.innerHTML = Live.status === 'sim' ? '⚠ <b>SIMULAÇÃO:</b> dados de apuração fictícios, gerados pelo modelo apenas para demonstração.' : Live.status === 'unavailable' ? 'Apuração do TSE ainda não acessível (não iniciada, endereço/código da eleição incorreto ou rede bloqueada). Exibindo média de pesquisas e previsão. Ajuste em ⚙.' : '';
  if (Live.cfg.mode === 'replay2022' && Live.status === 'live') { b.hidden = false; b.textContent = 'Modo Replay: exibindo o resultado oficial do 1º turno de 2022.'; }
}
async function refresh() {
  $('#btnRefresh').style.opacity = .5;
  await Live.fetchNational(); await Live.fetchStates(); nowcast(true);
  App.next = Date.now() + Live.cfg.every * 1000; updateChip(); renderAll(); $('#btnRefresh').style.opacity = 1;
}
function go(tab) { $$('.tab').forEach(t => t.classList.toggle('on', t.id === tab)); $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); if (tab === 'map') renderMap(); location.hash = tab; scrollTo(0, 0); }

$$('#tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
$('#m3Rotate').onclick = e => { if (!Map3D.ok) return; Map3D.controls.autoRotate = !Map3D.controls.autoRotate; e.target.classList.toggle('on', Map3D.controls.autoRotate); };
$('#m3Home').onclick = () => { if (!Map3D.ok) return; Map3D.home(); Map3D.controls.autoRotate = true; $('#m3Rotate').classList.add('on'); };
$('#map3d').addEventListener('pointerdown', () => $('#m3Rotate').classList.remove('on'));
$('#m3Full').onclick = () => { const b = $('#mapBox'); document.fullscreenElement ? document.exitFullscreen() : b.requestFullscreen && b.requestFullscreen(); };
$('#btnRefresh').onclick = refresh;
$('#btnTheme').onclick = () => { const d = document.documentElement, dark = d.dataset.theme === 'dark' || (!d.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches); d.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', d.dataset.theme); renderAll(); };
$('#btnSettings').onclick = () => { $('#setMode').value = Live.cfg.mode; $('#setCycle').value = Live.cfg.cycle; $('#setCode').value = Live.cfg.code; $('#setEvery').value = Live.cfg.every; $('#settings').showModal(); };
$('#setSave').onclick = () => { Object.assign(Live.cfg, { mode: $('#setMode').value, cycle: $('#setCycle').value.trim() || 'ele2026', code: $('#setCode').value.trim(), every: Math.max(10, +$('#setEvery').value || 30) }); Live.save(); Live.cache = { national: null, states: {} }; Live.simP = 0; Live.status = 'idle'; refresh(); };
const th = store.get('theme', null); if (th) document.documentElement.dataset.theme = th;
setupMapControls(); recompute(); renderAll();
if (location.hash && $(location.hash)) go(location.hash.slice(1));
refresh(); setInterval(() => { updateChip(); if (Date.now() >= App.next) refresh(); }, 1000);
