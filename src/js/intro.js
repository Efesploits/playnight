/* PLAY NIGHT — sinematik açılış (canvas efekti + zaman çizelgesi) */
(function (w) {
  'use strict';

  let canvas, ctx, raf = 0, t0 = 0, running = false;
  let W = 0, H = 0, dpr = 1;
  let stars = [], sparks = [], rings = [];
  let doneCb = null, finished = false, timers = [];

  /* ------------------------------------------------------------ canvas -- */
  function resize() {
    dpr = Math.min(2, w.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    stars = [];
    const n = Math.round(Math.min(260, (W * H) / 5200));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * Math.max(W, H) * 0.7;
      stars.push({
        ang, rad,
        z: Math.random() * 0.9 + 0.1,
        r: Math.random() * 1.6 + 0.3,
        sp: Math.random() * 0.55 + 0.28,
        hue: Math.random() < 0.28 ? 190 : 218,
      });
    }
    sparks = []; rings = [];
  }

  /** merkezden dışa doğru patlayan parlama halkası */
  function burst(delay, maxR, width) {
    timers.push(setTimeout(() => rings.push({ t: 0, maxR: maxR || Math.max(W, H) * 0.75, w: width || 3 }), delay));
  }

  /** harf düştüğünde kıvılcım saç */
  function sparkAt(x, y, count) {
    for (let i = 0; i < (count || 14); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 3.4 + 0.8;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.7, life: 1, r: Math.random() * 2 + 0.7 });
    }
  }

  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    const cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    /* --- yıldız akışı (merkeze doğru hız hissi) --- */
    for (const s of stars) {
      s.rad += s.sp * (1 + s.z * 2.6) * (1 + t * 0.5);
      if (s.rad > Math.max(W, H) * 0.85) { s.rad = Math.random() * 60; s.ang = Math.random() * Math.PI * 2; }
      const x = cx + Math.cos(s.ang) * s.rad;
      const y = cy + Math.sin(s.ang) * s.rad * 0.72;
      const a = Math.min(1, s.rad / 180) * s.z * 0.85;
      const len = 2 + s.z * 14 * Math.min(1, t * 0.5);

      ctx.strokeStyle = `hsla(${s.hue}, 100%, ${68 + s.z * 22}%, ${a})`;
      ctx.lineWidth = s.r;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(s.ang) * len, y - Math.sin(s.ang) * len * 0.72);
      ctx.stroke();
    }

    /* --- patlama halkaları --- */
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += 0.016;
      const p = Math.min(1, r.t / 1.1);
      const e = 1 - Math.pow(1 - p, 3);
      const rad = e * r.maxR;
      const a = (1 - p) * 0.55;
      ctx.strokeStyle = `rgba(140,210,255,${a})`;
      ctx.lineWidth = r.w * (1 - p * 0.75);
      ctx.beginPath(); ctx.ellipse(cx, cy, rad, rad * 0.74, 0, 0, Math.PI * 2); ctx.stroke();
      if (p >= 1) rings.splice(i, 1);
    }

    /* --- kıvılcımlar --- */
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.07; s.vx *= 0.985; s.life -= 0.017;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(170,225,255,${s.life * 0.85})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------- akış ------- */
  function scheduleFx(reduced) {
    const title = document.querySelector('.intro-title');
    const rect = () => (title ? title.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0 });

    if (reduced) { burst(60, Math.max(W, H) * 0.6, 2); return; }

    /* logo işareti gelirken küçük patlama */
    burst(260, Math.max(W, H) * 0.35, 2);

    /* harfler düşerken kıvılcım */
    const letterTimes = [750, 860, 970, 1080, 1350, 1460, 1570, 1680, 1790];
    letterTimes.forEach((ms, i) => {
      timers.push(setTimeout(() => {
        const letters = document.querySelectorAll('.intro-title i');
        const node = letters[i];
        if (node) {
          const r = node.getBoundingClientRect();
          sparkAt(r.left + r.width / 2, r.top + r.height * 0.8, 10);
        }
        w.SFX.play('tile');
      }, ms));
    });

    /* ışık süpürmesi anında büyük patlama + vuruş sesi */
    burst(2050, Math.max(W, H) * 0.95, 4);
    timers.push(setTimeout(() => {
      w.SFX.play('introHit');
      const r = rect();
      for (let i = 0; i < 40; i++) {
        sparkAt(r.left + Math.random() * r.width, r.top + r.height * (0.3 + Math.random() * 0.5), 1);
      }
    }, 2050));
  }

  /* ---------------------------------------------------------- API ------ */
  function run(opts) {
    const o = opts || {};
    const root = document.getElementById('intro');
    canvas = document.getElementById('introFx');
    doneCb = o.onDone || null;
    finished = false;

    if (o.skip) { hide(true); return; }

    document.body.classList.toggle('reduced-intro', !!o.reduced);
    ctx = canvas.getContext('2d');
    resize(); seed();
    running = true; t0 = performance.now();
    raf = requestAnimationFrame(frame);
    w.addEventListener('resize', resize);

    w.SFX.play('intro');
    scheduleFx(!!o.reduced);

    const total = o.reduced ? 1500 : 3600;
    timers.push(setTimeout(() => hide(false), total));

    const skipBtn = document.getElementById('introSkip');
    if (skipBtn) skipBtn.onclick = () => hide(false);
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') hide(false);
  }

  function hide(instant) {
    if (finished) return;
    finished = true;
    for (const t of timers) clearTimeout(t);
    timers = [];
    document.removeEventListener('keydown', onKey);

    const root = document.getElementById('intro');
    if (instant) {
      root.classList.add('done', 'gone');
      stop();
      if (doneCb) doneCb();
      return;
    }
    root.classList.add('done');
    setTimeout(() => {
      root.classList.add('gone');
      stop();
    }, 900);
    if (doneCb) doneCb();
  }

  function stop() { running = false; cancelAnimationFrame(raf); w.removeEventListener('resize', resize); }

  w.Intro = { run };
})(window);
