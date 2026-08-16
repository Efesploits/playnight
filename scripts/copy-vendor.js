/**
 * PeerJS tarayıcı paketini node_modules'tan vendor/ klasörüne kopyalar.
 * Böylece uygulama internetten script çekmez, CSP temiz kalır.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');

/* Her giris: hedef dosya adi -> aranacak kaynaklar (ilk bulunan kullanilir) */
const LIBS = [
  {
    out: 'peerjs.min.js',
    from: [
      'node_modules/peerjs/dist/peerjs.min.js',
      'node_modules/peerjs/dist/peerjs.js',
    ],
  },
  {
    /* three r149 hala UMD build veriyor; klasik <script> ile yuklenebiliyor,
       boylece file:// altinda ES module CORS sorunu yasanmiyor. */
    out: 'three.min.js',
    from: [
      'node_modules/three/build/three.min.js',
      'node_modules/three/build/three.js',
    ],
  },
];

fs.mkdirSync(VENDOR, { recursive: true });

for (const lib of LIBS) {
  const target = path.join(VENDOR, lib.out);
  const found = lib.from.map((c) => path.join(ROOT, c)).find((p) => fs.existsSync(p));

  if (found) {
    fs.copyFileSync(found, target);
    const kb = (fs.statSync(target).size / 1024).toFixed(0);
    console.log(`[vendor] ${lib.out} kopyalandi (${kb} KB) <- ${path.relative(ROOT, found)}`);
  } else if (fs.existsSync(target)) {
    console.log(`[vendor] ${lib.out} zaten mevcut, atlandi`);
  } else {
    console.error(`[vendor] UYARI: ${lib.out} kaynagi bulunamadi. "npm install" calistirin.`);
  }
}
