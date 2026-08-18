/* Satranç bot-vs-bot simülasyonu.  Çalıştır:  node tests/satranc-sim.test.js [oyun sayısı] */
'use strict';
const S = require('../src/js/satranc/engine.js');
const Bot = require('../src/js/satranc/bot.js');

const GAMES = parseInt(process.argv[2], 10) || 8;
let failCount = 0;
const fail = (msg) => { failCount++; console.log('   x ' + msg); };

const reasons = {};
let totalMoves = 0, maxMs = 0;

for (let g = 0; g < GAMES; g++) {
  const is2v2 = g % 2 === 1;
  const players = is2v2
    ? [0, 0, 1, 1].map((t, i) => ({ id: 'p' + i, name: 'B' + i, isBot: true, team: t }))
    : [{ id: 'a', name: 'A', isBot: true }, { id: 'b', name: 'B', isBot: true }];
  const m = S.createGame(players, { mode: is2v2 ? '2v2' : '1v1', rounds: 1, minutes: 0 });
  S.startRound(m, g + 1);

  let steps = 0;
  const level = g % 3 === 0 ? 1 : 2;   // farklı derinlikler de denensin
  while (!m.round.finished && steps < 400) {
    const rd = m.round;
    const side = rd.st.turn;
    const seats = S.seatsOfSide(m, rd, side);
    const seat = seats[steps % seats.length];   // 2v2: takım üyeleri dönüşümlü oynasın

    const before = S.legalMoves(rd.st).length;
    if (!before) { fail(`oyun ${g}: bitmemiş ama hamle yok`); break; }

    const t0 = Date.now();
    const mv = Bot.pickMove(rd.st, level, g * 7919 + steps);
    maxMs = Math.max(maxMs, Date.now() - t0);
    if (!mv) { fail(`oyun ${g}: bot hamle bulamadı`); break; }

    const r = S.move(m, seat, mv.from, mv.to, mv.promo);
    if (!r.ok) { fail(`oyun ${g} hamle ${steps}: ${r.reason}`); break; }
    steps++;

    /* her 25 hamlede bir: görünümler tutarlı ve fikir sızıntısı yok */
    if (steps % 25 === 0) {
      for (const p of m.players) {
        const v = S.viewFor(m, p.seat);
        if (v.board.length !== 64) fail(`oyun ${g}: tahta boyutu bozuk`);
        if (v.suggests.some((sg) => S.teamOf(m, sg.seat) !== v.myTeam)) {
          fail(`oyun ${g}: FİKİR SIZINTISI koltuk ${p.seat}`);
        }
      }
    }
  }

  if (!m.round.finished && steps >= 400) {
    fail(`oyun ${g}: 400 hamlede bitmedi`);
    continue;
  }
  if (m.round.finished) {
    const rs = m.round.result.reason;
    reasons[rs] = (reasons[rs] || 0) + 1;
    totalMoves += steps;
    S.applyResult(m);
    if (!m.over) fail(`oyun ${g}: tek turluk maç bitmedi`);
  }
}

console.log(`\n  ${GAMES} oyun oynandı, ort. ${Math.round(totalMoves / GAMES)} hamle, en yavaş hamle ${maxMs}ms`);
console.log('  bitiş sebepleri: ' + Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(', '));
console.log(failCount ? `  ${failCount} HATA\n` : '  TEMİZ\n');
if (failCount) process.exit(1);
