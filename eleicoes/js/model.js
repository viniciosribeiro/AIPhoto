/* Modelo de previsão: média ponderada de pesquisas + Monte Carlo + projeção por estado (swing sobre 2022). */
const Model = {
  halfLifeDays: 14,
  /* % de eleitores de cada candidato eliminado que migra para Flávio no 2º turno (restante → Lula) */
  transfer: { cury: 50, caiado: 70, renan: 60, zema: 75, marcal: 65 },
  runoffNoise: 1.5,

  average(polls, opts = {}) {
    const now = opts.now || new Date('2026-10-04');
    const keys = opts.keys || MAIN;
    const acc = {}, wsum = {};
    for (const p of polls) {
      const age = Math.max(0, (now - new Date(p.date)) / 864e5);
      const w = Math.pow(0.5, age / this.halfLifeDays) * Math.sqrt((p.n || 1000) / 1000);
      const present = keys.filter(k => p.v[k] != null);
      const tot = present.reduce((s, k) => s + p.v[k], 0) || 1;
      for (const k of present) {
        const share = p.valid ? p.v[k] : p.v[k] / tot * 100; /* normaliza p/ votos válidos entre os listados */
        acc[k] = (acc[k] || 0) + share * w; wsum[k] = (wsum[k] || 0) + w;
      }
    }
    const raw = {}; keys.forEach(k => raw[k] = wsum[k] ? acc[k] / wsum[k] : 0);
    const t = keys.reduce((s, k) => s + raw[k], 0) || 1;
    const out = {}; keys.forEach(k => out[k] = raw[k] / t * 100);
    return out;
  },

  randn() { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },

  /* scale encolhe a incerteza do 1º turno (1 = pesquisas; perto de 0 = apuração quase completa) */
  simulate(avg, n = 20000, scale = 1) {
    const keys = Object.keys(avg);
    const res = { n, first: {}, win: {}, runoff: 0, firstRound: 0, pairs: {}, dist: {} };
    keys.forEach(k => { res.first[k] = 0; res.win[k] = 0; res.dist[k] = []; });
    for (let i = 0; i < n; i++) {
      const shock = this.randn() * 2.2 * scale;
      let s = {};
      keys.forEach(k => { s[k] = Math.max(0.1, avg[k] + this.randn() * (0.7 + 0.035 * avg[k]) * scale); });
      if (s.lula != null && s.flavio != null) { s.lula += shock; s.flavio -= shock * 0.8; }
      const t = keys.reduce((a, k) => a + s[k], 0); keys.forEach(k => s[k] = s[k] / t * 100);
      keys.forEach(k => res.dist[k].push(s[k]));
      const rank = keys.slice().sort((a, b) => s[b] - s[a]);
      res.first[rank[0]]++;
      if (s[rank[0]] > 50) { res.firstRound++; res.win[rank[0]]++; continue; }
      res.runoff++;
      const [a, b] = rank; const pk = a + '|' + b; res.pairs[pk] = (res.pairs[pk] || 0) + 1;
      const r = this.runoffShares(s, a, b);
      const A = r[0] + this.randn() * this.runoffNoise;
      res.win[A > 50 ? a : b]++;
    }
    const pct = o => { const r = {}; for (const k in o) r[k] = o[k] / n * 100; return r; };
    res.pFirst = pct(res.first); res.pWin = pct(res.win); res.pRunoff = res.runoff / n * 100; res.pFirstRound = res.firstRound / n * 100;
    res.pairs = Object.entries(res.pairs).map(([k, c]) => ({ a: k.split('|')[0], b: k.split('|')[1], p: c / n * 100 })).sort((x, y) => y.p - x.p);
    res.ci = {}; keys.forEach(k => { const d = res.dist[k].sort((x, y) => x - y); res.ci[k] = [d[Math.floor(n * .05)], d[Math.floor(n * .95)]]; delete res.dist[k]; });
    return res;
  },
  /* participação de a e b no 2º turno (% dos válidos), redistribuindo os eliminados */
  runoffShares(s, a, b) {
    let A = s[a], B = s[b];
    for (const k in s) { if (k === a || k === b) continue;
      const toFlavio = (this.transfer[k] ?? 55) / 100;
      /* quem vai para "direita" (Flávio) ou "esquerda/centro" (Lula) conforme o lado do finalista */
      const rightIsA = a === 'flavio', rightIsB = b === 'flavio';
      if (rightIsA) { A += s[k] * toFlavio; B += s[k] * (1 - toFlavio); }
      else if (rightIsB) { B += s[k] * toFlavio; A += s[k] * (1 - toFlavio); }
      else { A += s[k] / 2; B += s[k] / 2; }
    }
    const t = A + B; return [A / t * 100, B / t * 100];
  },

  /* projeção estadual: swing uniforme aditivo sobre 2022 (Lula e Flávio); demais dividem o restante na proporção nacional */
  states(avg) {
    const l0 = 48.43, b0 = 43.2;
    const others = Object.keys(avg).filter(k => k !== 'lula' && k !== 'flavio');
    const osum = others.reduce((s, k) => s + avg[k], 0) || 1;
    return STATES.map(st => {
      let l = Math.max(2, st.l22 + (avg.lula - l0)), f = Math.max(2, st.b22 + (avg.flavio - b0));
      const rest = Math.max(1, 100 - l - f); const o = {};
      others.forEach(k => o[k] = rest * avg[k] / osum);
      const t = l + f + rest; const shares = { lula: l / t * 100, flavio: f / t * 100 };
      others.forEach(k => shares[k] = o[k] / t * 100);
      return { uf: st.uf, shares };
    });
  },
};
