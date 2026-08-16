/* Uçtan uca simülasyon: botlar tam maç oynar, kural ihlali / taş kaybı aranır.
   Çalıştır:  node tests/sim.test.js  [maçSayısı]                            */
'use strict';

global.window = global;
global.Okey101 = require('../src/js/okey/engine.js');
require('../src/js/okey/bot.js');

const E = global.Okey101;
const Bot = global.OkeyBot;

let problems = [];
const bad = (m) => problems.push(m);

/* ------------------------------------------------------------ değişmez -- */
function checkInvariants(round, where) {
  const seen = new Map();
  const note = (id, src) => {
    if (seen.has(id)) bad(`${where}: taş ${id} iki yerde (${seen.get(id)} + ${src})`);
    seen.set(id, src);
  };
  for (const id of round.pile) note(id, 'deste');
  note(round.indicatorId, 'gösterge');
  round.seats.forEach((S, i) => {
    for (const id of S.hand) note(id, `el${i}`);
    for (const id of S.discards) note(id, `atık${i}`);
    for (const m of S.melds) for (const id of m.tiles) note(id, `per${i}`);
  });
  if (seen.size !== 106) bad(`${where}: toplam taş ${seen.size}, 106 olmalı`);

  /* masadaki her per hâlâ geçerli mi? */
  for (const S of round.seats) {
    for (const m of S.melds) {
      const v = E.validateMeld(m.tiles, round.ctx);
      if (!v.ok) bad(`${where}: masadaki per geçersiz hale geldi (${m.type}) ${v.reason}`);
      if (m.type !== 'pair' && m.tiles.length < 3) bad(`${where}: 3'ten kısa per masada`);
    }
    /* açan oyuncunun tipi tutarlı mı? */
    if (S.opened) {
      const types = new Set(S.melds.map((m) => m.type === 'pair' ? 'pairs' : 'sets'));
      if (types.size > 1) bad(`${where}: bir oyuncuda hem çift hem seri var`);
    }
  }
}

/* -------------------------------------------------------------- oynat --- */
function playRound(match, seed, stats) {
  const round = E.startRound(match, seed);
  checkInvariants(round, 'dağıtım');

  let steps = 0;
  while (!round.finished && steps++ < 3000) {
    const seat = round.turn;
    const level = seat % 3;

    if (round.phase === 'draw') {
      const d = Bot.decideDraw(round, seat, level);
      let r;
      if (d === 'pass') r = E.passLastChance(round, seat);
      else if (d === 'discard') r = E.drawFromDiscard(round, seat);
      else r = E.drawFromPile(round, seat);

      if (!r.ok) {
        /* yedek: neyse onu yap */
        r = round.pile.length ? E.drawFromPile(round, seat) : E.passLastChance(round, seat);
        if (!r.ok) { bad(`çekme kilitlendi: ${r.reason}`); break; }
      }
      checkInvariants(round, 'çekme sonrası');
      continue;
    }

    const plan = Bot.planActions(round, seat, level);
    let acted = false;
    for (const s of plan) {
      if (round.finished) break;
      let r;
      if (s.t === 'open') r = E.openHand(round, seat, s.groups);
      else if (s.t === 'lay') r = E.layMeld(round, seat, s.tiles);
      else if (s.t === 'add') r = E.addToMeld(round, seat, s.mid, s.tile);
      else if (s.t === 'discard') { r = E.discard(round, seat, s.tile, true); acted = true; }
      if (!r.ok && s.t === 'discard') bad(`atma reddedildi: ${r.reason}`);
      if (r.ok && s.t === 'open') stats.opens++;
      if (!round.finished) checkInvariants(round, 'hamle sonrası (' + s.t + ')');
    }
    if (!acted && !round.finished) {
      /* plan atmadıysa güvenli at */
      const tile = Bot.pickDiscard(round, seat, level);
      const r = E.discard(round, seat, tile, true);
      if (!r.ok) { bad(`güvenli atma başarısız: ${r.reason}`); break; }
    }
  }

  if (!round.finished) { bad('el 3000 adımda bitmedi'); return null; }
  if (steps >= 3000) bad('adım sınırı aşıldı');

  const res = round.result;
  if (!res) { bad('sonuç üretilmedi'); return null; }
  if (!res.noWinner) {
    const W = round.seats[res.winnerSeat];
    if (W.hand.length !== 0) bad('kazananın elinde taş kaldı');
    if (!W.opened) bad('açmayan oyuncu bitirdi');
    stats.wins[res.winnerSeat]++;
    if (res.straightOut) stats.straight++;
    if (res.discardedOkey) stats.okeyFinish++;
    if (res.winType === 'pairs') stats.pairWins++;
  } else stats.noWinner++;

  /* puanlar sayı mı? */
  for (const row of res.rows) {
    if (!Number.isFinite(row.delta)) bad('puan sayı değil: ' + row.delta);
  }
  return res;
}

/* --------------------------------------------------------------- maç ---- */
const MATCHES = parseInt(process.argv[2], 10) || 40;
const stats = { rounds: 0, opens: 0, wins: [0, 0, 0, 0], straight: 0, okeyFinish: 0, pairWins: 0, noWinner: 0, matches: 0 };
const t0 = Date.now();

for (let g = 0; g < MATCHES; g++) {
  const match = E.createMatch(
    [{ id: 'p0', name: 'A', isBot: true }, { id: 'p1', name: 'B', isBot: true },
     { id: 'p2', name: 'C', isBot: true }, { id: 'p3', name: 'D', isBot: true }],
    {}
  );
  let guard = 0;
  while (!match.over && guard++ < 40) {
    playRound(match, (g * 1000 + guard) >>> 0, stats);
    stats.rounds++;
    E.applyResult(match);
    if (problems.length > 12) break;
  }
  if (match.over) stats.matches++;
  else if (guard >= 40) bad('maç 40 elde bitmedi');
  if (problems.length > 12) break;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n  ${MATCHES} maç · ${stats.rounds} el · ${secs} sn`);
console.log(`  biten maç: ${stats.matches}/${MATCHES}`);
console.log(`  el açma: ${stats.opens} · kazanma dağılımı: ${stats.wins.join(' / ')}`);
console.log(`  elden bitirme: ${stats.straight} · okeyle bitirme: ${stats.okeyFinish} · çiftten: ${stats.pairWins} · kazanansız: ${stats.noWinner}`);

if (problems.length) {
  console.log(`\n  ${problems.length} SORUN:`);
  const uniq = [...new Set(problems)].slice(0, 15);
  for (const p of uniq) console.log('   x ' + p);
  process.exit(1);
} else {
  console.log('\n  Kural ihlali yok, taş kaybı yok.\n');
}
