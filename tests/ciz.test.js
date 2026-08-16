/* Çiz Babacım motoru testleri.  Çalıştır:  node tests/ciz.test.js  */
'use strict';
const C = require('../src/js/ciz/engine.js');

let pass = 0, failCount = 0;
const fails = [];
const ok = (c, name, extra) => { if (c) pass++; else { failCount++; fails.push(name + (extra ? ' -> ' + extra : '')); } };
const eq = (a, b, name) => ok(a === b, name, `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'O' + i }));

/* -------------------------------------------------------------- kurulum */
{
  const g = C.createGame(mk(4), {});
  eq(g.n, 4, '4 oyuncu');
  eq(g.books.length, 4, 'herkese bir defter');
  eq(g.rounds, 4, '4 oyuncuda 4 tur');
  eq(g.round, 0, 'ilk tur 0');
  eq(g.phase, 'play', 'oyun aşaması');
  ok(g.books.every((b, i) => b.owner === i), 'defter sahipleri doğru');

  let threw = false;
  try { C.createGame(mk(1), {}); } catch { threw = true; }
  ok(threw, 'tek oyuncuyla oyun kurulamaz');

  eq(C.createGame(mk(2), {}).rounds, 4, '2 oyuncuda en az 4 tur');
  eq(C.createGame(mk(8), {}).rounds, 8, '8 oyuncuda 8 tur');
  eq(C.createGame(mk(4), { rounds: 6 }).rounds, 6, 'tur sayısı elle ayarlanabilir');
}

/* -------------------------------------------------------- tur türleri -- */
{
  eq(C.roundType(0), 'text', '0. tur yazı');
  eq(C.roundType(1), 'draw', '1. tur çizim');
  eq(C.roundType(2), 'text', '2. tur yazı');
  eq(C.roundType(3), 'draw', '3. tur çizim');
}

/* ------------------------------------------------- defter dolaşımı ----- */
{
  const n = 4;
  /* 0. turda herkes kendi defterine */
  for (let s = 0; s < n; s++) eq(C.bookIndexFor(s, 0, n), s, `tur0: oyuncu ${s} kendi defteri`);
  /* her turda defterler bir kayar, çakışma olmamalı */
  for (let round = 0; round < n; round++) {
    const seen = new Set();
    for (let s = 0; s < n; s++) seen.add(C.bookIndexFor(s, round, n));
    eq(seen.size, n, `tur${round}: her defter tam bir oyuncuda`);
  }
  /* bir defter aynı oyuncuya tur sayısı bitmeden ikinci kez gitmemeli */
  for (let book = 0; book < n; book++) {
    const holders = [];
    for (let round = 0; round < n; round++) {
      for (let s = 0; s < n; s++) if (C.bookIndexFor(s, round, n) === book) holders.push(s);
    }
    eq(new Set(holders).size, n, `defter ${book} her oyuncuya birer kez gitti`);
  }
}

/* ----------------------------------------------------------- gönderim -- */
{
  const g = C.createGame(mk(4), {});
  C.beginRound(g);

  const t0 = C.taskFor(g, 0);
  eq(t0.kind, 'seed', 'ilk görev serbest cümle');
  eq(t0.type, 'text', 'ilk görev yazı');
  eq(t0.source, null, 'ilk turda kaynak yok');
  eq(t0.done, false, 'henüz gönderilmedi');

  ok(!C.submit(g, 0, 1, 'yanlış tur').ok, 'yanlış tura gönderim reddedilir');
  ok(!C.submit(g, 0, 0, '   ').ok, 'boş cümle reddedilir');

  const r = C.submit(g, 0, 0, '  kaykay   süren    kedi  ');
  ok(r.ok, 'cümle gönderildi');
  ok(!r.allDone, 'herkes göndermedi');
  eq(g.books[0].steps[0].value, 'kaykay süren kedi', 'fazla boşluklar temizlenir');
  eq(C.taskFor(g, 0).done, true, 'gönderim işaretlendi');
  ok(!C.submit(g, 0, 0, 'tekrar').ok, 'iki kez gönderilemez');

  for (let s = 1; s < 4; s++) {
    const res = C.submit(g, s, 0, 'cümle ' + s);
    if (s === 3) ok(res.allDone, 'son gönderimde herkes tamam');
  }

  /* uzun metin kırpılır */
  const g2 = C.createGame(mk(2), { maxTextLen: 10 });
  C.beginRound(g2);
  C.submit(g2, 0, 0, 'bu cümle kesinlikle çok uzun');
  eq(g2.books[0].steps[0].value.length, 10, 'metin sınırı uygulanır');
}

/* --------------------------------------------------- tur ilerlemesi ---- */
{
  const g = C.createGame(mk(4), {});
  C.beginRound(g);
  for (let s = 0; s < 4; s++) C.submit(g, s, 0, 'cümle ' + s);
  const a = C.advance(g);
  eq(a.phase, 'play', 'sonraki tur oynanır');
  eq(g.round, 1, '1. tura geçildi');
  eq(g.submitted.length, 0, 'gönderimler sıfırlandı');

  /* 1. turda oyuncu 0, oyuncu 3'ün cümlesini çizer */
  const t = C.taskFor(g, 0);
  eq(t.type, 'draw', 'çizim turu');
  eq(t.kind, 'draw', 'görev çizim');
  eq(t.bookIdx, 3, 'defterler kaydı');
  eq(t.source.value, 'cümle 3', 'kaynak önceki adımdır');
  eq(t.sourceBy, 'O3', 'kaynağı yazan doğru');
}

/* ------------------------------------------------- çizim doğrulama ----- */
{
  const g = C.createGame(mk(2), { maxPoints: 8 });
  C.beginRound(g); C.submit(g, 0, 0, 'a'); C.submit(g, 1, 0, 'b'); C.advance(g);

  const dirty = { strokes: [
    { c: 3, s: 2, e: 0, p: [10, 20, 5000, -40, 300, 300] },   // taşan koordinatlar
    { c: 99, s: 99, e: 1, p: [1, 1, 2, 2] },                   // sınır dışı indeksler
    { c: 0, s: 0, e: 0, p: [7] },                              // eksik nokta -> atılır
    { c: 0, s: 0, e: 0, p: ['x', 'y', 4, 4] },                 // sayı olmayan -> atılır
  ] };
  C.submit(g, 0, 1, dirty);
  const saved = g.books[1].steps[1].value;
  ok(saved.strokes.length >= 2, 'geçerli darbeler korunur');
  const flat = saved.strokes.flatMap((s) => s.p);
  ok(flat.every((v) => Number.isInteger(v)), 'koordinatlar tamsayı');
  ok(saved.strokes.every((s) => s.p.filter((_, i) => i % 2 === 0).every((x) => x >= 0 && x <= 1000)), 'x sınırlandı');
  ok(saved.strokes.every((s) => s.p.filter((_, i) => i % 2 === 1).every((y) => y >= 0 && y <= 700)), 'y sınırlandı');
  ok(saved.strokes.every((s) => s.c >= 0 && s.c <= 31 && s.s >= 0 && s.s <= 5), 'renk/kalınlık sınırlandı');
  const totalPts = saved.strokes.reduce((a, s) => a + s.p.length / 2, 0);
  ok(totalPts <= 9, 'nokta sınırı uygulandı', 'nokta=' + totalPts);

  /* boş çizim kabul edilir (kimse boş tuvalle kilitlenmesin) */
  const r = C.submit(g, 1, 1, null);
  ok(r.ok, 'boş çizim gönderilebilir');
  eq(g.books[0].steps[1].value.strokes.length, 0, 'boş çizim boş darbe listesi');
}

/* ------------------------------------------------- süre dolması -------- */
{
  const g = C.createGame(mk(4), {});
  C.beginRound(g);
  C.submit(g, 1, 0, 'sadece ben yazdım');
  const filledSeats = C.fillMissing(g);
  eq(filledSeats.length, 3, '3 kişi yetiştiremedi');
  eq(g.submitted.length, 4, 'tüm koltuklar tamamlandı');
  ok(g.books[0].steps[0].empty, 'yetişmeyen için yer tutucu kondu');
  eq(g.books[1].steps[0].value, 'sadece ben yazdım', 'gönderen etkilenmedi');
  ok(!g.books[1].steps[0].empty, 'gönderen boş işaretlenmedi');
}

/* ----------------------------------------------------- tam oyun ------- */
{
  const n = 4;
  const g = C.createGame(mk(n), {});
  C.beginRound(g);
  for (let round = 0; round < g.rounds; round++) {
    for (let s = 0; s < n; s++) {
      const t = C.taskFor(g, s);
      const val = t.type === 'text' ? `t${round}s${s}` : { strokes: [{ c: 1, s: 1, e: 0, p: [10, 10, 90, 90] }] };
      const res = C.submit(g, s, round, val);
      ok(res.ok, `tur${round} oyuncu${s} gönderdi`, res.reason);
    }
    if (round < g.rounds - 1) {
      eq(C.advance(g).phase, 'play', `tur${round} sonrası devam`);
    }
  }
  eq(C.advance(g).phase, 'present', 'son turdan sonra sunum');
  eq(g.phase, 'present', 'sunum aşaması');
  ok(g.books.every((b) => b.steps.filter(Boolean).length === g.rounds), 'her defter tam dolu');

  /* her defterde yazı/çizim sırası doğru */
  for (const b of g.books) {
    b.steps.filter(Boolean).forEach((s, i) => {
      eq(s.type, C.roundType(i), `defter adımı ${i} türü doğru`);
    });
  }
  /* bir defterde aynı oyuncu iki kez olmasın */
  for (const b of g.books) {
    const by = b.steps.filter(Boolean).map((s) => s.by);
    eq(new Set(by).size, by.length, 'defterde her oyuncu bir kez');
  }

  /* sunum adım adım ilerler */
  let pv = C.presentView(g);
  eq(pv.bookIndex, 0, 'ilk defterden başlar');
  eq(pv.steps.length, 1, 'ilk adım açık');
  eq(pv.stepCount, g.rounds, 'toplam adım sayısı');

  let guard = 0, books = 1;
  while (guard++ < 200) {
    const r = C.presentNext(g);
    if (r.done) break;
    if (r.newBook) books++;
  }
  eq(books, n, 'tüm defterler gösterildi');
  eq(g.phase, 'done', 'sunum bitti');
  ok(C.presentNext(g).done, 'bittikten sonra ilerlemez');

  const all = C.allBooks(g);
  eq(all.length, n, 'arşivde tüm defterler');
  ok(all.every((b) => b.steps.length === g.rounds), 'arşiv adımları tam');
}

/* --------------------------------------------------- görünüm gizliliği */
{
  const g = C.createGame(mk(4), {});
  C.beginRound(g);
  C.submit(g, 0, 0, 'gizli cümlem');
  C.submit(g, 1, 0, 'başkasının cümlesi');

  const v = C.viewFor(g, 2);
  eq(v.mySeat, 2, 'kendi koltuğu');
  ok(v.task, 'görev var');
  eq(v.task.source, null, 'ilk turda kaynak yok');
  const asText = JSON.stringify(v);
  ok(asText.indexOf('gizli cümlem') === -1, 'başkasının cümlesi görünüme sızmaz');
  ok(asText.indexOf('başkasının cümlesi') === -1, 'diğer gönderimler de sızmaz');
  eq(v.players.filter((p) => p.done).length, 2, 'kimlerin gönderdiği görünür');
  eq(v.submittedCount, 2, 'gönderim sayısı doğru');

  /* 2. turda kaynak yalnızca ilgili deftere ait olmalı */
  C.submit(g, 2, 0, 'c'); C.submit(g, 3, 0, 'd');
  C.advance(g);
  const v1 = C.viewFor(g, 0);
  eq(v1.task.bookIdx, 3, 'defter kaydı');
  eq(v1.task.source.value, 'd', 'sadece kendi görevinin kaynağı');
  ok(JSON.stringify(v1).indexOf('gizli cümlem') === -1, 'diğer defterler hâlâ gizli');
}

/* ------------------------------------------------------------ süreler -- */
{
  const g = C.createGame(mk(4), { writeSeconds: 30, drawSeconds: 90, guessSeconds: 25 });
  eq(C.secondsFor(g, 0), 30, '0. tur yazma süresi');
  eq(C.secondsFor(g, 1), 90, 'çizim süresi');
  eq(C.secondsFor(g, 2), 25, 'tahmin süresi');
  C.beginRound(g);
  ok(g.deadline > Date.now() + 25000, 'süre kuruldu');
}

console.log(`\n  ${pass} test geçti, ${failCount} başarısız\n`);
if (fails.length) {
  console.log('  BAŞARISIZ:');
  for (const f of fails) console.log('   x ' + f);
  process.exit(1);
}
