/**
 * Play Night ikon üreteci.
 * Bağımlılık kullanmadan, sıfırdan PNG + ICO üretir (zlib Node içinde gömülü).
 * Çıktı: build/icon.ico  ve  src/assets/logo.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

/* ---------- küçük yardımcılar ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------- PNG kodlayıcı ---------- */
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- ikon çizimi ---------- */
/**
 * Koyu lacivert yuvarlatılmış kare + mavi ışıma + neon "play" üçgeni + ay hilali.
 */
function drawIcon(S) {
  const rgba = Buffer.alloc(S * S * 4);
  const R = S * 0.235;          // köşe yarıçapı
  const AA = S / 128;           // kenar yumuşatma genişliği
  const cx = S / 2, cy = S / 2;

  // play üçgeni geometrisi (eşkenar, sağa bakan)
  const tSize = S * 0.30;
  const tcx = S * 0.525, tcy = S * 0.5;
  const p1 = [tcx - tSize * 0.52, tcy - tSize * 0.92];
  const p2 = [tcx - tSize * 0.52, tcy + tSize * 0.92];
  const p3 = [tcx + tSize * 0.96, tcy];

  const sdTri = (px, py) => {
    // noktanın üçgene işaretli mesafesi (yaklaşık, kenar mesafelerinin maksimumu)
    const edge = (a, b) => {
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const len = Math.hypot(ex, ey);
      return ((px - a[0]) * ey - (py - a[1]) * ex) / len;
    };
    return Math.max(edge(p1, p2), edge(p2, p3), edge(p3, p1));
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5, py = y + 0.5;

      /* --- yuvarlatılmış kare maskesi --- */
      const qx = Math.abs(px - cx) - (S / 2 - R);
      const qy = Math.abs(py - cy) - (S / 2 - R);
      const sdBox = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
      const inBox = 1 - smooth(-AA, AA, sdBox);
      if (inBox <= 0.002) { continue; }

      /* --- arkaplan: köşegen gradyan (siyah -> derin mavi) --- */
      const g = clamp((px / S) * 0.55 + (py / S) * 0.45, 0, 1);
      let r = lerp(6, 11, g);
      let gg = lerp(10, 30, g);
      let b = lerp(22, 74, g);

      /* --- merkezden yayılan mavi ışıma --- */
      const d = Math.hypot(px - S * 0.56, py - S * 0.46) / (S * 0.62);
      const glow = Math.pow(clamp(1 - d, 0, 1), 2.4);
      r += 18 * glow; gg += 92 * glow; b += 190 * glow;

      /* --- üst kenar highlight (cam efekti) --- */
      const rim = Math.pow(clamp(1 - Math.abs(sdBox + S * 0.012) / (S * 0.012), 0, 1), 1.5);
      r += 40 * rim; gg += 110 * rim; b += 190 * rim;

      /* --- ışıyan halka --- */
      const ringR = S * 0.335;
      const ringD = Math.abs(Math.hypot(px - cx, py - cy) - ringR);
      const ring = Math.pow(clamp(1 - ringD / (S * 0.030), 0, 1), 2.0) * 0.55;
      r += 30 * ring; gg += 150 * ring; b += 255 * ring;

      /* --- play üçgeni --- */
      const st = sdTri(px, py);
      const triFill = 1 - smooth(-AA, AA, st);
      const triGlow = Math.pow(clamp(1 - Math.max(st, 0) / (S * 0.075), 0, 1), 2.0);
      r += 60 * triGlow * (1 - triFill); gg += 190 * triGlow * (1 - triFill); b += 255 * triGlow * (1 - triFill);
      if (triFill > 0) {
        const ty = clamp((py - (tcy - tSize)) / (tSize * 2), 0, 1);
        r = lerp(r, lerp(235, 130, ty), triFill);
        gg = lerp(gg, lerp(252, 215, ty), triFill);
        b = lerp(b, lerp(255, 255, ty), triFill);
      }

      const i = (y * S + x) * 4;
      rgba[i] = clamp(Math.round(r), 0, 255);
      rgba[i + 1] = clamp(Math.round(gg), 0, 255);
      rgba[i + 2] = clamp(Math.round(b), 0, 255);
      rgba[i + 3] = Math.round(clamp(inBox, 0, 1) * 255);
    }
  }
  return rgba;
}

/* ---------- ICO paketleyici (gömülü PNG) ---------- */
function buildICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);            // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, idx) => {
    const o = idx * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0; dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);         // color planes
    dir.writeUInt16LE(32, o + 6);        // bpp
    dir.writeUInt32BE(0, o + 8);
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/* ---------- çalıştır ---------- */
function main() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const entries = sizes.map((size) => ({ size, png: encodePNG(size, size, drawIcon(size)) }));

  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'src', 'assets'), { recursive: true });

  fs.writeFileSync(path.join(ROOT, 'build', 'icon.ico'), buildICO(entries));
  fs.writeFileSync(path.join(ROOT, 'src', 'assets', 'logo.png'), encodePNG(256, 256, drawIcon(256)));

  console.log('[icon] build/icon.ico ve src/assets/logo.png olusturuldu');
}

main();
