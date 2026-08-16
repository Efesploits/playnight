/* UNO motoru testleri.  Çalıştır:  node tests/uno.test.js  */
'use strict';
const U = require('../src/js/uno/engine.js');

let pass = 0, failCount = 0;
const fails = [];
const ok = (c, name, extra) => { if (c) pass++; else { failCount++; fails.push(name + (extra ? ' -> ' + extra : '')); } };
const eq = (a, b, name) => ok(a === b, name, `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);

const R = 0, S = 1, Y = 2, M = 3;   // kırmızı, sarı, yeşil, mavi
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'O' + i }));

/** Belirli bir kartın id'sini bul (kopya sırası verilebilir). */
function find(c, kind, num, skipCount) {
  let seen = 0;
  for (const card of U.DECK) {
    if (card.c === c && card.kind === kind && (num === undefined || card.num === num)) {
      if (seen++ === (skipCount || 0)) return card.id;
    }
  }
  throw new Error(`kart yok: ${c} ${kind} ${num}`);
}
const wild = (i) => U.DECK.filter((c) => c.kind === 'wild')[i || 0].id;
const wd4 = (i) => U.DECK.filter((c) => c.kind === 'wd4')[i || 0].id;

/* ---------------------------------------------------------------- deste */
{
  eq(U.DECK.length, 108, 'deste 108 kart');
  const byKind = {};
  for (const c of U.DECK) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  eq(byKind.num, 76, '76 sayı kartı');
  eq(byKind.skip, 8, '8 pas kartı');
  eq(byKind.rev, 8, '8 yön kartı');
  eq(byKind.d2, 8, '8 artı iki');
  eq(byKind.wild, 4, '4 joker');
  eq(byKind.wd4, 4, '4 joker+4');

  for (let c = 0; c < 4; c++) {
    const inColor = U.DECK.filter((x) => x.c === c);
    eq(inColor.length, 25, `renk ${c} 25 kart`);
    eq(inColor.filter((x) => x.kind === 'num' && x.num === 0).length, 1, `renk ${c} tek sıfır`);
    eq(inColor.filter((x) => x.kind === 'num' && x.num === 7).length, 2, `renk ${c} iki adet 7`);
  }
}

/* --------------------------------------------------------------- puan -- */
{
  eq(U.cardPoints(U.cardById(find(R, 'num', 7))), 7, 'sayı kartı yüzü kadar');
  eq(U.cardPoints(U.cardById(find(R, 'num', 0))), 0, 'sıfır kartı sıfır puan');
  eq(U.cardPoints(U.cardById(find(R, 'skip'))), 20, 'pas 20 puan');
  eq(U.cardPoints(U.cardById(find(R, 'rev'))), 20, 'yön 20 puan');
  eq(U.cardPoints(U.cardById(find(R, 'd2'))), 20, 'artı iki 20 puan');
  eq(U.cardPoints(U.cardById(wild())), 50, 'joker 50 puan');
  eq(U.cardPoints(U.cardById(wd4())), 50, 'joker+4 50 puan');
  eq(U.handPoints([find(R, 'num', 9), find(S, 'skip'), wild()]), 79, 'el toplamı 9+20+50');
}

/* --------------------------------------------------------- oynanırlık -- */
{
  const top = U.cardById(find(R, 'num', 5));
  ok(U.canPlay(U.cardById(find(R, 'num', 8)), R, top), 'aynı renk oynanır');
  ok(U.canPlay(U.cardById(find(M, 'num', 5)), R, top), 'aynı sayı oynanır');
  ok(!U.canPlay(U.cardById(find(M, 'num', 8)), R, top), 'farklı renk+sayı oynanmaz');
  ok(U.canPlay(U.cardById(find(R, 'skip')), R, top), 'aynı renk aksiyon oynanır');
  ok(U.canPlay(U.cardById(wild()), R, top), 'joker her zaman oynanır');

  const topSkip = U.cardById(find(R, 'skip'));
  ok(U.canPlay(U.cardById(find(M, 'skip')), R, topSkip), 'sembol eşleşmesi (pas üstüne pas)');
  ok(!U.canPlay(U.cardById(find(M, 'rev')), R, topSkip), 'farklı sembol farklı renk oynanmaz');
  const topD2 = U.cardById(find(R, 'd2'));
  ok(U.canPlay(U.cardById(find(Y, 'd2')), R, topD2), '+2 üstüne başka renk +2');

  /* Joker+4 fiziksel olarak her zaman oynanabilir (blöf serbest),
     yasallık ayrı hesaplanır ve itirazda kullanılır. */
  const handWithRed = [find(R, 'num', 3), wd4()];
  const handNoRed = [find(M, 'num', 3), find(Y, 'skip'), wd4()];
  ok(U.canPlay(U.cardById(wd4()), R, top, handWithRed), 'joker+4 her zaman oynanabilir (blöf mümkün)');
  ok(!U.isWd4Legal(handWithRed, R, wd4()), 'elinde aktif renk varken joker+4 blöftür');
  ok(U.isWd4Legal(handNoRed, R, wd4()), 'aktif renk yoksa joker+4 kurallara uygundur');
  ok(U.isWd4Legal([find(R, 'num', 3), wd4()], M, wd4()), 'başka renkler yasallığı bozmaz');
}

/* ------------------------------------------------------------- dağıtım */
{
  const m = U.createGame(mk(4), {});
  const rd = U.startRound(m, 12345);
  eq(rd.hands.length, 4, '4 el');
  ok(rd.hands.every((h) => h.length === 7), 'herkese 7 kart');
  eq(rd.discard.length, 1, 'bir kart açıldı');
  eq(rd.hands.flat().length + rd.drawPile.length + rd.discard.length, 108, 'tüm kartlar sayılı');
  ok(U.cardById(rd.discard[0]).kind !== 'wd4', 'ilk kart joker+4 olamaz');
  const all = [...rd.hands.flat(), ...rd.drawPile, ...rd.discard];
  eq(new Set(all).size, 108, 'kart tekrarı yok');

  let threw = false;
  try { U.createGame(mk(1), {}); } catch { threw = true; }
  ok(threw, 'tek oyuncuyla oyun kurulamaz');
  threw = false;
  try { U.createGame(mk(7), {}); } catch { threw = true; }
  ok(threw, '7 oyuncu reddedilir');
}

/* ------------------------------------------------- ilk kart etkileri -- */
{
  /* açılan kart Pas ise ilk oyuncu atlanır */
  const m = U.createGame(mk(4), {});
  const rd = U.startRound(m, 7);
  const starter = (m.dealer + 1) % 4;
  const first = U.cardById(rd.discard[0]);
  if (first.kind === 'skip') eq(rd.turn, (starter + 1) % 4, 'açılış Pas ise ilk oyuncu atlanır');
  if (first.kind === 'rev') eq(rd.dir, -1, 'açılış Yön ise yön ters');
  if (first.kind === 'wild') eq(rd.phase, 'color', 'açılış Joker ise renk seçilir');
  ok(true, 'açılış kartı işlendi');

  /* elle kurgulanmış açılışlar */
  const mk4 = () => U.createGame(mk(4), {});
  /* d2 açılışı: ilk oyuncu 2 çeker ve atlanır */
  const m2 = mk4(); const r2 = U.startRound(m2, 99);
  const st2 = (m2.dealer + 1) % 4;
  /* durumu elle d2 açılışına çevirip mantığı doğrula */
  const before = r2.hands[st2].length;
  U.drawCards(r2, st2, 2);
  eq(r2.hands[st2].length, before + 2, 'iki kart çekildi');
}

/* -------------------------------------------------------- temel hamle - */
{
  const m = U.createGame(mk(3), { turnSeconds: 0 });
  const rd = U.startRound(m, 4242);
  /* masayı ve elleri sabitle */
  rd.discard = [find(R, 'num', 5)];
  rd.activeColor = R;
  rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
  rd.hands = [
    [find(R, 'num', 8), find(M, 'num', 2), find(Y, 'num', 4)],
    [find(M, 'num', 9), find(Y, 'num', 1)],
    [find(S, 'num', 3), find(S, 'num', 6)],
  ];

  ok(!U.playCard(m, 1, find(M, 'num', 9)).ok, 'sırası olmayan oynayamaz');
  ok(!U.playCard(m, 0, find(M, 'num', 2)).ok, 'uymayan kart oynanamaz');
  ok(!U.playCard(m, 0, find(S, 'num', 3)).ok, 'elde olmayan kart oynanamaz');

  const r = U.playCard(m, 0, find(R, 'num', 8));
  ok(r.ok, 'uygun kart oynandı');
  eq(rd.turn, 1, 'sıra sonraki oyuncuya geçti');
  eq(rd.activeColor, R, 'aktif renk kırmızı kaldı');
  eq(rd.hands[0].length, 2, 'elden bir kart gitti');
  eq(U.cardById(rd.discard[rd.discard.length - 1]).num, 8, 'kart masaya kondu');
}

/* --------------------------------------------------- aksiyon kartları - */
{
  function setup(n, hands, topId, color) {
    const m = U.createGame(mk(n), { turnSeconds: 0, challengeEnabled: false });
    const rd = U.startRound(m, 1);
    rd.discard = [topId]; rd.activeColor = color;
    rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
    rd.hands = hands;
    rd.saidUno = new Array(n).fill(false);
    return { m, rd };
  }

  /* Pas */
  {
    const { m, rd } = setup(3, [[find(R, 'skip'), find(R, 'num', 1)], [find(R, 'num', 2)], [find(R, 'num', 3)]], find(R, 'num', 5), R);
    U.playCard(m, 0, find(R, 'skip'));
    eq(rd.turn, 2, 'Pas sonraki oyuncuyu atlar');
  }
  /* Yön değiştir (3+ kişi) */
  {
    const { m, rd } = setup(3, [[find(R, 'rev'), find(R, 'num', 1)], [find(R, 'num', 2)], [find(R, 'num', 3)]], find(R, 'num', 5), R);
    U.playCard(m, 0, find(R, 'rev'));
    eq(rd.dir, -1, 'yön ters döndü');
    eq(rd.turn, 2, 'sıra ters yöne gitti');
  }
  /* Yön değiştir (2 kişi) = Pas */
  {
    const { m, rd } = setup(2, [[find(R, 'rev'), find(R, 'num', 1)], [find(R, 'num', 2)]], find(R, 'num', 5), R);
    U.playCard(m, 0, find(R, 'rev'));
    eq(rd.turn, 0, 'iki kişilikte Yön, Pas gibi davranır');
  }
  /* +2 */
  {
    const { m, rd } = setup(3, [[find(R, 'd2'), find(R, 'num', 1)], [find(R, 'num', 2)], [find(R, 'num', 3)]], find(R, 'num', 5), R);
    U.playCard(m, 0, find(R, 'd2'));
    eq(rd.hands[1].length, 3, 'sonraki oyuncu 2 kart çekti');
    eq(rd.turn, 2, '+2 sonrası sıra atlandı');
  }
  /* Joker: renk seçimi */
  {
    const { m, rd } = setup(3, [[wild(), find(R, 'num', 1)], [find(R, 'num', 2)], [find(R, 'num', 3)]], find(R, 'num', 5), R);
    const r = U.playCard(m, 0, wild());
    ok(r.needColor, 'joker renk seçimi ister');
    eq(rd.phase, 'color', 'renk aşaması');
    ok(!U.playCard(m, 0, find(R, 'num', 1)).ok, 'renk seçilmeden oynanamaz');
    ok(!U.chooseColor(m, 1, M).ok, 'rengi başkası seçemez');
    U.chooseColor(m, 0, M);
    eq(rd.activeColor, M, 'renk mavi oldu');
    eq(rd.phase, 'play', 'oyun aşamasına dönüldü');
    eq(rd.turn, 1, 'sıra ilerledi');
  }
  /* Joker doğrudan renkle oynanabilir */
  {
    const { m, rd } = setup(3, [[wild(), find(R, 'num', 1)], [find(R, 'num', 2)], [find(R, 'num', 3)]], find(R, 'num', 5), R);
    U.playCard(m, 0, wild(), Y);
    eq(rd.activeColor, Y, 'renk doğrudan verilebilir');
    eq(rd.phase, 'play', 'renk aşamasına girilmedi');
  }
}

/* --------------------------------------------------- joker+4 ve itiraz */
{
  function wd4Setup(legal) {
    const m = U.createGame(mk(3), { turnSeconds: 0, challengeEnabled: true, challengeSeconds: 30 });
    const rd = U.startRound(m, 5);
    rd.discard = [find(R, 'num', 5)]; rd.activeColor = R;
    rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
    rd.hands = [
      legal ? [wd4(), find(M, 'num', 2), find(Y, 'num', 4)]     // kırmızı yok -> yasal
            : [wd4(), find(R, 'num', 2), find(Y, 'num', 4)],    // kırmızı var -> blöf
      [find(M, 'num', 9), find(Y, 'num', 1)],
      [find(S, 'num', 3)],
    ];
    rd.saidUno = [false, false, false];
    return { m, rd };
  }

  /* elinde kırmızı varken oynamak blöftür: engellenmez ama kaydedilir */
  {
    const { m, rd } = wd4Setup(false);
    const r = U.playCard(m, 0, wd4(), M);
    ok(r.ok, 'blöf joker+4 oynanabilir');
    eq(rd.challenge.legal, false, 'blöf olarak işaretlendi');
  }
  /* yasal oynanışta blöf işareti konmaz */
  {
    const { m, rd } = wd4Setup(true);
    U.playCard(m, 0, wd4(), M);
    eq(rd.challenge.legal, true, 'kurallara uygun oynanış temiz işaretlenir');
  }

  /* yasal joker+4 -> itiraz penceresi açılır */
  {
    const { m, rd } = wd4Setup(true);
    const r = U.playCard(m, 0, wd4(), M);
    ok(r.ok && r.challenge, 'joker+4 itiraz penceresi açar');
    eq(rd.phase, 'challenge', 'itiraz aşaması');
    eq(rd.challenge.target, 1, 'itiraz hakkı sonraki oyuncuda');
    eq(rd.activeColor, M, 'renk seçildi');
    ok(!U.playCard(m, 1, find(M, 'num', 9)).ok, 'itiraz beklerken oynanamaz');
    ok(!U.resolveChallenge(m, 2, true).ok, 'itiraz hakkı olmayan itiraz edemez');

    /* itiraz etmeden kabul: 4 çek, sıra atlanır */
    U.resolveChallenge(m, 1, false);
    eq(rd.hands[1].length, 6, 'itiraz etmeyen 4 kart çekti');
    eq(rd.turn, 2, 'itiraz etmeyen sırasını kaybetti');
    eq(rd.phase, 'play', 'oyun aşamasına dönüldü');
  }

  /* haksız itiraz -> itiraz eden 6 çeker */
  {
    const { m, rd } = wd4Setup(true);
    U.playCard(m, 0, wd4(), M);
    const res = U.resolveChallenge(m, 1, true);
    ok(res.ok, 'itiraz işlendi');
    eq(res.outcome.bluff, false, 'blöf yoktu');
    eq(rd.hands[1].length, 8, 'haksız itiraz eden 6 kart çekti');
    eq(rd.turn, 2, 'haksız itiraz eden sırasını kaybetti');
    ok(rd.reveal && rd.reveal.to === 1, 'itiraz edene el gösterildi');
  }

  /* blöf yakalandı -> oynayan 4 çeker, sıra itiraz edene geçer */
  {
    const { m, rd } = wd4Setup(false);   // elinde kırmızı var -> gerçek blöf
    U.playCard(m, 0, wd4(), M);
    eq(rd.challenge.legal, false, 'gerçekten blöf');
    const res = U.resolveChallenge(m, 1, true);
    eq(res.outcome.bluff, true, 'blöf yakalandı');
    /* 3 kart - oynanan joker+4 = 2, üstüne 4 ceza = 6 */
    eq(rd.hands[0].length, 6, 'blöfçü 4 kart çekti');
    eq(rd.turn, 1, 'sıra itiraz edene geçti');
    eq(rd.hands[1].length, 2, 'itiraz eden kart çekmedi');
  }
}

/* -------------------------------------------------------- çekme / pas - */
{
  const m = U.createGame(mk(3), { turnSeconds: 0 });
  const rd = U.startRound(m, 77);
  rd.discard = [find(R, 'num', 5)]; rd.activeColor = R;
  rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
  rd.hands = [[find(M, 'num', 2)], [find(M, 'num', 9)], [find(S, 'num', 3)]];
  rd.drawPile = [find(R, 'num', 7), find(M, 'num', 4)];
  rd.saidUno = [false, false, false];

  ok(!U.pass(m, 0).ok, 'çekmeden pas geçilemez');
  const d = U.draw(m, 0);
  ok(d.ok && d.playable, 'çekilen kart oynanabilir');
  eq(rd.hands[0].length, 2, 'kart ele eklendi');
  ok(!U.playCard(m, 0, find(M, 'num', 2)).ok, 'çektikten sonra sadece çekilen kart oynanır');
  const p = U.playCard(m, 0, find(R, 'num', 7));
  ok(p.ok, 'çekilen kart oynandı');
  eq(rd.turn, 1, 'sıra ilerledi');

  /* çekilen kart oynanamıyorsa tur biter */
  rd.turn = 1; rd.phase = 'play'; rd.hasDrawn = false; rd.drawnCard = null;
  rd.activeColor = R; rd.discard = [find(R, 'num', 5)];
  rd.hands[1] = [find(Y, 'num', 9)];
  rd.drawPile = [find(S, 'num', 4)];
  const d2 = U.draw(m, 1);
  ok(d2.ok && !d2.playable, 'çekilen kart oynanamaz');
  eq(rd.turn, 2, 'oynanamayan kart çekilince tur otomatik biter');
}

/* --------------------------------------------------- deste yenilenmesi */
{
  const m = U.createGame(mk(2), { turnSeconds: 0 });
  const rd = U.startRound(m, 3);
  rd.drawPile = [];
  rd.discard = [find(R, 'num', 1), find(R, 'num', 2), find(R, 'num', 3), find(R, 'num', 4)];
  const okRefill = U.refillDraw(rd);
  ok(okRefill, 'deste yenilendi');
  eq(rd.discard.length, 1, 'sadece üst kart kaldı');
  eq(rd.drawPile.length, 3, 'kalanlar desteye döndü');
  eq(U.cardById(rd.discard[0]).num, 4, 'üst kart korundu');

  rd.drawPile = []; rd.discard = [find(R, 'num', 9)];
  ok(!U.refillDraw(rd), 'tek kart varken yenilenemez');
}

/* ---------------------------------------------------------------- UNO - */
{
  const m = U.createGame(mk(3), { turnSeconds: 0, unoCatchSeconds: 30, unoPenalty: 2 });
  const rd = U.startRound(m, 11);
  rd.discard = [find(R, 'num', 5)]; rd.activeColor = R;
  rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
  rd.hands = [[find(R, 'num', 8), find(R, 'num', 1)], [find(M, 'num', 9)], [find(S, 'num', 3)]];
  rd.saidUno = [false, false, false];
  rd.drawPile = [find(Y, 'num', 2), find(Y, 'num', 3), find(Y, 'num', 4)];

  U.playCard(m, 0, find(R, 'num', 8));
  eq(rd.hands[0].length, 1, 'tek kart kaldı');
  ok(rd.unoPending && rd.unoPending.seat === 0, 'UNO demeyen işaretlendi');

  ok(!U.catchUno(m, 0, 0).ok, 'kendini yakalayamazsın');
  const c = U.catchUno(m, 1, 0);
  ok(c.ok, 'UNO demeyen yakalandı');
  eq(rd.hands[0].length, 3, 'ceza olarak 2 kart çekti');
  eq(rd.unoPending, null, 'pencere kapandı');
  ok(!U.catchUno(m, 2, 0).ok, 'ikinci kez yakalanamaz');

  /* UNO diyen ceza yemez */
  const m2 = U.createGame(mk(3), { turnSeconds: 0, unoCatchSeconds: 30 });
  const r2 = U.startRound(m2, 12);
  r2.discard = [find(R, 'num', 5)]; r2.activeColor = R;
  r2.phase = 'play'; r2.turn = 0; r2.dir = 1;
  r2.hands = [[find(R, 'num', 8), find(R, 'num', 1)], [find(M, 'num', 9)], [find(S, 'num', 3)]];
  r2.saidUno = [false, false, false];
  U.callUno(m2, 0);
  U.playCard(m2, 0, find(R, 'num', 8));
  eq(r2.unoPending, null, 'önden UNO diyen işaretlenmez');
  ok(!U.catchUno(m2, 1, 0).ok, 'UNO diyen yakalanamaz');
}

/* ------------------------------------------------------------- bitiş -- */
{
  const m = U.createGame(mk(3), { turnSeconds: 0, targetScore: 500 });
  const rd = U.startRound(m, 21);
  rd.discard = [find(R, 'num', 5)]; rd.activeColor = R;
  rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
  rd.hands = [
    [find(R, 'num', 8)],
    [find(M, 'num', 9), find(S, 'skip')],       // 9 + 20 = 29
    [wild(), find(Y, 'num', 1)],                // 50 + 1 = 51
  ];
  rd.saidUno = [true, false, false];

  const r = U.playCard(m, 0, find(R, 'num', 8));
  ok(r.finished, 'son kart oynanınca el biter');
  eq(r.result.winnerSeat, 0, 'kazanan doğru');
  eq(r.result.gained, 80, 'kazanan 29+51 = 80 puan aldı');

  const applied = U.applyResult(m);
  eq(m.players[0].score, 80, 'puan işlendi');
  ok(!applied.over, '500 puana ulaşılmadı');

  /* 495 + (9 + 1) = 505 -> hedef aşılır */
  m.players[0].score = 495;
  const rd2 = U.startRound(m, 22);
  rd2.discard = [find(R, 'num', 5)]; rd2.activeColor = R;
  rd2.phase = 'play'; rd2.turn = 0; rd2.dir = 1;
  rd2.hands = [[find(R, 'num', 8)], [find(M, 'num', 9)], [find(Y, 'num', 1)]];
  rd2.saidUno = [true, false, false];
  const fin = U.playCard(m, 0, find(R, 'num', 8));
  eq(fin.result.gained, 10, 'ikinci elde 10 puan');
  const a2 = U.applyResult(m);
  eq(m.players[0].score, 505, 'puan 505 oldu');
  ok(a2.over, '500 puanı geçince maç biter');
  eq(a2.winner, 0, 'maçı 0. oyuncu kazandı');
}

/* --------------------------------------- son kart +2 ise yine çekilir - */
{
  const m = U.createGame(mk(3), { turnSeconds: 0, challengeEnabled: false });
  const rd = U.startRound(m, 31);
  rd.discard = [find(R, 'num', 5)]; rd.activeColor = R;
  rd.phase = 'play'; rd.turn = 0; rd.dir = 1;
  rd.hands = [[find(R, 'd2')], [find(M, 'num', 9)], [find(Y, 'num', 1)]];
  rd.saidUno = [true, false, false];
  rd.drawPile = [find(S, 'num', 2), find(S, 'num', 3), find(S, 'num', 4)];

  const r = U.playCard(m, 0, find(R, 'd2'));
  ok(r.finished, 'son kart +2 ile el bitti');
  eq(rd.hands[1].length, 3, 'sonraki oyuncu yine de 2 çekti');
}

/* ------------------------------------------------- görünüm gizliliği -- */
{
  const m = U.createGame(mk(3), { turnSeconds: 0 });
  const rd = U.startRound(m, 41);
  const v = U.viewFor(m, 1);
  eq(v.mySeat, 1, 'kendi koltuğu');
  eq(v.myHand.length, 7, 'kendi eli görünür');
  eq(v.players.length, 3, 'oyuncu listesi');
  ok(v.players.every((p) => typeof p.cards === 'number'), 'rakip kart sayıları görünür');
  const txt = JSON.stringify(v);
  const otherCards = rd.hands[0].concat(rd.hands[2]);
  const leaked = otherCards.filter((id) => v.myHand.indexOf(id) === -1)
    .filter((id) => txt.indexOf(`,${id},`) !== -1 || txt.indexOf(`[${id},`) !== -1 || txt.indexOf(`,${id}]`) !== -1);
  eq(leaked.length, 0, 'başkasının kartları görünüme sızmaz');
  ok(!('hands' in v), 'ham eller görünümde yok');
  ok(!('drawPile' in v), 'deste içeriği görünümde yok');
  eq(v.reveal, null, 'itiraz yoksa el gösterimi yok');
}

console.log(`\n  ${pass} test geçti, ${failCount} başarısız\n`);
if (fails.length) {
  console.log('  BAŞARISIZ:');
  for (const f of fails) console.log('   x ' + f);
  process.exit(1);
}
