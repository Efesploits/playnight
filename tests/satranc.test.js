/* Satranç motoru testleri.  Çalıştır:  node tests/satranc.test.js  */
'use strict';
const S = require('../src/js/satranc/engine.js');
const Bot = require('../src/js/satranc/bot.js');

let pass = 0, failCount = 0;
const fails = [];
const ok = (c, name, extra) => { if (c) pass++; else { failCount++; fails.push(name + (extra ? ' -> ' + extra : '')); } };
const eq = (a, b, name) => ok(a === b, name, `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);

const I = S.algToI;   // "e4" -> 0..63
const mk2 = () => [{ id: 'a', name: 'Ali' }, { id: 'b', name: 'Banu' }];
const mk4 = (teams) => ['Ali', 'Banu', 'Can', 'Didem'].map((n, i) => ({
  id: 'p' + i, name: n, team: teams ? teams[i] : i % 2,
}));

/* ---------------------------------------------------------------- perft */
{
  const CASES = [
    ['başlangıç', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['pozisyon 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['pozisyon 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['pozisyon 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ];
  for (const [name, fen, expected] of CASES) {
    const st = S.parseFen(fen);
    expected.forEach((e, d) => eq(S.perft(st, d + 1), e, `perft ${name} d${d + 1}`));
    eq(S.toFen(st), fen, `fen gidiş-dönüş ${name}`);
  }
}

/* ------------------------------------------------------------ mat / pat */
{
  /* çoban matına bir hamle kala */
  const st = S.parseFen('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  const m = S.legalMoves(st).find((x) => S.to64(x.to) === I('f7') && Math.abs(x.piece) === S.Q);
  ok(m, 'Vxf7 üretildi');
  eq(S.san(st, m), 'Qxf7#', 'SAN mat işareti');
  S.makeMove(st, m);
  eq(S.legalMoves(st).length, 0, 'mat sonrası hamle yok');
  ok(S.inCheck(st, S.BL), 'siyah şah tehditte');

  /* klasik pat */
  const pat = S.parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  eq(S.legalMoves(pat).length, 0, 'patta hamle yok');
  ok(!S.inCheck(pat, S.BL), 'patta şah tehditte değil');
}

/* ------------------------------------------------------------------ SAN */
{
  /* iki at aynı kareye gidebiliyor: dosya ile ayrıştır */
  const st = S.parseFen('k7/8/8/8/8/2N1N3/8/K7 w - - 0 1');
  const m = S.legalMoves(st).find((x) => S.to64(x.from) === I('c3') && S.to64(x.to) === I('d5'));
  eq(S.san(st, m), 'Ncd5', 'at belirsizliği dosyayla çözülür');

  /* rok yazımı */
  const rk = S.parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const oo = S.legalMoves(rk).find((x) => (x.flags & 4) && x.to > x.from);
  const ooo = S.legalMoves(rk).find((x) => (x.flags & 4) && x.to < x.from);
  eq(S.san(rk, oo), 'O-O', 'kısa rok');
  eq(S.san(rk, ooo), 'O-O-O', 'uzun rok');

  /* terfi yazımı (şah çekmeyen pozisyon) */
  const pr = S.parseFen('8/P7/8/7k/8/8/8/6K1 w - - 0 1');
  const promo = S.legalMoves(pr).find((x) => x.promo === S.Q);
  eq(S.san(pr, promo), 'a8=Q', 'terfi yazımı');
}

/* ------------------------------------------------------- rok kısıtları */
{
  /* şah tehditteyken rok yok */
  const st = S.parseFen('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1');
  ok(!S.legalMoves(st).some((m) => m.flags & 4), 'şah tehditteyken rok üretilmez');

  /* geçilen kare tehditli: o kanada rok yok */
  const st2 = S.parseFen('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
  const roks = S.legalMoves(st2).filter((m) => m.flags & 4);
  eq(roks.length, 1, 'yalnız uzun rok kaldı');
  ok(roks[0].to < roks[0].from, 'kalan rok vezir kanadına');
}

/* ------------------------------------------------------ geçerken alma -- */
{
  const m = S.createGame(mk2(), { mode: '1v1', rounds: 1, minutes: 0 });
  S.startRound(m, 1);
  ok(S.move(m, 0, I('e2'), I('e4')).ok, 'e4');
  ok(S.move(m, 1, I('a7'), I('a6')).ok, 'a6');
  ok(S.move(m, 0, I('e4'), I('e5')).ok, 'e5');
  ok(S.move(m, 1, I('d7'), I('d5')).ok, 'd5 (iki kare)');
  const r = S.move(m, 0, I('e5'), I('d6'));
  ok(r.ok, 'geçerken alma yapıldı');
  eq(r.san, 'exd6', 'geçerken alma SAN');
  const v = S.viewFor(m, 0);
  eq(v.board[I('d5')], 0, 'alınan piyon tahtadan kalktı');
  eq(v.board[I('d6')], S.P, 'alan piyon d6da');
  eq(v.captured.w.length, 1, 'beyazın aldığı taş kaydedildi');
}

/* ----------------------------------------------------- 50 hamle / tekrar */
{
  const m = S.createGame(mk2(), { mode: '1v1', rounds: 1, minutes: 0 });
  S.startRound(m, 1);
  /* atlar gidip gelirse aynı pozisyon üçüncü kez oluşur */
  const seq = [
    ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'],
    ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'],
  ];
  let last = null;
  for (const [f, t] of seq) {
    last = S.move(m, m.round.st.turn === S.W ? 0 : 1, I(f), I(t));
    if (last.finished) break;
  }
  ok(last && last.finished, 'üç tekrar tespit edildi');
  eq(m.round.result.reason, 'üç tekrar', 'sebep üç tekrar');
  eq(m.round.result.winner, null, 'tekrar beraberliği');
}

/* ---------------------------------------------------- yetersiz materyal */
{
  ok(S.insufficientMaterial(S.parseFen('8/8/4k3/8/8/3K4/8/8 w - - 0 1')), 'K-K ölü');
  ok(S.insufficientMaterial(S.parseFen('8/8/4k3/8/8/3KB3/8/8 w - - 0 1')), 'K+F-K ölü');
  ok(!S.insufficientMaterial(S.parseFen('8/8/4k3/8/8/3KP3/8/8 w - - 0 1')), 'piyonla ölü değil');
  ok(!S.hasMatingMaterial(S.parseFen('8/8/4k3/8/8/3KB3/8/8 w - - 0 1'), S.W) === false
    || true, 'yardımcı'); // hasMatingMaterial tek hafif taşla false olmalı:
  eq(S.hasMatingMaterial(S.parseFen('8/8/4k3/8/8/3KB3/8/8 w - - 0 1'), S.W), false, 'tek fil mat edemez');
  eq(S.hasMatingMaterial(S.parseFen('8/8/4k3/8/8/3KP3/8/8 w - - 0 1'), S.W), true, 'piyon terfiyle mat edebilir');
}

/* ------------------------------------------------------------- saat ---- */
{
  const m = S.createGame(mk2(), { mode: '1v1', rounds: 1, minutes: 1, increment: 2 });
  const t0 = 1000000;
  S.startRound(m, 1, t0);
  eq(m.round.clocks.w, 60000, 'beyaz saati 1 dk');

  /* 10 sn düşün, hamle yap: 50 sn kalır + 2 sn eklenir */
  const r = S.move(m, 0, I('e2'), I('e4'), 0, t0 + 10000);
  ok(r.ok, 'hamle tamam');
  eq(m.round.clocks.w, 52000, 'süre düştü + artış eklendi');

  /* siyah süresini bitirsin */
  const end = S.tickClock(m, t0 + 10000 + 61000);
  ok(end && end.finished, 'bayrak düştü');
  eq(m.round.result.winner, 'w', 'süreden beyaz kazandı');
  eq(m.round.result.reason, 'süre', 'sebep süre');

  /* bayrak ama rakipte yalnız şah: berabere */
  const m2 = S.createGame(mk2(), { mode: '1v1', rounds: 1, minutes: 1 });
  S.startRound(m2, 1, t0);
  m2.round.st = S.parseFen('7k/8/8/8/8/8/8/K7 w - - 0 1');
  const end2 = S.tickClock(m2, t0 + 61000);
  ok(end2 && end2.finished, 'bayrak düştü (2)');
  eq(m2.round.result.winner, null, 'çıplak şaha karşı süre = berabere');
}

/* ------------------------------------------------------------ 1v1 akışı */
{
  const m = S.createGame(mk2(), { mode: '1v1', rounds: 2, minutes: 0 });
  S.startRound(m, 1);
  eq(m.round.whiteTeam, 0, 'ilk oyunda 0. koltuk beyaz');
  ok(!S.move(m, 1, I('e7'), I('e5')).ok, 'sıra beyazdayken siyah oynayamaz');
  ok(S.move(m, 0, I('e2'), I('e4')).ok, 'beyaz açtı');
  ok(!S.move(m, 0, I('d2'), I('d4')).ok, 'beyaz üst üste oynayamaz');
  ok(S.resign(m, 1).ok, 'siyah terk etti');
  eq(m.round.result.winner, 'w', 'terk: beyaz kazandı');
  S.applyResult(m);
  eq(m.score[0], 1, 'takım 0 puan aldı');
  ok(!m.over, 'maç sürüyor (2 oyun)');

  S.startRound(m, 2);
  eq(m.round.whiteTeam, 1, 'ikinci oyunda renkler değişti');
  ok(S.move(m, 1, I('e2'), I('e4')).ok, 'artık beyaz 1. koltukta');
}

/* ------------------------------------------------------------ 2v2 akışı */
{
  const m = S.createGame(mk4([0, 0, 1, 1]), { mode: '2v2', rounds: 1, minutes: 0 });
  S.startRound(m, 1);
  /* takım 0 beyaz: 0 ve 1 koltukları */
  ok(S.move(m, 0, I('e2'), I('e4')).ok, 'takım üyesi 1 oynadı');
  ok(!S.move(m, 1, I('d2'), I('d4')).ok, 'aynı takım üst üste oynayamaz');
  ok(S.move(m, 2, I('e7'), I('e5')).ok, 'rakip takım oynadı');
  ok(S.move(m, 1, I('g1'), I('f3')).ok, 'takımın DİĞER üyesi de oynayabilir');

  /* takım dengesi doğrulanır */
  let threw = false;
  try { S.createGame(mk4([0, 0, 0, 1]), { mode: '2v2', rounds: 1 }); } catch { threw = true; }
  ok(threw, '3-1 takım reddedilir');
  threw = false;
  try { S.createGame(mk2(), { mode: '2v2', rounds: 1 }); } catch { threw = true; }
  ok(threw, '2v2 iki kişiyle kurulamaz');
}

/* ------------------------------------------------- fikir verme + gizlilik */
{
  const m = S.createGame(mk4([0, 0, 1, 1]), { mode: '2v2', rounds: 1, minutes: 0 });
  S.startRound(m, 1);

  /* sıra bizde: fikir yasal olmalı */
  ok(!S.suggestMove(m, 0, I('e2'), I('e5')).ok, 'yasadışı fikir reddedilir (sıra bizdeyken)');
  ok(S.suggestMove(m, 0, I('e2'), I('e4')).ok, 'yasal fikir kabul');
  ok(!S.suggestMove(m, 0, I('e7'), I('e5')).ok, 'rakip taşla fikir verilemez');

  /* rakip sırasında plan yapmak serbest */
  ok(S.move(m, 1, I('e2'), I('e4')).ok, 'takım arkadaşı oynadı');
  eq(Object.keys(m.round.suggests).length, 0, 'hamleyle fikirler temizlendi');
  ok(S.suggestMove(m, 0, I('g1'), I('f3')).ok, 'sıra rakipteyken plan yapılabilir');

  /* GİZLİLİK: fikir yalnızca kendi takımının görünümünde */
  const vMate = S.viewFor(m, 1);
  const vOpp1 = S.viewFor(m, 2);
  const vOpp2 = S.viewFor(m, 3);
  eq(vMate.suggests.length, 1, 'takım arkadaşı fikri görür');
  eq(vMate.suggests[0].from, I('g1'), 'fikir içeriği doğru');
  eq(vOpp1.suggests.length, 0, 'rakip 1 fikri GÖREMEZ');
  eq(vOpp2.suggests.length, 0, 'rakip 2 fikri GÖREMEZ');

  /* görünüm JSON'unda fikir kareleri sızmıyor mu (derin tarama) */
  const raw = JSON.stringify(vOpp1);
  ok(!raw.includes('"suggests":[{'), 'rakip görünümünde fikir verisi yok');

  /* 1v1'de fikir kapalı */
  const m2 = S.createGame(mk2(), { mode: '1v1', rounds: 1 });
  S.startRound(m2, 1);
  ok(!S.suggestMove(m2, 0, I('e2'), I('e4')).ok, '1v1de fikir verme yok');

  /* fikri geri al */
  S.suggestMove(m, 0, I('g1'), I('f3'));
  S.clearSuggest(m, 0);
  eq(S.viewFor(m, 1).suggests.length, 0, 'fikir geri alındı');
}

/* --------------------------------------------------------- beraberlik -- */
{
  const m = S.createGame(mk4([0, 1, 0, 1]), { mode: '2v2', rounds: 1, minutes: 0 });
  S.startRound(m, 1);
  ok(S.offerDraw(m, 0).ok, 'teklif verildi');
  ok(!S.offerDraw(m, 2).ok, 'ikinci teklif reddedilir');
  ok(!S.answerDraw(m, 2, true).ok, 'takım arkadaşı kendi teklifine cevap veremez');
  const acc = S.answerDraw(m, 1, true);
  ok(acc.ok && acc.finished, 'rakip kabul etti');
  eq(m.round.result.reason, 'anlaşma', 'anlaşmalı berabere');
  S.applyResult(m);
  eq(m.score[0], 0.5, 'yarım puan takım 0');
  eq(m.score[1], 0.5, 'yarım puan takım 1');
  eq(m.winner, null, 'maç berabere');
}

/* -------------------------------------------------------- terfi hamlesi */
{
  const m = S.createGame(mk2(), { mode: '1v1', rounds: 1, minutes: 0 });
  S.startRound(m, 1);
  m.round.st = S.parseFen('8/P6k/8/8/8/8/7K/8 w - - 0 1');
  const r = S.move(m, 0, I('a7'), I('a8'), S.N);
  ok(r.ok, 'at terfisi yapıldı');
  eq(m.round.st.b[S.to88(I('a8'))], S.N, 'a8de at var');
  const r2 = S.viewFor(m, 0);
  eq(r2.board[I('a8')], S.N, 'görünümde de at');
}

/* -------------------------------------------------- görünüm bütünlüğü -- */
{
  const m = S.createGame(mk4([0, 0, 1, 1]), { mode: '2v2', rounds: 2, minutes: 10 });
  S.startRound(m, 1);
  const v = S.viewFor(m, 2);
  eq(v.board.length, 64, 'tahta 64 kare');
  eq(v.mySide, 'b', 'takım 1 ilk oyunda siyah');
  eq(v.legal.length, 0, 'sıra değilken yasal liste boş');
  const v0 = S.viewFor(m, 0);
  eq(v0.legal.length, 20, 'beyazın 20 açılış hamlesi');
  ok(v0.players.every((p) => p.side === (p.team === 0 ? 'w' : 'b')), 'taraflar doğru');
  eq(v0.clocks.w, 600000, 'saat görünümde');
}

/* ---------------------------------------------------------- bot akıllı mı */
{
  /* bot tek hamlelik matı bulmalı */
  const st = S.parseFen('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  const mv = Bot.pickMove(st, 2, 42);
  eq(S.alg(mv.to), 'f7', 'bot çoban matını görüyor');

  /* bot bedava veziri almalı */
  const st2 = S.parseFen('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
  const mv2 = Bot.pickMove(st2, 1, 7);
  eq(S.alg(mv2.to), 'd5', 'bot veziri alıyor');
}

console.log(`\n  ${pass} test geçti, ${failCount} başarısız\n`);
if (fails.length) {
  console.log('  BAŞARISIZ:');
  for (const f of fails) console.log('   x ' + f);
  process.exit(1);
}
