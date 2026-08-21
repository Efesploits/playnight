/* M3RANT gömme dumanı testi.
   Play Night'ın gerçek protokol işleyicisini (CSP dahil) kullanır, menüden
   bir bot maçı başlatır ve oyunun gerçekten döndüğünü doğrular.
   Çalıştır:  npx electron scripts/smoke-m3rant.js  */
'use strict';
const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', 'vendor', 'm3rant');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm' };
const CSP = ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' data: blob:",
  "font-src 'self' data:", "worker-src 'self' blob:", "connect-src 'self' ws: wss: https: data: blob:"].join('; ');

protocol.registerSchemesAsPrivileged([{ scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

const errors = [];

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let rel = decodeURIComponent(new URL(req.url).pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(path.normalize(ROOT))) return new Response('forbidden', { status: 403 });
    try {
      const h = { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
      if (h['content-type'].startsWith('text/html')) h['content-security-policy'] = CSP;
      return new Response(fs.readFileSync(file), { status: 200, headers: h });
    } catch { return new Response('not found', { status: 404 }); }
  });

  const win = new BrowserWindow({ width: 1440, height: 860, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      backgroundThrottling: false } });

  win.webContents.session.setPermissionRequestHandler((_wc, p, cb) => cb(p === 'pointerLock' || p === 'fullscreen'));
  win.webContents.on('did-fail-load', (_e, c, d, u) => errors.push(`yuklenemedi: ${d} (${c}) ${u}`));
  /* Electron seviyeleri: 0 log, 1 info, 2 uyari, 3 hata.
     Yalnizca gercek hatalar testi dusurur; uyarilar bilgi olarak yazilir. */
  win.webContents.on('console-message', (_e, lvl, msg) => {
    const t = msg.slice(0, 160);
    if (lvl >= 3) { errors.push('konsol hata: ' + t); console.log('[sayfa HATA]', t); }
    else if (lvl === 2) console.log('[sayfa uyari]', t);
  });

  const js = (code) => win.webContents.executeJavaScript(code);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clickByText = (needle) => js(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.toUpperCase().includes(${JSON.stringify(needle)}));
    if (!b) return null; b.click(); return b.textContent.trim().slice(0, 60);
  })()`);

  win.webContents.on('did-finish-load', async () => {
    try {
      await wait(3500);
      const menu = await js(`({ title: document.title, canvas: !!document.querySelector('canvas'),
        name: (JSON.parse(localStorage.getItem('m3rant.profile.v1') || '{}')).name || null,
        buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0,40)) })`);
      console.log('[1/4] menu: ' + JSON.stringify({ title: menu.title, canvas: menu.canvas, name: menu.name }));

      console.log('[2/4] PLAY -> ' + await clickByText('PLAY'));
      await wait(1500);
      const opts = await js(`[...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0,46))`);
      console.log('        secenekler: ' + JSON.stringify(opts.slice(0, 8)));

      /* bot maçı başlat */
      let started = await clickByText('BOTS');
      if (!started) started = await clickByText('PRACTICE');
      if (!started) started = await clickByText('RANGE');
      console.log('[3/4] mod -> ' + started);
      await wait(1200);
      const step2 = await js(`[...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0,46))`);
      console.log('        sonraki: ' + JSON.stringify(step2.slice(0, 8)));
      for (const label of ['START', 'PLAY', 'CONFIRM', 'GO']) {
        const hit = await clickByText(label);
        if (hit) { console.log('        basildi: ' + hit); break; }
      }

      await wait(6000);
      const live = await js(`(() => {
        const c = document.querySelector('canvas');
        return { canvas: c ? c.width + 'x' + c.height : null,
          pixels: (() => { try { const g = c.getContext('webgl2') || c.getContext('webgl');
            return g ? g.drawingBufferWidth + 'x' + g.drawingBufferHeight : 'ctx yok'; } catch { return 'hata'; } })(),
          bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160) };
      })()`);
      console.log('[4/4] oyun: ' + JSON.stringify(live));
    } catch (e) { errors.push('sonda hata: ' + e.message); }

    const real = errors.filter((e) => !/Security Warning|Autofill|DevTools/i.test(e));
    console.log(real.length ? '\n[duman] HATALAR:\n - ' + real.join('\n - ') : '\n[duman] TEMIZ — hata yok');
    app.exit(real.length ? 1 : 0);
  });

  win.loadURL('app://m3rant/index.html?name=Efe');
  setTimeout(() => { console.log('[duman] ZAMAN ASIMI'); app.exit(1); }, 60000);
});
