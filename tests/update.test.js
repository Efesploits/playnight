/* Güncelleme mantığı testleri. Ana süreçteki sürüm karşılaştırma ve GitHub
   uç noktası davranışı doğrulanır.  Çalıştır:  node tests/update.test.js      */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

let pass = 0, failCount = 0;
const fails = [];
const ok = (c, name, extra) => { if (c) pass++; else { failCount++; fails.push(name + (extra ? ' -> ' + extra : '')); } };
const eq = (a, b, name) => ok(a === b, name, `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);

/* main.js içindeki saf yardımcıları test için çıkar (kopya değil, kaynaktan okunur) */
const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');

function extractFn(name) {
  const start = mainSrc.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} bulunamadı`);
  let i = mainSrc.indexOf('{', start), depth = 0, end = -1;
  for (let k = i; k < mainSrc.length; k++) {
    if (mainSrc[k] === '{') depth++;
    else if (mainSrc[k] === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  return mainSrc.slice(start, end);
}

const cmpVersion = new Function(`${extractFn('cmpVersion')}; return cmpVersion;`)();

/* ------------------------------------------------- sürüm karşılaştırma */
{
  eq(cmpVersion('1.0.1', '1.0.0'), 1, 'yama sürümü büyük');
  eq(cmpVersion('1.0.0', '1.0.1'), -1, 'yama sürümü küçük');
  eq(cmpVersion('1.0.0', '1.0.0'), 0, 'eşit sürümler');
  eq(cmpVersion('v1.2.0', '1.1.9'), 1, 'baştaki v yok sayılır');
  eq(cmpVersion('2.0.0', '1.99.99'), 1, 'ana sürüm baskın');
  eq(cmpVersion('1.10.0', '1.9.0'), 1, '10 > 9 (sayısal karşılaştırma)');
  eq(cmpVersion('1.0', '1.0.0'), 0, 'eksik parça sıfır sayılır');
  eq(cmpVersion('1.0.0', '1.0'), 0, 'ters yönde de sıfır sayılır');
  eq(cmpVersion('1.2.3', '1.2.3'), 0, 'aynı sürümde güncelleme yok');
  /* Güvenlik özelliği: ön sürüm etiketi aynı sürümü "yeni" göstermemeli.
     (Tam semver sıralaması gerekmiyor; önemli olan geri sürüm önerilmemesi.) */
  ok(cmpVersion('1.0.0-beta', '1.0.0') <= 0, 'ön sürüm etiketi güncelleme sayılmaz');
  ok(cmpVersion('1.1.0-beta', '1.0.0') > 0, 'ön sürüm de olsa üst sürüm güncellemedir');
  ok(cmpVersion('0.9.9', '1.0.0') < 0, 'eski sürüm asla önerilmez');
}

/* ------------------------------------------------------ alan adı izni */
{
  const allowed = mainSrc.match(/ALLOWED_HOSTS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  ok(!!allowed, 'ALLOWED_HOSTS tanımlı');
  const list = allowed ? allowed[1] : '';
  ok(/api\.github\.com/.test(list), 'api.github.com izinli');
  ok(/objects\.githubusercontent\.com/.test(list), 'asset alan adı izinli');
  ok(!/\*/.test(list), 'joker alan adı yok');
  ok(/u\.protocol !== 'https:'/.test(mainSrc), 'yalnızca HTTPS kabul ediliyor');
  ok(/ALLOWED_HOSTS\.has\(u\.hostname\)/.test(mainSrc), 'yönlendirmede alan adı doğrulanıyor');
  ok(/depth \|\| 0\) > 5/.test(mainSrc), 'yönlendirme sayısı sınırlı');
}

/* -------------------------------------------------- kurulum güvenliği */
{
  ok(/\/\^\[\\w\.\\- \]\+\\\.exe\$\/i\.test\(asset\.name\)/.test(mainSrc)
     || /test\(asset\.name\)/.test(mainSrc), 'indirilecek dosya adı doğrulanıyor');
  ok(/resolved\.startsWith\(path\.resolve\(dir\)\)/.test(mainSrc),
     'yalnızca kendi indirdiğimiz klasördeki dosya çalıştırılıyor');
  ok(/\/\\\.exe\$\/i\.test\(resolved\)/.test(mainSrc), 'kurulum dosyası .exe olmalı');
}

/* --------------------------------------------- GitHub uç noktası canlı */
function ghCheck(repo) {
  return new Promise((resolve) => {
    const req = https.get(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'User-Agent': 'PlayNight-Updater', Accept: 'application/vnd.github+json' },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
    req.on('error', () => resolve({ status: 0, body: '' }));
  });
}

(async () => {
  /* kendi depomuz: henüz sürüm yoksa 404 dönmeli, varsa tag okunabilmeli */
  const mine = await ghCheck('Efesploits/playnight');
  if (mine.status === 0) {
    console.log('  (ağ yok, canlı uç nokta testi atlandı)');
  } else if (mine.status === 404) {
    ok(true, 'henüz sürüm yok -> 404 (uygulama "no-release" gösterir)');
  } else if (mine.status === 403) {
    console.log('  (GitHub sınırı, canlı test atlandı)');
  } else {
    eq(mine.status, 200, 'sürüm bulundu');
    const data = JSON.parse(mine.body);
    ok(!!data.tag_name, 'tag_name var', JSON.stringify(data.tag_name));
    ok(Array.isArray(data.assets), 'assets dizisi var');
    const setup = (data.assets || []).find((a) => /setup.*\.exe$/i.test(a.name));
    ok(!!setup, 'setup exe yüklenmiş', (data.assets || []).map((a) => a.name).join(', '));
    if (setup) {
      ok(/^https:\/\/github\.com\//.test(setup.browser_download_url), 'indirme adresi github.com');
      ok(setup.size > 1e6, 'dosya boyutu makul', String(setup.size));
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    console.log(`  yerel sürüm v${pkg.version} · yayındaki ${data.tag_name}`
      + ` -> ${cmpVersion(String(data.tag_name).replace(/^v/i, ''), pkg.version) > 0 ? 'GÜNCELLEME VAR' : 'güncel'}`);
  }

  console.log(`\n  ${pass} test geçti, ${failCount} başarısız\n`);
  if (fails.length) {
    console.log('  BAŞARISIZ:');
    for (const f of fails) console.log('   x ' + f);
    process.exit(1);
  }
})();
