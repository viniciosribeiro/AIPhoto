/* Mapa 3D imersivo (Three.js): cada estado vira um bloco extrudado. Altura = métrica escolhida, cor = camada do mapa.
   Pulsos e partículas sobem dos estados cuja apuração avançou desde a última atualização. */
const Map3D = {
  ok: null, meshes: [], byUf: {}, labels: {}, focusT: null, hover: null, spawnQ: [], intensity: .3,

  init(el, onPick) {
    if (this.ok !== null) return this.ok;
    this.ok = false;
    if (!window.THREE || !THREE.OrbitControls) return false;
    try { this.renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return false; }
    const T = THREE, r = this.renderer;
    this.el = el; this.onPick = onPick;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setClearColor(0x050a14);
    el.appendChild(r.domElement);
    this.scene = new T.Scene(); this.scene.fog = new T.FogExp2(0x050a14, .006);
    this.camera = new T.PerspectiveCamera(42, 1, .1, 3000);
    const c = this.controls = new T.OrbitControls(this.camera, r.domElement);
    Object.assign(c, { enableDamping: true, dampingFactor: .08, autoRotate: true, autoRotateSpeed: .5, maxPolarAngle: 1.38, minDistance: 12, maxDistance: 180 });
    this.home();

    this.scene.add(new T.HemisphereLight(0x9fc3ff, 0x0a0f1d, .75));
    const sun = new T.DirectionalLight(0xffffff, .85); sun.position.set(-30, 90, 50); this.scene.add(sun);
    const rim = new T.DirectionalLight(0x3aa0ff, .35); rim.position.set(40, 20, -60); this.scene.add(rim);

    /* chão: brilho radial + grade + estrelas */
    const glow = document.createElement('canvas'); glow.width = glow.height = 256;
    const g = glow.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(40,120,255,.35)'); grd.addColorStop(.5, 'rgba(10,107,58,.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const floor = new T.Mesh(new T.PlaneGeometry(150, 150), new T.MeshBasicMaterial({ map: new T.CanvasTexture(glow), transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.05; this.scene.add(floor);
    const grid = new T.GridHelper(200, 80, 0x1d4a7a, 0x0d2238); grid.position.y = -.1; grid.material.transparent = true; grid.material.opacity = .45; this.scene.add(grid);
    const sp = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) { const v = new T.Vector3().randomDirection().multiplyScalar(400 + Math.random() * 500); v.y = Math.abs(v.y) * .8 + 20; sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    this.scene.add(new T.Points(sg, new T.PointsMaterial({ color: 0xbcd4ff, size: 1.6, transparent: true, opacity: .7, fog: false })));

    /* mapa no plano XY com extrusão em +Z; girado para deitar no chão */
    this.group = new T.Group(); this.group.rotation.x = -Math.PI / 2; this.scene.add(this.group); this.group.updateMatrixWorld(true);

    /* partículas de "votos" */
    const N = this.PN = 1400;
    this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3); this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N); this.pMax = new Float32Array(N); this.pBase = new Float32Array(N * 3);
    const pg = this.pGeo = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(this.pPos, 3)); pg.setAttribute('color', new T.BufferAttribute(this.pCol, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 64; const d = dot.getContext('2d'), dg = d.createRadialGradient(32, 32, 0, 32, 32, 32);
    dg.addColorStop(0, 'rgba(255,255,255,1)'); dg.addColorStop(.35, 'rgba(255,255,255,.6)'); dg.addColorStop(1, 'rgba(255,255,255,0)'); d.fillStyle = dg; d.fillRect(0, 0, 64, 64);
    const pts = new T.Points(pg, new T.PointsMaterial({ size: .9, map: new T.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    pts.frustumCulled = false; this.scene.add(pts); this.pNext = 0;

    this.labelsEl = document.createElement('div'); this.labelsEl.className = 'm3-labels'; el.appendChild(this.labelsEl);
    this.tip = document.createElement('div'); this.tip.className = 'm3-tip'; this.tip.hidden = true; el.appendChild(this.tip);

    this.ray = new T.Raycaster(); this.mouse = new T.Vector2(); let down = null;
    const pick = ev => { const b = r.domElement.getBoundingClientRect(); this.mouse.set((ev.clientX - b.left) / b.width * 2 - 1, -(ev.clientY - b.top) / b.height * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.camera); const h = this.ray.intersectObjects(this.meshes, false)[0]; return { m: h && h.object, x: ev.clientX - b.left, y: ev.clientY - b.top }; };
    r.domElement.addEventListener('pointermove', ev => { const p = pick(ev); this.hover = p.m || null;
      if (p.m && p.m.userData.tip) { this.tip.hidden = false; this.tip.innerHTML = p.m.userData.tip; this.tip.style.transform = `translate(${Math.min(p.x + 14, this.el.clientWidth - 230)}px,${p.y + 14}px)`; } else this.tip.hidden = true;
      r.domElement.style.cursor = p.m ? 'pointer' : 'grab'; });
    r.domElement.addEventListener('pointerleave', () => { this.hover = null; this.tip.hidden = true; });
    r.domElement.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; this.controls.autoRotate = false; this.focusT = this.camT = null; });
    r.domElement.addEventListener('pointerup', ev => { if (down && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) < 6) { const p = pick(ev); if (p.m) this.onPick(p.m.userData.uf); } down = null; });
    new ResizeObserver(() => this.resize()).observe(el); this.resize();
    this.clock = new T.Clock(); const loop = () => { requestAnimationFrame(loop); this.frame(); }; loop();
    return this.ok = true;
  },

  home() { this.camera.position.set(0, 44, 40); this.controls.target.set(0, 0, 2); this.focusT = this.camT = null; },
  resize() { const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.fov = w / h < 1 ? 50 : 42; this.camera.updateProjectionMatrix(); },

  /* geo: GeoJSON do IBGE (properties.codarea) ou null → cartograma em blocos */
  build(geo) {
    const T = THREE, key = geo ? 'geo' : 'grid'; if (this.built === key) return; this.built = key;
    this.meshes.forEach(m => { this.group.remove(m); m.geometry.dispose(); }); this.meshes = []; this.byUf = {};
    const add = (st, geom, cx, cy) => {
      const m = new T.Mesh(geom, new T.MeshStandardMaterial({ color: 0x1b2740, roughness: .42, metalness: .18, emissive: 0x000000 }));
      const e = new T.LineSegments(new T.EdgesGeometry(geom, 28), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28 }));
      m.add(e); m.scale.z = .01; m.userData = { uf: st.uf, h: .01, target: .4, pulse: 0, cx, cy, edge: e, col: new T.Color(0x1b2740) };
      this.group.add(m); this.meshes.push(m); this.byUf[st.uf] = m;
    };
    if (geo) {
      const lon0 = -52.5, lat0 = -14.8, kx = Math.cos(lat0 * Math.PI / 180), P = ([lo, la]) => new T.Vector2((lo - lon0) * kx, la - lat0);
      for (const f of geo.features) {
        const st = stateByCode(f.properties.codarea); if (!st) continue;
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; let big = null, bigA = -1;
        const shapes = polys.map(poly => { const rings = poly.map(r => { const v = r.map(P); if (v.length > 1 && v[0].equals(v[v.length - 1])) v.pop(); return v; });
          const s = new T.Shape(rings[0]); rings.slice(1).forEach(h => s.holes.push(new T.Path(h)));
          const a = Math.abs(T.ShapeUtils.area(rings[0])); if (a > bigA) { bigA = a; big = rings[0]; } return s; });
        const c = this.centroid(big);
        add(st, new T.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false }), c.x, c.y);
      }
    } else {
      const cell = 4.6;
      STATES.forEach(st => { const g = new T.BoxGeometry(cell * .9, cell * .9, 1); g.translate(0, 0, .5); add(st, g, 0, 0);
        this.byUf[st.uf].position.set((st.grid[0] - 3.5) * cell, -(st.grid[1] - 4) * cell, 0); });
    }
  },
  centroid(ring) { let a = 0, x = 0, y = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const f = ring[j].x * ring[i].y - ring[i].x * ring[j].y; a += f; x += (ring[j].x + ring[i].x) * f; y += (ring[j].y + ring[i].y) * f; }
    return a ? new THREE.Vector2(x / (3 * a), y / (3 * a)) : ring[0]; },

  /* vals[uf] = { h: 0..1, color, op, dim, sel, tip, label, pulse } */
  update(vals) {
    const T = THREE, base = new T.Color(0x1b2740);
    for (const m of this.meshes) {
      const v = vals[m.userData.uf]; if (!v) continue; const u = m.userData;
      u.target = .35 + v.h * 15; u.tip = v.tip; u.sel = v.sel; u.dim = v.dim;
      const c = new T.Color(v.color); u.col = base.clone().lerp(c, v.dim ? .08 : Math.min(1, .25 + v.op));
      m.material.color.copy(u.col); m.material.emissive.copy(c);
      u.edge.material.opacity = v.sel ? 1 : v.dim ? .06 : .28; u.edge.material.color.set(v.sel ? 0xffffff : 0xcfe0ff);
      if (v.pulse) { u.pulse = 1; this.spawnQ.push([m, c, Math.min(160, 10 + v.pulse)]); }
      const L = this.labels[u.uf] || (this.labels[u.uf] = Object.assign(document.createElement('div'), { className: 'm3-label' }));
      if (!L.parentNode) this.labelsEl.appendChild(L);
      L.innerHTML = `<b>${u.uf}</b>${v.label && (v.big || v.sel) ? `<span>${v.label}</span>` : ''}`; L.classList.toggle('sel', !!v.sel); L.classList.toggle('dim', !!v.dim);
    }
  },
  focus(uf) { const m = this.byUf[uf]; if (!m) return; const u = m.userData; this.focusT = this.top(m, u.h * .5); this.camT = this.focusT.clone().add(new THREE.Vector3(0, 24, 22)); this.controls.autoRotate = false; },
  top(m, z) { const u = m.userData; return this.group.localToWorld(new THREE.Vector3(u.cx + m.position.x, u.cy + m.position.y, z)); },

  emit(m, color, n) {
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const u = m.userData, s = Math.max(1, Math.min(6, m.geometry.boundingSphere.radius * .5));
    for (let k = 0; k < n; k++) {
      const i = this.pNext = (this.pNext + 1) % this.PN, w = this.top(m, u.h).add(new THREE.Vector3((Math.random() - .5) * s, 0, (Math.random() - .5) * s));
      this.pPos.set([w.x, w.y, w.z], i * 3); this.pVel.set([(Math.random() - .5) * .8, 4 + Math.random() * 7, (Math.random() - .5) * .8], i * 3);
      this.pBase.set([color.r, color.g, color.b], i * 3); this.pLife[i] = this.pMax[i] = 1.4 + Math.random() * 1.8;
    }
  },

  frame() {
    const dt = Math.min(.05, this.clock.getDelta()); if (!this.el.offsetParent) return;
    const c = this.controls;
    if (this.focusT) { c.target.lerp(this.focusT, Math.min(1, dt * 2.5)); if (c.target.distanceTo(this.focusT) < .05) this.focusT = null; }
    if (this.camT) { this.camera.position.lerp(this.camT, Math.min(1, dt * 2)); if (this.camera.position.distanceTo(this.camT) < .2) this.camT = null; }
    for (const m of this.meshes) {
      const u = m.userData; u.h += (u.target - u.h) * Math.min(1, dt * 2.6); m.scale.z = Math.max(.01, u.h);
      u.pulse = Math.max(0, u.pulse - dt * .6);
      m.material.emissiveIntensity = u.dim ? 0 : .1 + u.pulse * .9 + (m === this.hover ? .35 : 0) + (u.sel ? .3 + .15 * Math.sin(performance.now() / 260) : 0);
    }
    /* fila de explosões, espalhada ao longo dos quadros */
    for (let q = 0; q < 3 && this.spawnQ.length; q++) { const [m, col, n] = this.spawnQ[0]; const k = Math.min(n, 20); this.emit(m, col, k); if ((this.spawnQ[0][2] -= k) <= 0) this.spawnQ.shift(); }
    /* partículas ambientes: votos subindo dos estados, mais intensas ao vivo */
    if (this.meshes.length && Math.random() < this.intensity) { const m = this.meshes[Math.floor(Math.random() * this.meshes.length)]; if (!m.userData.dim) this.emit(m, m.material.emissive, 1); }
    for (let i = 0; i < this.PN; i++) {
      if (this.pLife[i] <= 0) continue; this.pLife[i] -= dt; const t = Math.max(0, this.pLife[i] / this.pMax[i]), j = i * 3;
      this.pPos[j] += this.pVel[j] * dt; this.pPos[j + 1] += this.pVel[j + 1] * dt; this.pPos[j + 2] += this.pVel[j + 2] * dt;
      const b = t * (1.4 - t); this.pCol[j] = this.pBase[j] * b * 1.6; this.pCol[j + 1] = this.pBase[j + 1] * b * 1.6; this.pCol[j + 2] = this.pBase[j + 2] * b * 1.6;
    }
    this.pGeo.attributes.position.needsUpdate = true; this.pGeo.attributes.color.needsUpdate = true;
    c.update(); this.renderer.render(this.scene, this.camera);
    /* rótulos HTML acompanham o topo de cada bloco */
    const W = this.el.clientWidth, H = this.el.clientHeight, cam = this.camera.position;
    for (const m of this.meshes) {
      const L = this.labels[m.userData.uf]; if (!L) continue;
      const p = this.top(m, m.userData.h + .2), dist = p.distanceTo(cam); p.project(this.camera);
      if (p.z > 1) { L.style.display = 'none'; continue; }
      L.style.display = ''; L.style.transform = `translate(-50%,-100%) translate(${(p.x + 1) / 2 * W}px,${(1 - p.y) / 2 * H}px) scale(${Math.max(.6, Math.min(1.15, 60 / dist))})`;
    }
  },
};
