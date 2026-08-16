/* UNO uçtan uca simülasyon: botlar tam maçlar oynar, kural ve kart bütünlüğü
   denetlenir.  Çalıştır:  node tests/uno-sim.test.js [maçSayısı]              */
'use strict';

global.window = global;
global.Uno = require('../src/js/uno/engine.js');
require('../src/js/uno/bot.js');

const U = global.Uno;
const B = global.UnoBot;

const problems = [];
const bad = (m) => { if (problems.length < 40) problems.push(m); };

/* ------------------------------------------------------------ değişmez */
function checkCards(round, where) {
  const seen = new Map();
  const note = (id, src) => {
    if (seen.has(id)) bad(`${where}: kart ${id} iki yerde (${seen.get(id)} + ${src})`);
    seen.set(id, src);
  };
  round.hands.forEach((h, i) => h.forEach((id) => note(id, 'el' + i)));
  round.drawPile.forEach((id) => note(id, 'deste'));
  round.discard.forEach((id) => note(id, 'atık'));
  if (seen.size !== 108) bad(`${where}: toplam kart ${seen.size}, 108 olmalı`);
  if (round.hands.some((h) => h.length < 0)) bad(`${where}: negatif el`);
  if (round.activeColor !== null && (round.activeColor < 0 || round.activeColor > 3)) {
    bad(`${where}: geçersiz aktif renk ${round.activeColor}`);
  }
}

/** Oynanan kart gerçekten masaya uyuyor muydu? */
function checkLegalPlay(round, seat, cardId, prevColor, prevTop) {
  const card = U.cardById(cardId);
  if (U.isWild(card)) return;
  const okColor = card.c === prevColor;
  const okNum = prevTop.kind === 'num' && card.kind === 'num' && card.num === prevTop.num;
  const okSym = prevTop.kind !== 'num' && !U.isWild(prevTop) && card.kind === prevTop.kind;
  if (!okColor && !okNum && !okSym) {
    bad(`kural dışı oynandı: ${U.cardLabel(card)} üstüne (renk ${prevColor}, üst ${U.cardLabel(prevTop)})`);
  }
}

/* --------------------------------------------------------------- oyun */
function playRound(match, stats) {
  const round = U.startRound(match, (stats.rounds * 7919 + 13) >>> 0);
  checkCards(round, 'dağıtım');
  /* açılan kart +2 ise ilk oyuncu 2 kart çekmiş olur, o yüzden esneklik var */
  const sizes = round.hands.map((h) => h.length);
  const base = match.rules.handSize;
  if (sizes.some((s) => s !== base && s !== base + 2)) bad('dağıtımda el boyutu yanlış: ' + sizes.join(','));
  if (sizes.filter((s) => s === base + 2).length > 1) bad('birden fazla oyuncuya fazladan kart verildi');

  let steps = 0;
  while (!round.finished && steps++ < 4000) {
    const level = steps % 3;

    /* renk seçimi bekleniyor */
    if (round.phase === 'color') {
      const seat = round.pendingWild.seat;
      const r = U.chooseColor(match, seat, B.pickColor(round.hands[seat], level));
      if (!r.ok) { bad('renk seçilemedi: ' + r.reason); break; }
      stats.colors++;
      continue;
    }

    /* joker+4 itirazı bekleniyor */
    if (round.phase === 'challenge') {
      const target = round.challenge.target;
      const view = U.viewFor(match, target);
      const doIt = B.shouldChallenge(view, level);
      const r = U.resolveChallenge(match, target, doIt);
      if (!r.ok) { bad('itiraz çözülemedi: ' + r.reason); break; }
      stats.challenges++;
      if (r.outcome.bluff) stats.bluffs++;
      continue;
    }

    if (round.finished) break;

    const seat = round.turn;
    const view = U.viewFor(match, seat);

    /* oynanabilir listesi gerçekten oynanabilir mi? */
    const top = U.cardById(round.discard[round.discard.length - 1]);
    for (const id of view.playable) {
      if (!U.canPlay(U.cardById(id), round.activeColor, top, round.hands[seat])) {
        bad('oynanamaz kart "oynanabilir" listesinde: ' + U.cardLabel(U.cardById(id)));
      }
    }

    const choice = B.pickCard(view, level);

    if (choice === null) {
      const before = round.hands[seat].length;
      const d = U.draw(match, seat);
      if (!d.ok) {
        if (/kalmadı/.test(d.reason)) { stats.deadlock++; break; }
        bad('çekilemedi: ' + d.reason); break;
      }
      if (round.hands[seat].length !== before + 1) bad('çekince el büyümedi');
      stats.draws++;
      if (d.playable && !round.finished && round.turn === seat) {
        const v2 = U.viewFor(match, seat);
        const pick = B.pickCard(v2, level);
        if (pick === null) { U.pass(match, seat); }
        else { doPlay(match, seat, pick, level, stats); }
      }
      checkCards(round, 'çekme sonrası');
      continue;
    }

    doPlay(match, seat, choice, level, stats);
    checkCards(round, 'oynama sonrası');
  }

  if (steps >= 4000) bad('el 4000 adımda bitmedi');
  if (!round.finished) return null;

  const res = round.result;
  if (!res) { bad('sonuç yok'); return null; }
  if (round.hands[res.winnerSeat].length !== 0) bad('kazananın elinde kart kaldı');
  const expected = round.hands.reduce((s, h, i) => s + (i === res.winnerSeat ? 0 : U.handPoints(h)), 0);
  if (res.gained !== expected) bad(`puan yanlış: ${res.gained} yerine ${expected}`);
  stats.wins[res.winnerSeat]++;
  return res;
}

function doPlay(match, seat, cardId, level, stats) {
  const round = match.round;
  const prevColor = round.activeColor;
  const prevTop = U.cardById(round.discard[round.discard.length - 1]);
  const card = U.cardById(cardId);

  /* son ikinci kartta UNO de */
  if (round.hands[seat].length === 2 && !B.forgetsUno(level)) {
    U.callUno(match, seat);
    stats.unos++;
  }

  const color = U.isWild(card)
    ? B.pickColor(round.hands[seat].filter((x) => x !== cardId), level) : undefined;
  const r = U.playCard(match, seat, cardId, color);
  if (!r.ok) { bad('oynanamadı: ' + r.reason + ' (' + U.cardLabel(card) + ')'); return; }

  checkLegalPlay(round, seat, cardId, prevColor, prevTop);
  stats.plays++;
  if (card.kind === 'wd4') stats.wd4++;

  /* UNO demeyeni bazen yakala */
  if (round.unoPending && !round.finished) {
    const victim = round.unoPending.seat;
    const catcher = (victim + 1) % match.n;
    if (catcher !== victim && Math.random() < 0.6) {
      const c = U.catchUno(match, catcher, victim);
      if (c.ok) stats.catches++;
    } else {
      U.expireUno(match);
    }
  }
}

/* ---------------------------------------------------------------- maç */
const MATCHES = parseInt(process.argv[2], 10) || 12;
const stats = { rounds: 0, plays: 0, draws: 0, unos: 0, catches: 0, challenges: 0,
                bluffs: 0, wd4: 0, colors: 0, deadlock: 0, matches: 0, wins: [0, 0, 0, 0, 0, 0] };
const t0 = Date.now();

for (let g = 0; g < MATCHES; g++) {
  const n = 2 + (g % 5);               // 2..6 oyuncu
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'O' + i, isBot: true }));
  const match = U.createGame(players, { targetScore: 200, turnSeconds: 0 });

  let guard = 0;
  while (!match.over && guard++ < 40) {
    playRound(match, stats);
    stats.rounds++;
    U.applyResult(match);
    if (problems.length > 20) break;
  }
  if (match.over) stats.matches++;
  else if (guard >= 40) bad('maç 40 elde bitmedi');

  /* puanlar tutarlı mı */
  const total = match.players.reduce((s, p) => s + p.score, 0);
  if (total < 0) bad('negatif toplam puan');
  if (problems.length > 20) break;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n  ${MATCHES} maç · ${stats.rounds} el · ${secs} sn`);
console.log(`  biten maç: ${stats.matches}/${MATCHES}`);
console.log(`  kart oynama: ${stats.plays} · çekme: ${stats.draws} · renk seçimi: ${stats.colors}`);
console.log(`  joker+4: ${stats.wd4} · itiraz: ${stats.challenges} (blöf yakalanan: ${stats.bluffs})`);
console.log(`  UNO denen: ${stats.unos} · yakalanan: ${stats.catches} · kilit: ${stats.deadlock}`);

if (problems.length) {
  console.log(`\n  ${problems.length} SORUN:`);
  for (const p of [...new Set(problems)].slice(0, 15)) console.log('   x ' + p);
  process.exit(1);
} else {
  console.log('\n  Kural ihlali yok, kart kaybı yok.\n');
}
