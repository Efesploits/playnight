/* 101 Okey motoru için kural testleri.  Çalıştır:  node tests/engine.test.js  */
'use strict';
const E = require('../src/js/okey/engine.js');

let pass = 0, failCount = 0;
const fails = [];
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { failCount++; fails.push(name + (extra ? '  -> ' + extra : '')); }
}
function eq(a, b, name) { ok(a === b, name, `beklenen ${b}, gelen ${a}`); }

/* renk: 0 sarı, 1 mavi, 2 siyah, 3 kırmızı ; copy: 0 veya 1 */
const T = (c, n, copy = 0) => copy * 52 + c * 13 + n - 1;
const FAKE = [104, 105];
const Y = 0, B = 1, K = 2, R = 3;

/* ---------------------------------------------------------------- deste -- */
{
  eq(E.DECK.length, 106, 'deste 106 taş');
  eq(E.DECK.filter((t) => t.fake).length, 2, 'iki sahte okey');
  const counts = {};
  for (const t of E.DECK) if (!t.fake) counts[`${t.c}-${t.n}`] = (counts[`${t.c}-${t.n}`] || 0) + 1;
  eq(Object.keys(counts).length, 52, '52 farklı taş');
  ok(Object.values(counts).every((v) => v === 2), 'her taştan 2 kopya');
  eq(E.tileById(T(R, 7, 1)).n, 7, 'id -> taş eşlemesi doğru');
  eq(E.tileById(T(R, 7, 1)).c, R, 'id -> renk eşlemesi doğru');
}

/* ------------------------------------------------------------ gösterge -- */
{
  const ctx = E.makeContext(T(B, 5), {});
  eq(ctx.okey.c, B, 'gösterge mavi 5 -> okey mavi');
  eq(ctx.okey.n, 6, 'gösterge mavi 5 -> okey 6');
  ok(E.isOkey(E.tileById(T(B, 6)), ctx), 'mavi 6 okeydir');
  ok(E.isOkey(E.tileById(T(B, 6, 1)), ctx), 'ikinci mavi 6 da okeydir');
  ok(!E.isOkey(E.tileById(T(B, 5)), ctx), 'gösterge taşı okey değildir');
  const idn = E.identity(E.tileById(FAKE[0]), ctx);
  ok(idn.c === B && idn.n === 5, 'sahte okey göstergenin taşı yerine geçer');

  const ctx13 = E.makeContext(T(R, 13), {});
  eq(ctx13.okey.n, 1, 'gösterge 13 -> okey 1');
  eq(ctx13.okey.c, R, 'gösterge 13 -> aynı renk');
}

/* ---------------------------------------------------------------- seri -- */
{
  const ctx = E.makeContext(T(B, 5), {}); // okey = mavi 6

  let v = E.validateRun([T(R, 5), T(R, 6), T(R, 7)], ctx);
  ok(v.ok && v.type === 'run', 'kırmızı 5-6-7 geçerli seri');
  eq(v.points, 18, 'seri puanı 5+6+7');

  v = E.validateRun([T(R, 5), T(R, 6), T(R, 8)], ctx);
  ok(!v.ok, 'ardışık olmayan seri geçersiz');

  v = E.validateRun([T(R, 5), T(K, 6), T(R, 7)], ctx);
  ok(!v.ok, 'farklı renkli seri geçersiz');

  /* okey ile seri: kırmızı 5, OKEY(mavi6), kırmızı 7 -> 5-6-7 */
  v = E.validateRun([T(R, 5), T(B, 6), T(R, 7)], ctx);
  ok(v.ok, 'okey seriye joker olarak girer');
  eq(v.points, 18, 'okey yerine geçtiği taşın puanını sayar');

  /* 1 en altta */
  v = E.validateRun([T(Y, 1), T(Y, 2), T(Y, 3)], ctx);
  ok(v.ok, '1-2-3 geçerli');
  eq(v.points, 6, '1-2-3 = 6 puan');

  /* 12-13-1 (ev kuralı açık) */
  v = E.validateRun([T(Y, 12), T(Y, 13), T(Y, 1)], ctx);
  ok(v.ok, '12-13-1 geçerli (aceHighAllowed)');
  eq(v.points, 26, '12+13+1 = 26 puan (aceValue=1)');

  /* 13-1-2 olmaz */
  v = E.validateRun([T(Y, 13), T(Y, 1), T(Y, 2)], ctx);
  ok(!v.ok, '13-1-2 geçersiz');

  /* aceHigh kapalıyken 12-13-1 olmaz */
  const ctxNoAce = E.makeContext(T(B, 5), { aceHighAllowed: false });
  v = E.validateRun([T(Y, 12), T(Y, 13), T(Y, 1)], ctxNoAce);
  ok(!v.ok, 'aceHighAllowed=false iken 12-13-1 geçersiz');

  /* uzun seri */
  v = E.validateRun([T(K, 4), T(K, 5), T(K, 6), T(K, 7), T(K, 8)], ctx);
  ok(v.ok, '5 taşlı seri geçerli');
  eq(v.points, 30, '4+5+6+7+8 = 30');

  /* sahte okey gösterge taşı olarak seride */
  v = E.validateRun([T(B, 3), T(B, 4), FAKE[0]], ctx); // sahte = mavi 5
  ok(v.ok, 'sahte okey gerçek taş gibi seriye girer');
  eq(v.points, 12, '3+4+5 = 12');
}

/* ---------------------------------------------------------------- grup -- */
{
  const ctx = E.makeContext(T(B, 5), {});
  let v = E.validateSet([T(Y, 7), T(B, 7), T(K, 7)], ctx);
  ok(v.ok && v.type === 'set', 'üçlü grup geçerli');
  eq(v.points, 21, '7x3 = 21');

  v = E.validateSet([T(Y, 7), T(B, 7), T(K, 7), T(R, 7)], ctx);
  ok(v.ok, 'dörtlü grup geçerli');
  eq(v.points, 28, '7x4 = 28');

  v = E.validateSet([T(Y, 7), T(Y, 7, 1), T(K, 7)], ctx);
  ok(!v.ok, 'aynı renk iki kez grupta olamaz');

  v = E.validateSet([T(Y, 7), T(B, 7), T(K, 8)], ctx);
  ok(!v.ok, 'farklı sayılı grup geçersiz');

  /* okey ile grup */
  v = E.validateSet([T(Y, 11), T(K, 11), T(B, 6)], ctx); // mavi6 = okey
  ok(v.ok, 'okey grupta joker olur');
  eq(v.points, 33, '11x3 = 33');

  v = E.validateSet([T(Y, 7), T(B, 7)], ctx);
  ok(!v.ok, 'iki taş grup değildir');
}

/* ---------------------------------------------------------------- çift -- */
{
  const ctx = E.makeContext(T(B, 5), {});
  let v = E.validatePair([T(R, 9), T(R, 9, 1)], ctx);
  ok(v.ok && v.type === 'pair', 'birebir aynı iki taş çifttir');
  eq(v.points, 18, 'çift puanı 9x2');

  v = E.validatePair([T(R, 9), T(K, 9)], ctx);
  ok(!v.ok, 'farklı renk çift değildir');

  v = E.validatePair([T(R, 9), T(B, 6)], ctx);
  ok(v.ok, 'okey ile çift yapılır');
  eq(v.points, 18, 'okeyli çift eşinin puanını alır');
}

/* -------------------------------------------------------------- işleme -- */
{
  const ctx = E.makeContext(T(B, 5), {});
  const run = { type: 'run', tiles: [T(R, 5), T(R, 6), T(R, 7)], points: 18 };
  ok(E.canAddToMeld(run, T(R, 8), ctx).ok, 'seriye üstten ekleme');
  ok(E.canAddToMeld(run, T(R, 4), ctx).ok, 'seriye alttan ekleme');
  ok(!E.canAddToMeld(run, T(R, 10), ctx).ok, 'uzak taş seriye eklenemez');
  ok(!E.canAddToMeld(run, T(K, 8), ctx).ok, 'farklı renk seriye eklenemez');

  const set = { type: 'set', tiles: [T(Y, 7), T(B, 7), T(K, 7)], points: 21 };
  ok(E.canAddToMeld(set, T(R, 7), ctx).ok, 'gruba 4. renk eklenir');
  const full = { type: 'set', tiles: [T(Y, 7), T(B, 7), T(K, 7), T(R, 7)], points: 28 };
  ok(!E.canAddToMeld(full, T(Y, 7, 1), ctx).ok, 'dolu gruba eklenemez');

  const pair = { type: 'pair', tiles: [T(R, 9), T(R, 9, 1)], points: 18 };
  ok(!E.canAddToMeld(pair, T(R, 9), ctx).ok, 'çiftlere işleme yapılamaz');
}

/* ------------------------------------------------------------- çözücü --- */
{
  const ctx = E.makeContext(T(B, 5), {});
  /* 11-12-13 kırmızı (36) + 11-12-13 siyah (36) + 10-10-10 (30) = 102 */
  const hand = [
    T(R, 11), T(R, 12), T(R, 13),
    T(K, 11), T(K, 12), T(K, 13),
    T(Y, 10), T(B, 10), T(K, 10),
    T(Y, 2), T(R, 4),
  ];
  const sol = E.solveBest(hand, ctx, 'sets');
  ok(sol.points >= 102, '101 üstü açılış bulundu', 'puan=' + sol.points);
  eq(sol.used, 9, '9 taş perlere girdi');
  for (const m of sol.melds) ok(E.validateMeld(m.tiles, ctx).ok, 'çözücünün ürettiği per geçerli');

  /* Regresyon: grup somutlaştırılırken seriye lazım olan taş çalınmamalı.
     11'ler grubu (33) + 12'ler grubu (36) + siyah 10-11-12 serisi (33) = 102.
     Grup yanlışlıkla siyah 12'yi alırsa seri kurulamaz ve puan 69'a düşer. */
  {
    const hand2 = [
      T(Y, 11), T(B, 11), T(K, 11),
      T(Y, 12), T(B, 12), T(R, 12),
      T(K, 10), T(K, 11, 1), T(K, 12, 1),
      T(R, 9), T(R, 9, 1), T(Y, 2), T(Y, 13),
    ];
    const s2 = E.solveBest(hand2, ctx, 'sets');
    eq(s2.points, 102, 'çözücü grup/seri çakışmasını doğru çözer');
    eq(s2.melds.length, 3, 'üç per bulunmalı');
    for (const m of s2.melds) ok(E.validateMeld(m.tiles, ctx).ok, 'üretilen per geçerli');
    const allIds = s2.melds.flatMap((m) => m.tiles);
    eq(new Set(allIds).size, allIds.length, 'aynı taş iki perde kullanılmadı');
    for (const id of allIds) ok(hand2.includes(id), 'perler sadece eldeki taşları kullanır');
  }

  /* çift çözücü */
  const ph = [T(R, 9), T(R, 9, 1), T(K, 3), T(K, 3, 1), T(Y, 12), T(Y, 12, 1), T(B, 2), T(B, 2, 1), T(R, 1), T(R, 1, 1), T(K, 8)];
  const ps = E.solveBest(ph, ctx, 'pairs');
  eq(ps.melds.length, 5, 'çift çözücü 5 çift buldu');
}

/* ------------------------------------------------------- tam el akışı --- */
{
  const match = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
    {}
  );
  const round = E.startRound(match, 12345);

  const total = round.seats.reduce((s, x) => s + x.hand.length, 0) + round.pile.length + 1;
  eq(total, 106, 'dağıtımdan sonra toplam taş 106');
  const starter = round.turn;
  eq(round.seats[starter].hand.length, 22, 'başlayan oyuncuda 22 taş');
  for (let i = 0; i < 4; i++) if (i !== starter) eq(round.seats[i].hand.length, 21, `oyuncu ${i} 21 taş`);
  eq(round.pile.length, 106 - 85 - 1, 'destede 20 taş kalır');
  eq(round.phase, 'act', 'başlayan oyuncu doğrudan atar');
  ok(!E.tileById(round.indicatorId).fake, 'gösterge sahte okey değil');

  /* sıra dışı hamle reddedilmeli */
  const wrong = E.discard(round, (starter + 1) % 4, round.seats[(starter + 1) % 4].hand[0]);
  ok(!wrong.ok, 'sırası olmayan oyuncu taş atamaz');

  /* açmadan işleme yapılamaz */
  const noOpen = E.layMeld(round, starter, round.seats[starter].hand.slice(0, 3));
  ok(!noOpen.ok, 'açmadan per konulamaz');

  /* başlayan atsın, sıra dönsün */
  const safeTile = round.seats[starter].hand.find((id) => !E.isOkey(E.tileById(id), round.ctx));
  const d = E.discard(round, starter, safeTile, true);
  ok(d.ok, 'başlayan taş attı');
  eq(round.turn, (starter + 1) % 4, 'sıra sonrakine geçti');
  eq(round.phase, 'draw', 'sonraki oyuncu çekmeli');
  eq(round.seats[starter].hand.length, 21, 'atınca 21 taş kaldı');

  /* çekmeden atamaz */
  const cheat = E.discard(round, round.turn, round.seats[round.turn].hand[0]);
  ok(!cheat.ok, 'çekmeden atılamaz');

  /* soldan taş alma */
  const t2 = E.drawFromDiscard(round, round.turn);
  ok(t2.ok, 'soldakinin attığı taş alınabilir');
  eq(t2.tile, safeTile, 'alınan taş atılan taştır');
  eq(round.seats[round.turn].hand.length, 22, 'alınca 22 taş');
}

/* ------------------------------------------------------ el açma kuralı -- */
{
  const match = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}
  );
  const round = E.startRound(match, 999);
  const seat = round.turn;
  const ctx = round.ctx;

  /* eli elle kurgula: 101 altı ve 101 üstü denemeleri */
  round.seats[seat].hand = [
    T(R, 1), T(R, 2), T(R, 3),           // 6 puan
    T(Y, 11), T(B, 11), T(K, 11),        // 33
    T(K, 10), T(K, 11, 1), T(K, 12),     // 33
    T(Y, 12), T(B, 12), T(R, 12),        // 36
    T(Y, 5), T(Y, 6), T(Y, 7), T(Y, 8),
    T(B, 1), T(B, 3), T(K, 5), T(R, 9), T(R, 7), T(Y, 9),
  ];
  round.phase = 'act';

  const low = E.openHand(round, seat, [[T(R, 1), T(R, 2), T(R, 3)]]);
  ok(!low.ok, '6 puanla el açılamaz');
  ok(/101/.test(low.reason), 'hata mesajı 101 eşiğini söylüyor', low.reason);

  const mixed = E.openHand(round, seat, [
    [T(Y, 11), T(B, 11), T(K, 11)], [T(Y, 12), T(B, 12), T(R, 12)], [T(R, 9), T(R, 9)],
  ]);
  ok(!mixed.ok, 'aynı taş iki perde kullanılamaz');

  const good = E.openHand(round, seat, [
    [T(Y, 11), T(B, 11), T(K, 11)],      // 33
    [T(Y, 12), T(B, 12), T(R, 12)],      // 36
    [T(K, 10), T(K, 11, 1), T(K, 12)],   // 33
  ]);
  ok(good.ok, '102 puanla el açıldı', good.reason);
  eq(good.points, 102, 'açılış puanı 102');
  ok(round.seats[seat].opened, 'oyuncu açık duruma geçti');
  eq(round.seats[seat].openType, 'sets', 'seri modunda açtı');
  eq(round.seats[seat].melds.length, 3, '3 per masada');
  eq(round.seats[seat].hand.length, 13, 'elden 9 taş çıktı');

  /* çift + seri karışımı reddedilir */
  const round2 = E.startRound(E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}), 555);
  const s2 = round2.turn;
  round2.seats[s2].hand = [T(Y, 11), T(B, 11), T(K, 11), T(R, 9), T(R, 9, 1)];
  round2.phase = 'act';
  const mix = E.openHand(round2, s2, [[T(Y, 11), T(B, 11), T(K, 11)], [T(R, 9), T(R, 9, 1)]]);
  ok(!mix.ok, 'seri ve çift aynı elde açılamaz');
}

/* -------------------------------------------------------- çiftten açma -- */
{
  const match = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}
  );
  const round = E.startRound(match, 4242);
  const seat = round.turn;
  round.seats[seat].hand = [
    T(R, 9), T(R, 9, 1), T(K, 3), T(K, 3, 1), T(Y, 12), T(Y, 12, 1),
    T(B, 2), T(B, 2, 1), T(R, 1), T(R, 1, 1), T(K, 8), T(Y, 4),
  ];
  round.phase = 'act';

  const few = E.openHand(round, seat, [[T(R, 9), T(R, 9, 1)], [T(K, 3), T(K, 3, 1)]]);
  ok(!few.ok, '2 çiftle açılamaz');

  const five = E.openHand(round, seat, [
    [T(R, 9), T(R, 9, 1)], [T(K, 3), T(K, 3, 1)], [T(Y, 12), T(Y, 12, 1)],
    [T(B, 2), T(B, 2, 1)], [T(R, 1), T(R, 1, 1)],
  ]);
  ok(five.ok, '5 çiftle el açıldı', five.reason);
  eq(round.seats[seat].openType, 'pairs', 'çift modunda açtı');

  /* çift açan seri koyamaz */
  const bad = E.layMeld(round, seat, [T(K, 8), T(Y, 4), T(R, 1)]);
  ok(!bad.ok, 'çift açan oyuncu seri koyamaz');
}

/* ------------------------------------------------------------ puanlama -- */
{
  function makeFinished(openTypeWinner, otherTypes, discardedOkey, unopened) {
    const match = E.createMatch(
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}
    );
    const round = E.startRound(match, 7);
    round.turnId = 5;
    round.seats.forEach((s, i) => {
      s.hand = [];
      s.opened = i === 0 ? true : !unopened.includes(i);
      s.openType = i === 0 ? openTypeWinner : (otherTypes[i] || 'sets');
      s.openedTurn = 1;
      s.penalty = 0;
    });
    /* rakiplerin elinde 10 puanlık taş bıraksın */
    round.seats[1].hand = [T(Y, 10)];
    round.seats[2].hand = [T(Y, 10)];
    round.seats[3].hand = [T(Y, 10)];
    return { match, round };
  }

  /* seri ile normal bitiş */
  let { match, round } = makeFinished('sets', { 1: 'sets', 2: 'pairs', 3: 'sets' }, false, [3]);
  let r = E.finishRound(round, 0, false).result;
  eq(r.rows[0].delta, -101, 'seri normal bitişte kazanan -101');
  eq(r.rows[1].delta, 10, 'seri açan rakip el toplamı kadar (x1)');
  eq(r.rows[2].delta, 20, 'çift açan rakip x2');
  eq(r.rows[3].delta, 202, 'açmayan +202');

  /* seri ile okey atarak bitiş */
  ({ match, round } = makeFinished('sets', { 1: 'sets', 2: 'pairs', 3: 'sets' }, true, [3]));
  r = E.finishRound(round, 0, true).result;
  eq(r.rows[0].delta, -202, 'okeyle bitişte kazanan -202');
  eq(r.rows[1].delta, 20, 'okeyle bitişte seri açan x2');
  eq(r.rows[2].delta, 40, 'okeyle bitişte çift açan x4');
  eq(r.rows[3].delta, 404, 'okeyle bitişte açmayan +404');

  /* çift ile bitiş */
  ({ match, round } = makeFinished('pairs', { 1: 'sets', 2: 'pairs', 3: 'sets' }, false, [3]));
  r = E.finishRound(round, 0, false).result;
  eq(r.rows[0].delta, -202, 'çiftle bitişte kazanan -202');
  eq(r.rows[1].delta, 20, 'çiftle bitişte seri açan x2');
  eq(r.rows[2].delta, 40, 'çiftle bitişte çift açan x4');
  eq(r.rows[3].delta, 404, 'çiftle bitişte açmayan +404');

  /* çift + okey atarak bitiş */
  ({ match, round } = makeFinished('pairs', { 1: 'sets', 2: 'pairs', 3: 'sets' }, true, [3]));
  r = E.finishRound(round, 0, true).result;
  eq(r.rows[0].delta, -404, 'çift+okey bitişte kazanan -404');
  eq(r.rows[1].delta, 40, 'çift+okey bitişte seri açan x4');
  eq(r.rows[2].delta, 80, 'çift+okey bitişte çift açan x8');

  /* elden bitirme */
  ({ match, round } = makeFinished('sets', {}, false, [1, 2, 3]));
  round.seats[0].openedTurn = round.turnId; // bu turda açtı
  r = E.finishRound(round, 0, false).result;
  ok(r.straightOut, 'elden bitirme tespit edildi');
  eq(r.rows[0].delta, -202, 'elden bitirmede kazanan -202');
  eq(r.rows[1].delta, 404, 'elden bitirmede rakipler +404');

  /* elden bitirme + okey */
  ({ match, round } = makeFinished('sets', {}, true, [1, 2, 3]));
  round.seats[0].openedTurn = round.turnId;
  r = E.finishRound(round, 0, true).result;
  eq(r.rows[0].delta, -404, 'elden+okey bitirmede kazanan -404');
  eq(r.rows[1].delta, 808, 'elden+okey bitirmede rakipler +808');
}

/* --------------------------------------------------- maç puan tablosu --- */
{
  const match = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}
  );
  ok(match.players.every((p) => p.score === 0), 'puanlar sıfırdan başlar');
  const round = E.startRound(match, 31);
  round.turnId = 3;
  round.seats.forEach((s, i) => { s.hand = i === 0 ? [] : [T(Y, 10)]; s.opened = true; s.openType = 'sets'; s.openedTurn = 1; });
  E.finishRound(round, 0, false);
  const applied = E.applyResult(match);
  eq(match.players[0].score, -101, 'bitiren -101 puana iner');
  eq(match.players[1].score, 10, 'kaybeden elinde kalan kadar alır');
  ok(!applied.over, 'tek elde maç bitmez');
  eq(applied.dealsLeft, 10, '11 elin 10 tanesi kaldı');

  /* el sayısı dolunca en düşük puanlı kazanır */
  const short = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
    { deals: 1 }
  );
  const r2 = E.startRound(short, 77);
  r2.turnId = 3;
  r2.seats.forEach((s, i) => { s.hand = i === 2 ? [] : [T(Y, 10)]; s.opened = true; s.openType = 'sets'; s.openedTurn = 1; });
  E.finishRound(r2, 2, false);
  const a2 = E.applyResult(short);
  ok(a2.over, 'el sayısı dolunca maç biter');
  eq(a2.winner, 2, 'en düşük puanlı oyuncu maçı kazanır');
}

/* -------------------------------------------------- elde kalan okey ---- */
{
  const ctx = E.makeContext(T(B, 5), {}); // okey = mavi 6
  eq(E.handValue([T(Y, 10), T(K, 3)], ctx), 13, 'normal taşlar toplanır');
  eq(E.handValue([T(B, 6)], ctx), 101, 'elde kalan okey 101 ceza (ev kuralı)');
  const ctxOff = E.makeContext(T(B, 5), { okeyInHandPenalty: 0 });
  eq(E.handValue([T(B, 6)], ctxOff), 6, 'ev kuralı kapalıyken okey kendi değerini yazar');
  eq(E.handValue([FAKE[0]], ctx), 5, 'sahte okey göstergenin puanını yazar');
}

/* -------------------------------------------------- taş atma cezaları -- */
{
  const match = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}
  );
  const round = E.startRound(match, 88);
  const seat = round.turn;
  const ctx = round.ctx;
  const okeyId = [T(ctx.okey.c, ctx.okey.n, 0), T(ctx.okey.c, ctx.okey.n, 1)][0];

  round.seats[seat].hand = [okeyId, T(Y, 4), T(K, 9), T(R, 2)];
  round.phase = 'act';
  const warn = E.discard(round, seat, okeyId);
  ok(!warn.ok && warn.needsConfirm === 'okey', 'okey atarken onay istenir');
  const forced = E.discard(round, seat, okeyId, true);
  ok(forced.ok, 'onaylayınca okey atılır');
  eq(round.seats[seat].penalty, 101, 'okey atma cezası 101');
}

/* --------------------------------------------------- deste bitimi ------ */
{
  const match = E.createMatch(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], {}
  );
  const round = E.startRound(match, 61);
  const seat = round.turn;
  round.pile = [];
  round.phase = 'act';
  const t = round.seats[seat].hand.find((id) => !E.isOkey(E.tileById(id), round.ctx));
  E.discard(round, seat, t, true);
  ok(round.lastChance, 'deste bitince son alma hakkı doğar');
  const next = round.turn;
  ok(!E.drawFromPile(round, next).ok, 'boş desteden çekilemez');
  const res = E.passLastChance(round, next);
  ok(res.ok && res.result.noWinner, 'pas geçilince el kazanansız biter');
}

/* ------------------------------------------------------------- sonuç --- */
console.log(`\n  ${pass} test geçti, ${failCount} başarısız\n`);
if (fails.length) {
  console.log('  BAŞARISIZ:');
  for (const f of fails) console.log('   x ' + f);
  process.exit(1);
}
