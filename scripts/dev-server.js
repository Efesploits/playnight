/* Geliştirme sırasında arayüzü tarayıcıda önizlemek için minik statik sunucu.
   Uygulamanın kendisi Electron ile çalışır; bu yalnızca görsel test içindir. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

http.createServer((req, res) => {
  /* Geliştirme kolaylığı: tarayıcıdaki canvas çıktısını diske yazar.
     Yalnızca bu yerel önizleme sunucusunda vardır, uygulamada yoktur. */
  if (req.method === 'POST' && req.url === '/__shot') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 20e6) req.destroy(); });
    req.on('end', () => {
      try {
        const b64 = body.replace(/^data:image\/\w+;base64,/, '');
        const out = path.join(ROOT, 'dist', 'preview-shot.jpg');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end(out);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(e));
      }
    });
    return;
  }

  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/src/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 ' + rel); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`[dev] http://localhost:${PORT}`));
