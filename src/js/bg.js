/* PLAY NIGHT — arkaplan parçacık alanı (canvas) */
(function (w) {
  'use strict';

  let canvas, ctx, raf = 0, running = false;
  let W = 0, H = 0, dpr = 1;
  let pts = [];
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, w.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const target = Math.round(Math.min(120, (W * H) / 15000));
    pts = [];
    for (let i = 0; i < target; i++) {
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.7 + 0.5,
        a: Math.random() * 0.5 + 0.25,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  function frame(t) {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    /* bağlantı çizgileri */
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 15000) {
          const alpha = (1 - d2 / 15000) * 0.16;
          ctx.strokeStyle = `rgba(96,160,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    /* noktalar */
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      p.tw += 0.02;

      /* imleçten hafifçe kaç */
      const mx = p.x - mouse.x, my = p.y - mouse.y;
      const md = mx * mx + my * my;
      if (md < 14000 && md > 1) {
        const f = (1 - md / 14000) * 0.55;
        const inv = 1 / Math.sqrt(md);
        p.x += mx * inv * f; p.y += my * inv * f;
      }

      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;

      const a = p.a * (0.65 + 0.35 * Math.sin(p.tw));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(150,205,255,${a})`);
      g.addColorStop(1, 'rgba(60,130,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: true });
    resize();
    running = true;
    raf = requestAnimationFrame(frame);
    w.addEventListener('resize', w.U.debounce(resize, 180));
    w.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    w.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (!running) { running = true; raf = requestAnimationFrame(frame); }
    });
  }

  function stop() { running = false; cancelAnimationFrame(raf); }

  w.BG = { start, stop };
})(window);
