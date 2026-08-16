/* =============================================================================
 *  PLAY NIGHT — ÇİZİM TUVALİ
 *  Çizimler PNG değil, kompakt vektör (fırça darbesi) olarak saklanır:
 *   - ağdan çok daha küçük geçer
 *   - sunumda "çiziliyormuş gibi" animasyonla oynatılabilir
 * ========================================================================== */
(function (w) {
  'use strict';
  const { el } = w.U;

  /* mantıksal tuval boyutu (tüm koordinatlar buna göre) */
  const LW = 1000, LH = 700;

  const PALETTE = [
    '#12151d', '#ffffff', '#7b8497',
    '#e02a3c', '#ff7a3d', '#ffc93c',
    '#2fe08a', '#0f9d58', '#46d4ff',
    '#2f6bff', '#7a4dff', '#ff6fc4',
    '#8b5a2b', '#f2d0a4',
  ];
  const SIZES = [3, 7, 14, 28, 52];
  const PAPER = '#fbf8f1';

  /* ------------------------------------------------------------ çizici -- */
  /**
   * Verilen darbe listesini canvas'a çizer.
   * @param upTo  0..1 arası ilerleme (sunum animasyonu); yoksa hepsi çizilir
   */
  function paint(ctx, data, cw, ch, upTo) {
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, cw, ch);

    const sx = cw / LW, sy = ch / LH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokes = (data && data.strokes) || [];
    const total = strokes.reduce((s, k) => s + k.p.length / 2, 0);
    const budget = upTo === undefined || upTo === null ? Infinity : Math.ceil(total * upTo);
    let drawn = 0;

    for (const s of strokes) {
      if (drawn >= budget) break;
      const pts = s.p;
      const n = pts.length / 2;
      const take = Math.min(n, budget - drawn);
      if (take < 1) break;

      ctx.strokeStyle = s.e ? PAPER : (PALETTE[s.c] || PALETTE[0]);
      ctx.lineWidth = (SIZES[s.s] || SIZES[1]) * ((sx + sy) / 2);

      if (take === 1) {
        /* tek nokta: yuvarlak bir iz */
        ctx.beginPath();
        ctx.arc(pts[0] * sx, pts[1] * sy, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0] * sx, pts[1] * sy);
        for (let i = 1; i < take; i++) ctx.lineTo(pts[i * 2] * sx, pts[i * 2 + 1] * sy);
        ctx.stroke();
      }
      drawn += n;
    }
    ctx.restore();
  }

  /** Bir canvas'a çizimi sığdırarak bas (statik). */
  function render(canvas, data) {
    const dpr = Math.min(2, w.devicePixelRatio || 1);
    const cw = canvas.clientWidth || LW, ch = canvas.clientHeight || LH;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, data, cw, ch);
  }

  /** Çizimi soldan sağa "yeniden çiziliyormuş" gibi oynat. */
  function replay(canvas, data, ms, onDone) {
    const dpr = Math.min(2, w.devicePixelRatio || 1);
    const cw = canvas.clientWidth || LW, ch = canvas.clientHeight || LH;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dur = ms || 1400;
    const t0 = performance.now();
    let raf = 0;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      paint(ctx, data, cw, ch, p);
      if (p < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  /* ------------------------------------------------------------ painter -- */
  /**
   * Düzenlenebilir tuval oluşturur.
   * @returns {{root, getData, setData, clear, undo, destroy, isEmpty}}
   */
  function createPainter(opts) {
    const o = opts || {};
    const strokes = [];
    let color = 0, size = 1, eraser = false;
    let drawing = false, current = null, lastX = 0, lastY = 0;

    const canvas = el('canvas', { class: 'ciz-canvas' });
    const wrap = el('div', { class: 'ciz-canvas-wrap' }, [canvas]);

    /* --- araç çubuğu --- */
    const swatches = el('div', { class: 'ciz-colors' });
    PALETTE.forEach((hex, i) => {
      swatches.appendChild(el('button', {
        class: 'ciz-sw' + (i === color ? ' on' : ''),
        style: { background: hex }, title: 'Renk',
        onclick: () => {
          color = i; eraser = false;
          [...swatches.children].forEach((b, j) => b.classList.toggle('on', j === i));
          eraseBtn.classList.remove('on');
          w.SFX.play('pick');
        },
      }));
    });

    const sizeBox = el('div', { class: 'ciz-sizes' });
    SIZES.forEach((px, i) => {
      sizeBox.appendChild(el('button', {
        class: 'ciz-size' + (i === size ? ' on' : ''), title: 'Kalınlık',
        onclick: () => {
          size = i;
          [...sizeBox.children].forEach((b, j) => b.classList.toggle('on', j === i));
          w.SFX.play('pick');
        },
      }, [el('i', { style: { width: Math.min(26, px) + 'px', height: Math.min(26, px) + 'px' } })]));
    });

    const eraseBtn = el('button', {
      class: 'ciz-tool', title: 'Silgi', html: '<span>SİLGİ</span>',
      onclick: () => {
        eraser = !eraser;
        eraseBtn.classList.toggle('on', eraser);
        w.SFX.play('pick');
      },
    });
    const undoBtn = el('button', {
      class: 'ciz-tool', title: 'Geri al', html: '<span>GERİ AL</span>',
      onclick: () => { undo(); w.SFX.play('back'); },
    });
    const clearBtn = el('button', {
      class: 'ciz-tool danger', title: 'Temizle', html: '<span>TEMİZLE</span>',
      onclick: async () => {
        if (!strokes.length) return;
        const yes = await w.UI.confirm({ title: 'TUVALİ TEMİZLE', sub: 'Çizdiğin her şey silinecek.', confirm: 'TEMİZLE', danger: true });
        if (yes) { clear(); w.SFX.play('back'); }
      },
    });

    const tools = el('div', { class: 'ciz-tools' }, [
      swatches, el('div', { class: 'ciz-tsep' }), sizeBox,
      el('div', { class: 'ciz-tsep' }), eraseBtn, undoBtn, clearBtn,
    ]);

    const root = el('div', { class: 'ciz-painter' }, [wrap, tools]);

    /* --- boyutlandırma --- */
    const redraw = () => {
      const dpr = Math.min(2, w.devicePixelRatio || 1);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, { strokes }, cw, ch);
    };
    const ro = new ResizeObserver(() => redraw());
    ro.observe(canvas);

    /* --- girdi --- */
    const toLogical = (ev) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.round(((ev.clientX - r.left) / r.width) * LW),
        y: Math.round(((ev.clientY - r.top) / r.height) * LH),
      };
    };

    const onDown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (o.locked && o.locked()) return;
      /* yakalama bazı girdi aygıtlarında reddedilebilir; çizim yine de sürsün */
      try { canvas.setPointerCapture(ev.pointerId); } catch { /* önemsiz */ }
      drawing = true;
      const p = toLogical(ev);
      lastX = p.x; lastY = p.y;
      current = { c: color, s: size, e: eraser ? 1 : 0, p: [p.x, p.y] };
      strokes.push(current);
      redraw();
      ev.preventDefault();
    };

    const onMove = (ev) => {
      if (!drawing || !current) return;
      const p = toLogical(ev);
      /* çok yakın noktaları at: veri küçük kalsın */
      const min = 4 + SIZES[size] * 0.18;
      if (Math.hypot(p.x - lastX, p.y - lastY) < min) return;
      current.p.push(p.x, p.y);
      lastX = p.x; lastY = p.y;
      redraw();
    };

    const onUp = () => {
      if (!drawing) return;
      drawing = false;
      current = null;
      if (o.onChange) o.onChange();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.style.touchAction = 'none';

    function undo() { strokes.pop(); redraw(); if (o.onChange) o.onChange(); }
    function clear() { strokes.length = 0; redraw(); if (o.onChange) o.onChange(); }
    function getData() { return { strokes: strokes.map((s) => ({ c: s.c, s: s.s, e: s.e, p: s.p.slice() })) }; }
    function setData(d) {
      strokes.length = 0;
      if (d && Array.isArray(d.strokes)) for (const s of d.strokes) strokes.push({ c: s.c, s: s.s, e: s.e, p: s.p.slice() });
      redraw();
    }
    function destroy() {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onUp);
    }

    requestAnimationFrame(redraw);

    return { root, canvas, getData, setData, clear, undo, destroy,
             isEmpty: () => strokes.length === 0,
             pointCount: () => strokes.reduce((a, s) => a + s.p.length / 2, 0) };
  }

  /* --------------------------------------------------------- bot çizim -- */
  /** Botlar için rastgele ama "çizim gibi duran" karalama üretir. */
  function scribble(seed) {
    const rnd = w.Okey101.mulberry32(seed >>> 0);
    const strokes = [];
    const count = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i++) {
      const cx = 150 + rnd() * 700, cy = 120 + rnd() * 460;
      const r = 40 + rnd() * 150;
      const turns = 1 + rnd() * 2.5;
      const steps = 18 + Math.floor(rnd() * 26);
      const p = [];
      const wob = 0.3 + rnd() * 0.9;
      for (let k = 0; k <= steps; k++) {
        const a = (k / steps) * Math.PI * 2 * turns;
        const rr = r * (0.55 + 0.45 * Math.sin(a * wob + i));
        p.push(
          Math.round(Math.max(4, Math.min(996, cx + Math.cos(a) * rr))),
          Math.round(Math.max(4, Math.min(696, cy + Math.sin(a) * rr * 0.8)))
        );
      }
      strokes.push({ c: Math.floor(rnd() * PALETTE.length), s: Math.floor(rnd() * 3) + 1, e: 0, p });
    }
    return { strokes };
  }

  w.CizDraw = { PALETTE, SIZES, PAPER, LW, LH, createPainter, render, replay, paint, scribble };
})(window);
