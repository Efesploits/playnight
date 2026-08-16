/* PLAY NIGHT — küçük yardımcılar */
(function (w) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined || c === false) continue;
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      }
    }
    return n;
  }

  const clear = (node) => { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  /* 6 haneli, karışması zor kod (I, O, 0, 1 yok) */
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeCode(len) {
    const n = len || 6;
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    let out = '';
    for (let i = 0; i < n; i++) out += ALPHABET[buf[i] % ALPHABET.length];
    return out;
  }
  const isCode = (s) => typeof s === 'string' && new RegExp(`^[${ALPHABET}]{6}$`).test(s.toUpperCase());

  function randSeed() {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return b[0];
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  function throttle(fn, ms) {
    let last = 0, timer = null, lastArgs = null;
    return function (...a) {
      const now = performance.now();
      lastArgs = a;
      if (now - last >= ms) { last = now; fn.apply(this, a); }
      else if (!timer) {
        timer = setTimeout(() => { timer = null; last = performance.now(); fn.apply(this, lastArgs); }, ms - (now - last));
      }
    };
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(String(text)); return true; }
    catch {
      try {
        const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
        ta.value = String(text);
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch { return false; }
    }
  }

  /* Ada göre kararlı, hoş bir renk çifti üret */
  const AVATAR_COLORS = [
    ['#2f6bff', '#123ba8'], ['#46d4ff', '#0b6fa8'], ['#7a4dff', '#3d1ba8'],
    ['#2fe08a', '#0a7d4c'], ['#ffc93c', '#c07800'], ['#ff4d63', '#a4142c'],
    ['#ff7ac2', '#a81f75'], ['#38e0d0', '#0a7e78'], ['#a0f04a', '#4a8a10'],
    ['#ff9142', '#b04a00'],
  ];
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function avatarStyle(seed, forced) {
    const idx = forced !== null && forced !== undefined && forced >= 0
      ? forced % AVATAR_COLORS.length : hashStr(seed) % AVATAR_COLORS.length;
    const [a, b] = AVATAR_COLORS[idx];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }
  const initials = (name) => String(name || '?').trim().slice(0, 1).toUpperCase() || '?';

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtTime = (ts) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  /* Sayıyı yumuşak biçimde hedefe götür (istatistik animasyonu) */
  function animateNumber(node, to, ms) {
    const from = parseInt(node.textContent, 10) || 0;
    if (from === to) { node.textContent = String(to); return; }
    const dur = ms || 700, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  w.U = { $, $$, el, clear, makeCode, isCode, randSeed, clamp, sleep, debounce, throttle,
          copy, avatarStyle, initials, hashStr, escapeHtml, fmtTime, animateNumber, AVATAR_COLORS };
})(window);
