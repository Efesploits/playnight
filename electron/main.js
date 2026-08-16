'use strict';

const { app, BrowserWindow, ipcMain, shell, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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
  },
  stats: { okey101: { played: 0, won: 0, bestScore: null } },
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
