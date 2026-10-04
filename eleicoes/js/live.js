/* Dados ao vivo: TSE (apuração) e IBGE (malha). Tudo roda no navegador do visitante. */
const Live = {
  TSE: 'https://resultados.tse.jus.br/oficial',
  probe: ['9240', '9238', '9244', '9560', '9564', '544'],  /* códigos candidatos; defina o correto em ⚙ */
  cfg: Object.assign({ mode: 'auto', cycle: 'ele2026', code: '', every: 30 }, (() => { try { return JSON.parse(localStorage.getItem('cfg') || '{}'); } catch (e) { return {}; } })()),
  cache: { national: null, states: {} },
  status: 'idle', simP: 0, simSeed: null,
  save() { try { localStorage.setItem('cfg', JSON.stringify(this.cfg)); } catch (e) {} },

  url(uf) {
    let { cycle, code } = this.cfg; if (this.cfg.mode === 'replay2022') { cycle = 'ele2022'; code = '544'; }
    const c = String(code).padStart(6, '0'); uf = uf.toLowerCase();
    return `${this.TSE}/${cycle}/${code}/dados-simplificados/${uf}/${uf}-c0001-e${c}-r.json`;
  },
  num: v => parseFloat(String(v ?? '0').replace(/\./g, '').replace(',', '.')) || 0,
  pct: v => parseFloat(String(v ?? '0').replace(',', '.')) || 0,
  parse(j) {
    const agr = (((j.carg || [])[0] || {}).agr || [])[0] || {};
    const list = agr.cand || j.cand || [];
    const cands = list.map(c => ({ n: c.n, name: c.nm, key: candKey(c.nm), votes: this.num(c.vap), pct: this.pct(c.pvap), elected: c.e === 's' }));
    return { pst: this.pct(j.pst), ea: this.num(j.ea), pea: this.pct(j.pea), esi: this.num(j.esi), vb: this.num(j.vb), tvn: this.num(j.tvn), vv: this.num(j.vv), cands, ts: j.dg ? `${j.dg} ${j.hg || ''}` : null, raw: j };
  },
  async get(uf) {
    const r = await fetch(this.url(uf), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    return this.parse(await r.json());
  },
  async fetchNational() {
    if (this.cfg.mode === 'off') { this.status = 'off'; return null; }
    if (this.cfg.mode === 'sim') return this.sim();
    const tries = this.cfg.mode === 'auto' && !this.cfg.code ? this.probe : [this.cfg.code];
    const keep = this.cfg.code;
    for (const code of tries) {
      if (this.cfg.mode === 'auto') this.cfg.code = code;
      try { const d = await this.get('br'); this.cache.national = d; this.status = 'live'; if (this.cfg.mode === 'auto' && !keep) this.save(); return d; } catch (e) {}
    }
    if (this.cfg.mode === 'auto') this.cfg.code = keep;
    this.status = 'unavailable'; return null;
  },
  async fetchStates() {
    if (this.status !== 'live') return;
    const q = STATES.map(s => s.uf); const run = async () => { while (q.length) { const uf = q.shift(); try { this.cache.states[uf] = await this.get(uf); } catch (e) {} } };
    await Promise.all(Array.from({ length: 9 }, run));
  },

  /* ---- simulação de apuração (demonstração, claramente rotulada na interface) ---- */
  sim() {
    this.simP = Math.min(100, this.simP + 2 + Math.random() * 4);
    const avg = Model.average(POLLS); const st = Model.states(avg);
    const p = this.simP / 100, noise = (1 - p) * 4;
    const mk = (shares, voters) => {
      const sh = {}; let t = 0; for (const k of MAIN) { sh[k] = Math.max(.1, shares[k] + (Math.random() - .5) * noise); t += sh[k]; }
      const cands = MAIN.map(k => ({ key: k, name: CANDIDATES[k].name, pct: sh[k] / t * 100, votes: Math.round(sh[k] / t * 100 * voters * 0.78 * p * 1e4) }));
      return { pst: this.simP, cands, ea: Math.round(voters * 1e6 * p), sim: true };
    };
    this.cache.national = mk(avg, 156); STATES.forEach((s, i) => { this.cache.states[s.uf] = mk(st[i].shares, s.voters); });
    this.status = 'sim'; return this.cache.national;
  },

  /* ---- malha IBGE ---- */
  async geo() {
    if (this._geo) return this._geo;
    try {
      const r = await fetch('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF');
      if (!r.ok) throw 0; this._geo = await r.json();
    } catch (e) { this._geo = null; }
    return this._geo;
  },
};
