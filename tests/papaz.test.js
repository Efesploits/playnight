/* Papaz Kaçtı motoru testleri.  Çalıştır:  node tests/papaz.test.js  */
'use strict';
const P = require('../src/js/papaz/engine.js');

let pass = 0, failCount = 0;
const fails = [];
const ok = (c, name, extra) => { if (c) pass++; else { failCount++; fails.push(name + (extra ? ' -> ' + extra : '')); } };
const eq = (a, b, name) => ok(a === b, name, `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);

const MACA = 0, KUPA = 1, KARO = 2, SINEK = 3;
const card = (s, r) => P.DECK.find((c) => c.s === s && c.r === r).id;
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'O' + i }));

/* --------------------------------------------------------------- deste */
{
  eq(P.DECK.length, 49, 'deste 49 kart (3 papaz çıkarılmış)');
  eq(P.DECK.filter((c) => c.r === 13).length, 1, 'destede tek papaz');
  eq(P.DECK.filter((c) => c.r === 13)[0].s, MACA, 'kalan papaz maça');
  for (let r = 1; r <= 12; r++) {
    eq(P.DECK.filter((c) => c.r === r).length, 4, `${r} sayısından 4 adet`);
  }
  for (let s = 0; s < 4; s++) {
    const n = P.DECK.filter((c) => c.s === s).length;
    eq(n, s === MACA ? 13 : 12, `renk ${s} kart sayısı`);
  }
  eq(new Set(P.DECK.map((c) => c.id)).size, 49, 'id tekrarı yok');
  ok(P.isPapaz(P.PAPAZ_ID), 'papaz tanınıyor');
  ok(!P.isPapaz(card(KUPA, 7)), 'normal kart papaz değil');
  eq(P.cardLabel(P.cardById(P.PAPAZ_ID)), 'Papaz', 'papaz etiketi');
}

/* -------------------------------------------------------- çift bulma -- */
{
  /* renge değil sayıya bakılır */
  const hand = [card(MACA, 7), card(KUPA, 7), card(KARO, 3), card(SINEK, 9)];
  const { pairs, rest } = P.extractPairs(hand);
  eq(pairs.length, 1, 'bir çift bulundu');
  eq(rest.length, 2, 'iki tek kart kaldı');
  ok(pairs[0].every((id) => P.cardById(id).r === 7), 'çift aynı sayıdan');

  /* aynı sayıdan dört kart = iki çift */
  const four = [card(MACA, 5), card(KUPA, 5), card(KARO, 5), card(SINEK, 5)];
  eq(P.extractPairs(four).pairs.length, 2, 'dört aynı kart iki çift eder');
  eq(P.extractPairs(four).rest.length, 0, 'artan kalmaz');

  /* aynı sayıdan üç kart = bir çift + bir tek */
  const three = [card(MACA, 5), card(KUPA, 5), card(KARO, 5)];
  eq(P.extractPairs(three).pairs.length, 1, 'üç kart bir çift eder');
  eq(P.extractPairs(three).rest.length, 1, 'biri tek kalır');

  /* aynı renk farklı sayı çift değildir */
  const sameSuit = [card(MACA, 2), card(MACA, 8)];
  eq(P.extractPairs(sameSuit).pairs.length, 0, 'aynı renk farklı sayı çift değil');

  /* papaz asla eşleşmez */
  const withKing = [P.PAPAZ_ID, card(KUPA, 4), card(KARO, 4)];
  const wk = P.extractPairs(withKing);
  eq(wk.pairs.length, 1, 'papazın yanındaki çift bulunur');
  ok(wk.rest.includes(P.PAPAZ_ID), 'papaz elde kalır');

  eq(P.findMatch([card(MACA, 9), card(KARO, 2)], card(KUPA, 9)), card(MACA, 9), 'eşleşen kart bulunur');
  eq(P.findMatch([card(MACA, 9)], P.PAPAZ_ID), null, 'papaza eş yok');
}

/* ------------------------------------------------------------ dağıtım */
{
  for (const n of [2, 3, 4, 5, 6]) {
    const m = P.createGame(mk(n), {});
    const rd = P.startRound(m, 1234 + n);
    const dealt = rd.hands.flat().length;
    const paired = rd.pairs.reduce((a, p) => a + p.length * 2, 0);
    eq(dealt + paired, 49, `${n} oyuncu: tüm kartlar dağıtıldı`);
    const all = [...rd.hands.flat(), ...rd.pairs.flat().flat()];
    eq(new Set(all).size, 49, `${n} oyuncu: kart tekrarı yok`);
    /* açılıştan sonra kimsenin elinde çift kalmamalı */
    for (const h of rd.hands) {
      eq(P.extractPairs(h).pairs.length, 0, `${n} oyuncu: elde çift kalmadı`);
    }
    /* papaz birinde olmalı */
    const holders = rd.hands.filter((h) => h.includes(P.PAPAZ_ID)).length;
    eq(holders, 1, `${n} oyuncu: papaz tek kişide`);
  }

  let threw = false;
  try { P.createGame(mk(1), {}); } catch { threw = true; }
  ok(threw, 'tek kişiyle oynanmaz');
  threw = false;
  try { P.createGame(mk(7), {}); } catch { threw = true; }
  ok(threw, '7 kişi reddedilir');
}

/* --------------------------------------------------- kimden çekilir -- */
{
  const m = P.createGame(mk(4), {});
  const rd = P.startRound(m, 5);
  rd.hands = [[card(MACA, 2)], [card(KUPA, 3)], [card(KARO, 4)], [card(SINEK, 5)]];
  eq(P.sourceSeatFor(rd, 0), 3, '0. oyuncu sağındaki 3ten çeker');
  eq(P.sourceSeatFor(rd, 1), 0, '1. oyuncu 0dan çeker');
  eq(P.sourceSeatFor(rd, 2), 1, '2. oyuncu 1den çeker');

  /* eli boş olan atlanır */
  rd.hands[3] = [];
  eq(P.sourceSeatFor(rd, 0), 2, 'eli boş oyuncu atlanır');
  rd.hands[2] = [];
  eq(P.sourceSeatFor(rd, 0), 1, 'iki boş oyuncu atlanır');
  rd.hands[1] = [];
  eq(P.sourceSeatFor(rd, 0), -1, 'kimse kalmadıysa -1');
}

/* -------------------------------------------------------- kart çekme - */
{
  const m = P.createGame(mk(3), { turnSeconds: 0 });
  const rd = P.startRound(m, 9);
  rd.hands = [
    [card(MACA, 7), card(KUPA, 2)],          // 0
    [card(KARO, 9), P.PAPAZ_ID],             // 1
    [card(SINEK, 7), card(KUPA, 5)],         // 2
  ];
  rd.pairs = [[], [], []];
  rd.out = [false, false, false];
  rd.outOrder = [];
  rd.turn = 0; rd.phase = 'play'; rd.finished = false; rd.result = null;

  ok(!P.drawCard(m, 1, 0).ok, 'sırası olmayan çekemez');

  /* 0, sağındaki 2den maça7'yi eşleyecek sinek7'yi çeksin */
  const idx = rd.hands[2].indexOf(card(SINEK, 7));
  const r = P.drawCard(m, 0, idx);
  ok(r.ok, 'kart çekildi');
  ok(r.draw.matched, 'çift oluştu');
  eq(rd.pairs[0].length, 1, 'çift yere açıldı');
  eq(rd.hands[0].length, 1, 'elden iki kart çıktı, biri kaldı');
  eq(rd.hands[2].length, 1, 'kaynağın eli azaldı');
  eq(rd.turn, 1, 'sıra sonrakine geçti');

  /* eşleşmeyen kart ele girer */
  const before1 = rd.hands[1].length;
  const r2 = P.drawCard(m, 1, 0);
  ok(r2.ok, 'ikinci çekiş');
  ok(!r2.draw.matched || rd.hands[1].length === before1, 'eşleşmezse el büyür, eşleşirse küçülür');
}

/* --------------------------------------------- eli biten kurtulur ---- */
{
  const m = P.createGame(mk(3), { turnSeconds: 0 });
  const rd = P.startRound(m, 11);
  rd.hands = [
    [card(MACA, 7)],
    [card(KUPA, 7)],
    [P.PAPAZ_ID, card(KARO, 3)],
  ];
  rd.pairs = [[], [], []];
  rd.out = [false, false, false];
  rd.outOrder = [];
  rd.turn = 1; rd.phase = 'play'; rd.finished = false; rd.result = null;

  /* 1, sağındaki 0dan maça7 çeker -> çift olur, ikisi de biter */
  const r = P.drawCard(m, 1, 0);
  ok(r.draw.matched, 'çift oldu');
  ok(rd.out[1], 'eli biten kurtuldu');
  ok(rd.out[0], 'kaynağın eli de bitti, o da kurtuldu');
  ok(rd.outOrder.includes(0) && rd.outOrder.includes(1), 'kurtulma sırası kaydedildi');
  ok(r.finished, 'tek kişi kaldığı için el bitti');
  eq(r.result.loserSeat, 2, 'papazı tutan kaybetti');
  ok(rd.hands[2].includes(P.PAPAZ_ID), 'kaybedenin elinde papaz var');
}

/* --------------------------------------------------------- maç akışı - */
{
  const m = P.createGame(mk(3), { rounds: 2, turnSeconds: 0 });
  eq(m.players.every((p) => p.losses === 0), true, 'başlangıçta kayıp yok');

  /* 1. el */
  P.startRound(m, 21);
  m.round.hands = [[card(MACA, 7)], [card(KUPA, 7)], [P.PAPAZ_ID]];
  m.round.pairs = [[], [], []]; m.round.out = [false, false, false]; m.round.outOrder = [];
  m.round.turn = 1; m.round.finished = false; m.round.result = null; m.round.phase = 'play';
  P.drawCard(m, 1, 0);
  let a = P.applyResult(m);
  eq(m.players[2].losses, 1, 'kaybedene papaz yazıldı');
  ok(!a.over, 'iki elin biri oynandı');
  eq(a.roundsLeft, 1, 'bir el kaldı');

  /* 2. el */
  P.startRound(m, 22);
  m.round.hands = [[card(MACA, 8)], [P.PAPAZ_ID], [card(KUPA, 8)]];
  m.round.pairs = [[], [], []]; m.round.out = [false, false, false]; m.round.outOrder = [];
  m.round.turn = 0; m.round.finished = false; m.round.result = null; m.round.phase = 'play';
  const src = P.sourceSeatFor(m.round, 0);
  eq(src, 2, '0 sağındaki 2den çeker');
  P.drawCard(m, 0, 0);
  a = P.applyResult(m);
  ok(a.over, 'el sayısı dolunca maç biter');
  eq(m.players[1].losses, 1, 'ikinci elin kaybedeni');
  ok(a.winner === 0 || a.winner === 2, 'hiç papaz kalmayanlardan biri kazandı');
  eq(m.players[a.winner].losses, 0, 'kazananın hiç papazı yok');
}

/* --------------------------------------------------- görünüm gizliliği */
{
  const m = P.createGame(mk(4), { turnSeconds: 0 });
  const rd = P.startRound(m, 31);
  const papazSeat = rd.hands.findIndex((h) => h.includes(P.PAPAZ_ID));
  const other = (papazSeat + 2) % 4;

  const v = P.viewFor(m, other);
  eq(v.mySeat, other, 'kendi koltuğu');
  eq(v.myHand.length, rd.hands[other].length, 'kendi eli tam görünür');
  ok(!('hands' in v), 'ham eller görünümde yok');

  /* başkasının kartları sızmamalı */
  const mine = new Set(v.myHand);
  const otherCards = rd.hands.filter((_, i) => i !== other).flat().filter((id) => !mine.has(id));
  const txt = JSON.stringify(v);
  const leaked = otherCards.filter((id) =>
    new RegExp(`(^|[,\\[])${id}([,\\]]|$)`).test(txt));
  eq(leaked.length, 0, 'başkasının kartları görünüme sızmaz');

  /* rakip bilgisi yalnızca sayı */
  ok(v.players.every((p) => typeof p.cards === 'number' && typeof p.pairs === 'number'),
    'rakiplerin yalnızca kart sayısı görünür');

  /* papazın kimde olduğu görünmemeli */
  ok(txt.indexOf(`"papazSeat"`) === -1, 'papazın yeri görünümde yok');
  const vp = P.viewFor(m, papazSeat);
  ok(vp.myHand.includes(P.PAPAZ_ID), 'papaz sahibi kendi papazını görür');
}

/* ------------------------------------ çekilen kart yalnızca çekene açık */
{
  const m = P.createGame(mk(3), { turnSeconds: 0 });
  const rd = P.startRound(m, 41);
  rd.hands = [[card(MACA, 4)], [card(KUPA, 9), card(KARO, 6)], [P.PAPAZ_ID, card(SINEK, 2)]];
  rd.pairs = [[], [], []]; rd.out = [false, false, false]; rd.outOrder = [];
  rd.turn = 0; rd.phase = 'play'; rd.finished = false; rd.result = null;

  P.drawCard(m, 0, 0);   // eşleşmeyen bir kart çeker
  const vSelf = P.viewFor(m, 0);
  const vOther = P.viewFor(m, 1);
  ok(vSelf.lastDraw.cardId !== null, 'çeken oyuncu kartı görür');
  eq(vOther.lastDraw.cardId, null, 'eşleşmeyen kart başkasına gösterilmez');
  ok(vOther.lastDraw.by === 0 && typeof vOther.lastDraw.matched === 'boolean',
    'kimin çektiği ve eşleşip eşleşmediği herkese açık');
}

console.log(`\n  ${pass} test geçti, ${failCount} başarısız\n`);
if (fails.length) {
  console.log('  BAŞARISIZ:');
  for (const f of fails) console.log('   x ' + f);
  process.exit(1);
}
