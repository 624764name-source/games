// Заставка IniKo Studio «Искра» (идеи пользователя 04.10.2026): искра-грань вылетает снизу, врезается в левый край,
// в правый, в потолок — от каждого удара летят искры — и падает точкой над «i»; от удара разворачивается «IniKo Studio».
// HTML-слой поверх игры, ~2,2 с, без картинок и шрифтов (~7 КБ). Показывается сразу и закрывает загрузку игры.
//   IniKoSplash.show({ line: 'irmen' | 'casual' | 'creative', minMs: 2200, until: promise, onDone })
// Касание/клавиша — пропуск (после 0,4 с). prefers-reduced-motion — финальный кадр. at — заморозить кадр (проверка).
(function () {
  const LINES = {
    irmen:    { bg: '#0E0D12', ink: '#FFFFFF', sub: '#9A97A8', dot: '#E0A83A', glow: '#FFE2A0' },
    casual:   { bg: '#FFF6EE', ink: '#141312', sub: '#8A7F74', dot: '#F2664A', glow: '#FFB89C' },
    creative: { bg: '#F2FBF7', ink: '#141312', sub: '#6F8A80', dot: '#2FC79B', glow: '#8FE8C8' },
  };
  const NS = 'http://www.w3.org/2000/svg';
  const dia = (r) => `M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z`;
  const LETTERS = (st, stDot) => [
    { x: 24, d: `<path d="M24 42V118M10 30H38M10 130H38" ${st}/>` },
    { x: 102, d: `<path d="M72 118V82M72 100a30 30 0 0 1 60 0V118" ${st}/>` },
    { x: 180, d: `<path d="M180 84V118" ${st}/>` },
    { x: 256, d: `<path d="M228 42V118M246 86L282 44" ${st}/>`, k: `<path class="kleg" d="M250 90L284 118" ${stDot}/>` },
    { x: 340, d: `<circle cx="340" cy="98" r="22" ${st}/>` },
  ];
  const I_DOT = { x: 180, y: 46 };

  const clamp = (t) => Math.max(0, Math.min(1, t));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const outCubic = (t) => 1 - Math.pow(1 - t, 3);
  const inQuad = (t) => t * t;
  const outBack = (t, s = 1.8) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

  // Раскадровка, с: удары о левый край, правый, потолок; посадка; надпись
  const T = { left: 0.26, right: 0.5, top: 0.72, land: 1.12, kleg: 1.5, studio: 1.46, end: 2.2 };
  const SPARKS = 16;      // искр от каждого удара
  const SPARK_LIFE = 0.5; // с

  // Детерминированная «случайность» — кадр в момент t одинаков при любом способе проигрывания
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function show(opts = {}) {
    const c = LINES[opts.line] || LINES.casual;
    const minMs = opts.minMs ?? T.end * 1000;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = innerWidth, H = innerHeight;
    const s = Math.min((W * 0.62) / 392, (H * 0.3) / 160, 1.25);          // масштаб надписи
    const ox = W / 2 - 196 * s, oy = H / 2 - 92 * s;
    const tx = ox + I_DOT.x * s, ty = oy + I_DOT.y * s;                   // куда садится искра
    const R = 15 * s;                                                     // радиус точки над «i»
    const BIG = 1.9;                                                      // искра в полёте крупнее точки
    const m = R * BIG * 1.1;                                              // отступ центра от края при ударе
    // Опорные точки полёта и нормали стен (куда отлетают искры)
    const P = [
      { x: W * 0.62, y: H + R * 4, t: 0 },                                // старт — снизу за экраном
      { x: m, y: H * 0.56, t: T.left, nx: 1, ny: 0 },                     // левый край
      { x: W - m, y: H * 0.3, t: T.right, nx: -1, ny: 0 },                // правый край
      { x: W * 0.4, y: m, t: T.top, nx: 0, ny: 1 },                       // потолок
      { x: tx, y: ty, t: T.land },                                        // точка над «i»
    ];
    const st = `stroke="${c.ink}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    const stDot = st.replace(c.ink, c.dot);
    const hits = P.slice(1, 4);

    const root = document.createElement('div');
    root.setAttribute('data-iniko-splash', '');
    root.style.cssText = `position:fixed;inset:0;z-index:2147483600;background:${c.bg};transition:opacity .28s ease;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden`;
    root.innerHTML = `
<svg xmlns="${NS}" width="100%" height="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="IniKo Studio">
  <g id="scene">
    <g id="word" transform="translate(${ox} ${oy}) scale(${s})">
      ${LETTERS(st, stDot).map((l) => `<g class="L" data-x="${l.x}">${l.d}${l.k || ''}</g>`).join('')}
    </g>
    <text id="studio" x="${W / 2}" y="${oy + 178 * s}" text-anchor="middle" font-family="-apple-system,Helvetica Neue,Arial,sans-serif"
      font-weight="700" font-size="${22 * s}" letter-spacing="${11 * s}" fill="${c.sub}">STUDIO</text>
    <g id="bursts">${hits.map(() => `<g>${Array.from({ length: SPARKS }, (_, i) =>
      `<path d="${dia(R * (i % 3 === 0 ? 0.8 : 0.5))}" fill="${i % 2 ? c.glow : c.dot}"/>`).join('')}</g>`).join('')}</g>
    <g id="flashes">${hits.map(() => `<circle r="${R}" fill="none" stroke="${c.glow}" stroke-width="${4 * s}" opacity="0"/>`).join('')}</g>
    <g id="trail">${[0, 1, 2, 3].map(() => `<path d="${dia(R)}" fill="${c.dot}"/>`).join('')}</g>
    <g id="rays" stroke="${c.dot}" stroke-width="${5 * s}" stroke-linecap="round" opacity="0">
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M0 ${-R * 1.9}V${-R * 2.9}" transform="rotate(${a})"/>`).join('')}
    </g>
    <circle id="halo" r="${R * 1.9}" fill="${c.glow}" opacity="0"/>
    <g id="spark"><path d="${dia(R)}" fill="${c.dot}"/><path d="${dia(R * 0.42)}" fill="${c.glow}" opacity="0.9"/></g>
  </g>
</svg>`;
    document.body.appendChild(root);
    const $ = (q) => root.querySelector(q);
    const scene = $('#scene'), spark = $('#spark'), halo = $('#halo'), rays = $('#rays'), studio = $('#studio');
    const trail = [...root.querySelectorAll('#trail path')], Ls = [...root.querySelectorAll('.L')];
    const bursts = [...root.querySelectorAll('#bursts > g')].map((g) => [...g.children]);
    const flashes = [...root.querySelectorAll('#flashes circle')];
    const kleg = $('.kleg'), legLen = kleg.getTotalLength ? kleg.getTotalLength() : 44;
    kleg.style.strokeDasharray = legLen;

    // Искра во времени: прямые перелёты между стенами (почти без замедления — как отскок), последний отрезок — падение с ускорением
    function sparkAt(t) {
      let i = 0;
      while (i < P.length - 2 && t > P[i + 1].t) i++;
      const a = P[i], b = P[i + 1];
      let k = seg(t, a.t, b.t);
      k = i === P.length - 2 ? inQuad(k) : 1 - Math.pow(1 - k, 1.4);
      const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
      // Сплющивание после удара — вдоль нормали стены, 0,08 с
      const hit = hits.find((h) => t >= h.t && t < h.t + 0.08);
      const q = hit ? 1 - (t - hit.t) / 0.08 : 0;
      const sx = hit && hit.nx ? 1 - 0.45 * q : 1 + 0.35 * q, sy = hit && hit.ny ? 1 - 0.45 * q : 1 + 0.35 * q;
      return { x, y, rot: t * 900, sx, sy };
    }
    const hist = [];
    const t0 = performance.now();
    let gameReady = !opts.until, done = false, raf = 0, skipped = false;
    if (opts.until) Promise.resolve(opts.until).then(() => { gameReady = true; });

    function frame(now) {
      const ms = opts.at != null ? opts.at : reduce ? T.end * 1000 : now - t0;
      const t = ms / 1000;
      // Искра
      let p;
      if (t < T.land) p = sparkAt(t);
      else {
        const b = seg(t, T.land, T.land + 0.3);
        p = { x: tx, y: ty, rot: 0, sx: 1 + 0.35 * Math.sin(b * Math.PI) * (1 - b), sy: 1 - 0.3 * Math.sin(b * Math.PI) * (1 - b) };
      }
      const big = 1 + (BIG - 1) * (1 - seg(t, T.land - 0.28, T.land));   // к посадке — размер точки над «i»
      const rot = t < T.land ? p.rot - (p.rot % 90) * seg(t, T.land - 0.15, T.land) : 0; // садится ровно, углом вверх
      spark.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${rot}) scale(${p.sx * big} ${p.sy * big})`);
      spark.style.opacity = t < 0.01 ? 0 : 1;
      halo.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${big})`);
      halo.style.opacity = t < 0.01 ? 0 : (0.3 + 0.2 * Math.sin(t * 30)) * (1 - seg(t, T.land - 0.05, T.land + 0.15));
      // Шлейф
      hist.unshift({ x: p.x, y: p.y, rot, big }); hist.length = Math.min(hist.length, 14);
      trail.forEach((g, i) => {
        const q = hist[(i + 1) * 3];
        const on = q && t < T.land && opts.at == null;
        g.setAttribute('transform', on ? `translate(${q.x} ${q.y}) rotate(${q.rot}) scale(${q.big * (0.8 - i * 0.16)})` : 'scale(0)');
        g.style.opacity = on ? 0.32 - i * 0.07 : 0;
      });
      // Искры от ударов: веер в полусфере от стены, с гравитацией; вспышка-кольцо
      let shx = 0, shy = 0;
      hits.forEach((h, j) => {
        const dt = t - h.t, on = dt >= 0 && dt < SPARK_LIFE;
        const base = Math.atan2(h.ny, h.nx);
        bursts[j].forEach((g, i) => {
          if (!on) { g.setAttribute('transform', 'scale(0)'); return; }
          const ang = base + (rnd(j * 50 + i) - 0.5) * Math.PI * 0.95;
          const v = (380 + 520 * rnd(j * 50 + i + 17)) * s;
          const x = h.x + Math.cos(ang) * v * dt, y = h.y + Math.sin(ang) * v * dt + 900 * s * dt * dt;
          const life = 1 - dt / SPARK_LIFE;
          g.setAttribute('transform', `translate(${x} ${y}) rotate(${dt * 720 + i * 40}) scale(${0.5 + 0.9 * life})`);
          g.style.opacity = life;
        });
        const fk = seg(t, h.t, h.t + 0.25);
        flashes[j].setAttribute('cx', h.x); flashes[j].setAttribute('cy', h.y);
        flashes[j].setAttribute('r', R * (1 + 3 * outCubic(fk)));
        flashes[j].setAttribute('opacity', fk > 0 && fk < 1 ? String(0.9 * (1 - fk)) : '0');
        if (dt >= 0 && dt < 0.1) { const a = 7 * (1 - dt / 0.1); shx -= (h.nx || 0) * a; shy -= (h.ny || 0) * a; } // толчок в сторону удара
      });
      // Посадка: лучи, толчок вниз
      const landK = seg(t, T.land, T.land + 0.4);
      rays.setAttribute('transform', `translate(${tx} ${ty}) scale(${0.6 + 0.8 * outCubic(landK)})`);
      rays.setAttribute('opacity', String(Math.max(0, Math.sin(landK * Math.PI)) * 0.9));
      if (t > T.land && t < T.land + 0.14) shy += 7 * Math.sin((t - T.land) * 90) * (1 - (t - T.land) / 0.14);
      scene.setAttribute('transform', `translate(${shx * s} ${shy * s})`);
      // Надпись разворачивается из точки над «i»
      Ls.forEach((g) => {
        const x = +g.dataset.x, dist = Math.abs(x - I_DOT.x) / 160;
        const k = outBack(seg(t, T.land + dist * 0.12, T.land + 0.32 + dist * 0.12), 1.6);
        const dx = (I_DOT.x - x) * (1 - k), sc = 0.2 + 0.8 * Math.min(1, k);
        g.setAttribute('transform', `translate(${x + dx} 80) scale(${sc}) translate(${-x} -80)`);
        g.style.opacity = k > 0 ? Math.min(1, k * 1.6) : 0;
      });
      kleg.style.strokeDashoffset = legLen * (1 - outCubic(seg(t, T.kleg, T.kleg + 0.2)));
      const so = outCubic(seg(t, T.studio, T.studio + 0.35));
      studio.style.opacity = so; studio.setAttribute('transform', `translate(0 ${(1 - so) * 10 * s})`);

      if (opts.at != null) return;
      if ((ms >= minMs && gameReady) || skipped) return finish();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      if (done) return; done = true; cancelAnimationFrame(raf);
      root.style.opacity = '0';
      setTimeout(() => { root.remove(); opts.onDone && opts.onDone(); }, 300);
      removeEventListener('keydown', skip);
    }
    function skip() { if (performance.now() - t0 > 400 && gameReady) skipped = true; }
    root.addEventListener('pointerdown', skip);
    addEventListener('keydown', skip);
    raf = requestAnimationFrame(frame);
    return { finish };
  }

  window.IniKoSplash = { show, LINES };
})();
