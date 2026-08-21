/**
 * PLAY NIGHT — M3RANT'ı içeri al
 *
 *   node scripts/sync-m3rant.js
 *
 * M3RANT ayrı bir depo (Vite + TypeScript). Derlenmiş hâli burada
 * `vendor/m3rant/` altında tutulur ve depoya işlenir; böylece Play Night
 * tek başına derlenebilir, yan klasörün varlığına bağlı kalmaz.
 *
 * Bu betik komşu klasörde M3RANT kaynağı varsa onu yeniden derleyip kopyalar,
 * yoksa elindekiyle sessizce devam eder. `npm run prepare-assets` her derlemede
 * çağırır — kaynak yoksa yayın yine de çalışır.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'vendor', 'm3rant');
const SRC_REPO = path.join(ROOT, '..', 'm3rant');
const SRC_DIST = path.join(SRC_REPO, 'dist');

const has = (p) => fs.existsSync(p);

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(a, b);
    else fs.copyFileSync(a, b);
  }
}

function bytes(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? bytes(p) : fs.statSync(p).size;
  }
  return total;
}

/* Kaynak depo yoksa: elimizdekiyle devam. */
if (!has(SRC_REPO)) {
  if (has(DEST)) {
    console.log('  [m3rant] kaynak depo yok, vendor/m3rant olduğu gibi kullanılıyor');
    process.exit(0);
  }
  console.error('  [m3rant] HATA: ne kaynak depo ne de vendor/m3rant var');
  process.exit(1);
}

/* Kaynak varsa taze derle — vendor'daki kopya asla eskimesin. */
if (has(path.join(SRC_REPO, 'node_modules'))) {
  console.log('  [m3rant] kaynaktan derleniyor…');
  try {
    /* Windows'ta npm bir .cmd; kabuk açmadan doğrudan onu çağır
       (shell:true + argüman geçmek kaçışsız birleştirme demek). */
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
      cwd: SRC_REPO, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error('  [m3rant] derleme başarısız:', err.message);
    if (!has(DEST)) process.exit(1);
    console.log('  [m3rant] önceki kopya korunuyor');
    process.exit(0);
  }
} else {
  console.log('  [m3rant] node_modules yok, mevcut dist kopyalanıyor');
}

if (!has(SRC_DIST)) {
  console.error('  [m3rant] HATA: ' + SRC_DIST + ' yok');
  process.exit(has(DEST) ? 0 : 1);
}

fs.rmSync(DEST, { recursive: true, force: true });
copyTree(SRC_DIST, DEST);

/* Kaynak sürümünü de yaz: uygulama "hangi yapı?" diye sorabilsin. */
let version = '0.0.0';
try {
  version = JSON.parse(fs.readFileSync(path.join(SRC_REPO, 'package.json'), 'utf8')).version || version;
} catch { /* sürüm bilinmiyorsa önemsiz */ }
fs.writeFileSync(path.join(DEST, 'build.json'),
  JSON.stringify({ version, syncedAt: new Date().toISOString() }, null, 2) + '\n');

console.log(`  [m3rant] v${version} alındı — ${(bytes(DEST) / 1048576).toFixed(2)} MB`);
