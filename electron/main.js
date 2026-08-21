'use strict';

const { app, BrowserWindow, ipcMain, shell, screen, dialog, protocol, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

/* Donanım hızlandırma + akıcı animasyon için */
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const isDev = !app.isPackaged;
let mainWindow = null;

/* ------------------------------------------------------------------ */
/* Kalıcı depolama (profil, arkadaşlar, ayarlar, istatistik)           */
/* ------------------------------------------------------------------ */
const STORE_FILE = () => path.join(app.getPath('userData'), 'playnight-store.json');

const DEFAULT_STORE = {
  profile: null,          // { id, name, avatar, createdAt }
  friends: [],            // [{ id, name, avatar, addedAt }]
  requests: [],           // gelen arkadaşlık istekleri
  settings: {
    sound: true,
    music: true,
    volume: 0.6,
    animations: 'full',   // full | reduced
    skipIntro: false,
    turnSeconds: 30,
    iceServers: null,     // null => varsayılan liste
    autoUpdate: true,     // açılışta sessiz sürüm kontrolü
  },
  stats: {
    okey101: { played: 0, won: 0, bestScore: null },
    ciz: { played: 0, won: 0 },
    uno: { played: 0, won: 0 },
  },
};

function deepMerge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = Array.isArray(base) ? [] : { ...(base || {}) };
  for (const k of Object.keys(patch)) {
    out[k] = k in (base || {}) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      ? deepMerge(base[k], patch[k])
      : patch[k];
  }
  return out;
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_FILE(), 'utf8');
    return deepMerge(DEFAULT_STORE, JSON.parse(raw));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
}

let writeTimer = null;
let pendingStore = null;
function writeStore(data) {
  pendingStore = data;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(path.dirname(STORE_FILE()), { recursive: true });
      fs.writeFileSync(STORE_FILE(), JSON.stringify(pendingStore, null, 2), 'utf8');
    } catch (err) {
      console.error('[store] yazilamadi:', err);
    }
  }, 120);
}

/* ------------------------------------------------------------------ */
/* Pencere                                                             */
/* ------------------------------------------------------------------ */
function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1500, Math.round(sw * 0.9));
  const height = Math.min(940, Math.round(sh * 0.92));

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#04060f',
    title: 'Play Night',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev && process.env.PN_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  const sendState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:state', {
        maximized: mainWindow.isMaximized(),
        fullscreen: mainWindow.isFullScreen(),
      });
    }
  };
  mainWindow.on('maximize', sendState);
  mainWindow.on('unmaximize', sendState);
  mainWindow.on('enter-full-screen', sendState);
  mainWindow.on('leave-full-screen', sendState);

  /* Dış bağlantılar varsayılan tarayıcıda açılsın, uygulama içinde değil */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ------------------------------------------------------------------ */
/* M3RANT — kendi penceresinde açılan 5v5 nişancı oyunu                */
/*                                                                     */
/* M3RANT ayrı bir Vite yapısıdır ve `<script type="module">` kullanır. */
/* Modül betikleri CORS'a tabidir, file:// bunu geçemez — bu yüzden     */
/* kendi ayrıcalıklı `app://` şemasıyla sunulur. Ayrıca standart bir    */
/* şema olması sayfayı güvenli bağlam yapar; WebRTC bunu bekler.        */
/*                                                                     */
/* Ayrı pencere bilinçli bir tercih: nişan kilidi (pointer lock) gömülü */
/* bir çerçevenin izinlerine takılmaz, oyun tüm pencereyi kullanır ve   */
/* kendi Three.js sürümü Play Night'ınkiyle çakışmaz.                   */
/* ------------------------------------------------------------------ */
const M3_ROOT = path.join(__dirname, '..', 'vendor', 'm3rant');
let m3Window = null;

const M3_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

function serveM3(request) {
  let rel = decodeURIComponent(new URL(request.url).pathname);
  if (rel === '' || rel === '/') rel = '/index.html';

  /* Yolu çöz, sonra kökten çıkmadığını doğrula: paket salt okunur olsa da
     dizin atlama sayfaya rastgele dosya okutmamalı. */
  const file = path.normalize(path.join(M3_ROOT, rel));
  if (!file.startsWith(path.normalize(M3_ROOT))) return new Response('forbidden', { status: 403 });

  try {
    const headers = {
      'content-type': M3_MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    };
    /* Sayfaya kendi CSP'sini ver. 'wasm-unsafe-eval' Rapier fizik motorunun
       WASM'ı için, blob: ses/doku üretimi için, wss: PeerJS işaretleşmesi
       ve STUN/TURN için gerekli. eval() hiçbir yerde açılmıyor. */
    if (headers['content-type'].startsWith('text/html')) {
      headers['content-security-policy'] = [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' data: blob:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        "connect-src 'self' ws: wss: https: data: blob:",
      ].join('; ');
    }
    return new Response(fs.readFileSync(file), { status: 200, headers });
  } catch {
    return new Response('not found', { status: 404 });
  }
}

function openM3rant(opts) {
  if (!fs.existsSync(path.join(M3_ROOT, 'index.html'))) {
    return { ok: false, reason: 'M3RANT dosyaları bulunamadı' };
  }
  if (m3Window && !m3Window.isDestroyed()) {
    if (m3Window.isMinimized()) m3Window.restore();
    m3Window.focus();
    return { ok: true, focused: true };
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  m3Window = new BrowserWindow({
    width: Math.min(1600, Math.round(sw * 0.92)),
    height: Math.min(900, Math.round(sh * 0.92)),
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#17110b',
    title: 'M3RANT',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      /* Oyunun hiçbir Node API'sine ihtiyacı yok, hiçbiri verilmiyor. */
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  m3Window.setMenuBarVisibility(false);
  m3Window.once('ready-to-show', () => m3Window && m3Window.show());

  /* Nişan kilidi ve tam ekran sorulmadan verilir: istek yalnızca kendi
     yerel sayfamızdan gelir ve bu bir birinci şahıs nişancı oyunu. */
  m3Window.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'pointerLock' || permission === 'fullscreen');
  });
  m3Window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  m3Window.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[m3rant] yuklenemedi ${url}: ${desc} (${code})`);
  });

  /* Oyuncu adını devret: M3RANT bunu yalnızca İLK profili oluştururken
     kullanır, sonra oyuncunun kendi seçimi geçerlidir. */
  const name = String((opts && opts.name) || '').trim().slice(0, 18);
  m3Window.loadURL('app://m3rant/index.html' + (name ? '?name=' + encodeURIComponent(name) : ''));

  m3Window.on('closed', () => { m3Window = null; });
  return { ok: true };
}

/* Tek örnek: ikinci kez açılırsa mevcut pencereyi öne getir */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle('app', serveM3);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */
ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (_e, data) => { writeStore(data); return true; });
ipcMain.handle('store:path', () => STORE_FILE());

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  isDev,
}));

ipcMain.on('win:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('win:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('win:close', () => mainWindow && mainWindow.close());
ipcMain.on('win:fullscreen', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.handle('shell:open', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});

/* ------------------------------------------------------------------ */
/* Güncelleme: GitHub Releases                                         */
/* ------------------------------------------------------------------ */
const UPDATE_REPO = 'Efesploits/playnight';
/* Sürüm bilgisi bu dosyadan okunur; kurulum dosyaları `dist` dalında durur. */
const UPDATE_BRANCH = 'main';
const UPDATE_MANIFEST = `https://raw.githubusercontent.com/${UPDATE_REPO}/${UPDATE_BRANCH}/update.json`;

/* İndirme yalnızca bu alan adlarından kabul edilir. */
const ALLOWED_HOSTS = new Set([
  'api.github.com', 'github.com', 'codeload.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com', 'release-assets.githubusercontent.com',
]);

/** Yönlendirmeleri izleyerek güvenli GET. */
function httpsGet(url, opts, depth) {
  return new Promise((resolve, reject) => {
    if ((depth || 0) > 5) return reject(new Error('Çok fazla yönlendirme'));
    let u;
    try { u = new URL(url); } catch { return reject(new Error('Geçersiz adres')); }
    if (u.protocol !== 'https:') return reject(new Error('Yalnızca HTTPS'));
    if (!ALLOWED_HOSTS.has(u.hostname)) return reject(new Error('İzin verilmeyen adres: ' + u.hostname));

    const req = https.get(u, {
      headers: Object.assign({
        'User-Agent': 'PlayNight-Updater',
        'Accept': 'application/vnd.github+json',
      }, (opts && opts.headers) || {}),
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpsGet(new URL(res.headers.location, u).toString(), opts, (depth || 0) + 1));
      }
      resolve(res);
    });
    req.on('timeout', () => { req.destroy(new Error('Zaman aşımı')); });
    req.on('error', reject);
  });
}

function readAll(res) {
  return new Promise((resolve, reject) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; if (body.length > 2e6) req_abort(); });
    res.on('end', () => resolve(body));
    res.on('error', reject);
    function req_abort() { res.destroy(); reject(new Error('Yanıt çok büyük')); }
  });
}

/** "1.2.3" karşılaştırması. a>b ise 1, a<b ise -1. */
function cmpVersion(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Sürüm kontrolü.
 * Önce depodaki `update.json` manifestine bakılır — yayınlamak için yalnızca
 * `git push` yeterli olsun diye. Manifest yoksa GitHub Releases'e düşülür.
 */
ipcMain.handle('update:check', async () => {
  const current = app.getVersion();
  const viaManifest = await checkManifest(current);
  if (viaManifest) return viaManifest;
  return checkRelease(current);
});

async function checkManifest(current) {
  try {
    /* raw.githubusercontent 5 dakika önbellekliyor; tazesini iste */
    const res = await httpsGet(`${UPDATE_MANIFEST}?t=${Date.now()}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (res.statusCode !== 200) { res.resume(); return null; }

    const data = JSON.parse(await readAll(res));
    const latest = String(data.version || '').replace(/^v/i, '');
    if (!latest) return null;

    const pick = data.setup || data.portable || null;
    return {
      ok: true,
      current,
      latest,
      available: cmpVersion(latest, current) > 0,
      notes: String(data.notes || '').slice(0, 4000),
      pageUrl: data.pageUrl || `https://github.com/${UPDATE_REPO}`,
      publishedAt: data.publishedAt || null,
      source: 'manifest',
      asset: pick && pick.url && pick.name
        ? { name: pick.name, url: pick.url, size: pick.size || 0 }
        : null,
    };
  } catch {
    return null;   // manifest okunamadı -> Releases'e düş
  }
}

async function checkRelease(current) {
  try {
    const res = await httpsGet(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`);
    if (res.statusCode === 404) { res.resume(); return { ok: true, available: false, current, reason: 'no-release' }; }
    if (res.statusCode === 403) { res.resume(); return { ok: false, current, reason: 'rate-limit' }; }
    if (res.statusCode !== 200) { res.resume(); return { ok: false, current, reason: 'http-' + res.statusCode }; }

    const data = JSON.parse(await readAll(res));
    const latest = String(data.tag_name || data.name || '').replace(/^v/i, '');
    if (!latest) return { ok: true, available: false, current, reason: 'no-tag' };

    const assets = Array.isArray(data.assets) ? data.assets : [];
    const pick = assets.find((a) => /setup.*\.exe$/i.test(a.name))
      || assets.find((a) => /\.exe$/i.test(a.name));

    return {
      ok: true,
      current,
      latest,
      available: cmpVersion(latest, current) > 0,
      notes: String(data.body || '').slice(0, 4000),
      pageUrl: data.html_url,
      publishedAt: data.published_at,
      source: 'release',
      asset: pick ? { name: pick.name, url: pick.browser_download_url, size: pick.size } : null,
    };
  } catch (err) {
    return { ok: false, current, reason: String((err && err.message) || err) };
  }
}

let downloadAbort = null;

/**
 * Kurulum dosyasını indirir.
 * Yavaş bağlantılarda kopan indirme baştan başlamasın diye yarım kalan dosya
 * korunur ve HTTP Range ile KALDIĞI YERDEN devam edilir.
 */
ipcMain.handle('update:download', async (_e, asset) => {
  if (!asset || !asset.url || !asset.name) return { ok: false, reason: 'Geçersiz dosya' };
  if (!/^[\w.\- ]+\.exe$/i.test(asset.name)) return { ok: false, reason: 'Geçersiz dosya adı' };

  const dir = path.join(os.tmpdir(), 'playnight-update');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, asset.name);
  const part = target + '.part';

  /* önceki denemeden kalan parça var mı? */
  let have = 0;
  try { have = fs.existsSync(part) ? fs.statSync(part).size : 0; } catch { have = 0; }
  if (asset.size && have >= asset.size) have = 0;          // bozuk/eski parça

  try {
    const headers = { Accept: 'application/octet-stream' };
    if (have > 0) headers.Range = `bytes=${have}-`;

    const res = await httpsGet(asset.url, { headers });

    let append = false;
    if (res.statusCode === 206) append = true;             // sunucu devamı verdi
    else if (res.statusCode === 200) { append = false; have = 0; }  // baştan
    else {
      res.resume();
      return { ok: false, reason: 'İndirilemedi (' + res.statusCode + ')' };
    }

    const remaining = parseInt(res.headers['content-length'], 10) || 0;
    const total = append ? have + remaining : (remaining || asset.size || 0);
    let got = have;
    const startedAt = Date.now();

    const out = fs.createWriteStream(part, append ? { flags: 'a' } : { flags: 'w' });
    let aborted = false;
    downloadAbort = () => { aborted = true; try { res.destroy(); out.end(); } catch {} };

    await new Promise((resolve, reject) => {
      let lastSent = 0;
      res.on('data', (chunk) => {
        got += chunk.length;
        const now = Date.now();
        if (now - lastSent > 200 && mainWindow && !mainWindow.isDestroyed()) {
          lastSent = now;
          const secs = (now - startedAt) / 1000;
          const bps = secs > 0 ? (got - have) / secs : 0;
          mainWindow.webContents.send('update:progress', {
            got, total, bps,
            eta: bps > 0 && total > got ? Math.round((total - got) / bps) : null,
            resumed: have > 0,
          });
        }
      });
      res.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      res.on('error', reject);
    });

    downloadAbort = null;
    if (aborted) return { ok: false, reason: 'İndirme durduruldu', partial: true };

    const size = fs.statSync(part).size;
    if (total && Math.abs(size - total) > 1024) {
      /* eksik indi: parçayı SAKLA, sonraki denemede devam edilsin */
      return { ok: false, reason: 'Bağlantı koptu, dosya eksik indi', partial: true, got: size, total };
    }

    fs.renameSync(part, target);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', { got: size, total: size, bps: 0, eta: 0 });
    }
    return { ok: true, path: target, size };
  } catch (err) {
    downloadAbort = null;
    /* parçayı silme — bir dahaki sefere kaldığı yerden devam etsin */
    return { ok: false, reason: String((err && err.message) || err), partial: fs.existsSync(part) };
  }
});

/** Yarım kalmış indirmeyi at (kullanıcı baştan başlatmak isterse). */
ipcMain.handle('update:clearPartial', async (_e, name) => {
  try {
    if (!/^[\w.\- ]+\.exe$/i.test(String(name || ''))) return false;
    const p = path.join(os.tmpdir(), 'playnight-update', name + '.part');
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch { return false; }
});

ipcMain.on('update:cancel', () => { if (downloadAbort) downloadAbort(); });

ipcMain.handle('update:install', async (_e, filePath) => {
  const dir = path.join(os.tmpdir(), 'playnight-update');
  const resolved = path.resolve(String(filePath || ''));
  /* yalnızca kendi indirdiğimiz dosya çalıştırılabilir */
  if (!resolved.startsWith(path.resolve(dir)) || !/\.exe$/i.test(resolved) || !fs.existsSync(resolved)) {
    return { ok: false, reason: 'Kurulum dosyası bulunamadı' };
  }
  const err = await shell.openPath(resolved);
  if (err) return { ok: false, reason: err };
  setTimeout(() => app.quit(), 1200);
  return { ok: true };
});

ipcMain.handle('m3rant:open', (_e, opts) => openM3rant(opts || {}));

ipcMain.handle('m3rant:info', () => {
  const out = { available: fs.existsSync(path.join(M3_ROOT, 'index.html')), version: null, open: false };
  out.open = !!(m3Window && !m3Window.isDestroyed());
  try {
    out.version = JSON.parse(fs.readFileSync(path.join(M3_ROOT, 'build.json'), 'utf8')).version || null;
  } catch { /* sürüm dosyası yoksa önemsiz */ }
  return out;
});

ipcMain.handle('dialog:message', async (_e, opts) => {
  if (!mainWindow) return { response: 0 };
  return dialog.showMessageBox(mainWindow, {
    type: opts?.type || 'info',
    title: opts?.title || 'Play Night',
    message: String(opts?.message || ''),
    detail: opts?.detail ? String(opts.detail) : undefined,
    buttons: Array.isArray(opts?.buttons) ? opts.buttons : ['Tamam'],
    noLink: true,
  });
});
