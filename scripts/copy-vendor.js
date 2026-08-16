/**
 * PeerJS tarayıcı paketini node_modules'tan vendor/ klasörüne kopyalar.
 * Böylece uygulama internetten script çekmez, CSP temiz kalır.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');

const candidates = [
  'node_modules/peerjs/dist/peerjs.min.js',
  'node_modules/peerjs/dist/peerjs.js',
  'node_modules/peerjs/dist/bundler.mjs',
];

fs.mkdirSync(VENDOR, { recursive: true });

const target = path.join(VENDOR, 'peerjs.min.js');
const found = candidates.map((c) => path.join(ROOT, c)).find((p) => fs.existsSync(p));

if (found) {
  fs.copyFileSync(found, target);
  const kb = (fs.statSync(target).size / 1024).toFixed(0);
  console.log(`[vendor] peerjs.min.js kopyalandi (${kb} KB) <- ${path.relative(ROOT, found)}`);
} else if (fs.existsSync(target)) {
  console.log('[vendor] peerjs.min.js zaten mevcut, atlandi');
} else {
  console.error('[vendor] UYARI: peerjs bulunamadi. "npm install" calistirin.');
  process.exitCode = 0; // derlemeyi durdurma
}
