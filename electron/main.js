'use strict';

const { app, BrowserWindow, ipcMain, shell, screen, dialog } = require('electron');
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

ipcMain.handle('update:download', async (_e, asset) => {
  if (!asset || !asset.url || !asset.name) return { ok: false, reason: 'Geçersiz dosya' };
  if (!/^[\w.\- ]+\.exe$/i.test(asset.name)) return { ok: false, reason: 'Geçersiz dosya adı' };

  const dir = path.join(os.tmpdir(), 'playnight-update');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, asset.name);

  try {
    const res = await httpsGet(asset.url, { headers: { Accept: 'application/octet-stream' } });
    if (res.statusCode !== 200) { res.resume(); return { ok: false, reason: 'İndirilemedi (' + res.statusCode + ')' }; }

    const total = parseInt(res.headers['content-length'], 10) || asset.size || 0;
    let got = 0;
    const out = fs.createWriteStream(target);
    downloadAbort = () => { try { res.destroy(); out.destroy(); } catch {} };

    await new Promise((resolve, reject) => {
      let lastSent = 0;
      res.on('data', (chunk) => {
        got += chunk.length;
        const now = Date.now();
        if (now - lastSent > 120 && mainWindow && !mainWindow.isDestroyed()) {
          lastSent = now;
          mainWindow.webContents.send('update:progress', { got, total });
        }
      });
      res.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      res.on('error', reject);
    });

    downloadAbort = null;
    const stat = fs.statSync(target);
    if (total && Math.abs(stat.size - total) > 1024) {
      try { fs.unlinkSync(target); } catch {}
      return { ok: false, reason: 'Dosya eksik indi' };
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', { got: stat.size, total: stat.size });
    }
    return { ok: true, path: target, size: stat.size };
  } catch (err) {
    downloadAbort = null;
    try { fs.unlinkSync(target); } catch {}
    return { ok: false, reason: String((err && err.message) || err) };
  }
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
