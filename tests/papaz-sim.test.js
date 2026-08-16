/* Papaz Kaçtı uçtan uca simülasyon.  Çalıştır: node tests/papaz-sim.test.js [maç] */
'use strict';

global.window = global;
global.Papaz = require('../src/js/papaz/engine.js');
/* bot.js tarayıcı global'lerini bekler; sadece Papaz yeterli */
require('../src/js/papaz/bot.js');

const P = global.Papaz;
const B = global.PapazBot;

const problems = [];
const bad = (m) => { if (problems.length < 40) problems.push(m); };

function checkCards(round, where) {
  const seen = new Map();
  const note = (id, src) => {
    if (seen.has(id)) bad(`${where}: kart ${id} iki yerde (${seen.get(id)} + ${src})`);
    seen.set(id, src);
  };
  round.hands.forEach((h, i) => h.forEach((id) => note(id, 'el' + i)));
  round.pairs.forEach((ps, i) => ps.forEach((p) => p.forEach((id) => note(id, 'çift' + i))));
  if (seen.size !== 49) bad(`${where}: toplam kart ${seen.size}, 49 olmalı`);

  /* yere açılan her grup gerçekten çift mi? */
  round.pairs.forEach((ps, i) => {
    ps.forEach((p) => {
      if (p.length !== 2) bad(`${where}: ${i}. oyuncuda 2'li olmayan grup`);
      else if (P.cardById(p[0]).r !== P.cardById(p[1]).r) bad(`${where}: eşleşmeyen çift yerde`);
    });
  });

  /* elde çift kalmamalı — kural gereği hemen açılır */
  round.hands.forEach((h, i) => {
    if (P.extractPairs(h).pairs.length) bad(`${where}: ${i}. oyuncunun elinde açılmamış çift var`);
  });

  /* papaz tam bir yerde ve asla çiftlenmiş olmamalı */
  const papazInPairs = round.pairs.some((ps) => ps.some((p) => p.indexOf(P.PAPAZ_ID) !== -1));
  if (papazInPairs) bad(`${where}: papaz çift yapılmış (imkânsız olmalı)`);
}

function playRound(match, stats) {
  const round = P.startRound(match, (stats.rounds * 6151 + 17) >>> 0);
  checkCards(round, 'dağıtım');
  stats.openingPairs += round.opening.reduce((a, b) => a + b, 0);

  let steps = 0;
  while (!round.finished && steps++ < 2000) {
    const seat = round.turn;
    if (round.hands[seat].length === 0) { bad('eli boş oyuncunun sırası geldi'); break; }

    const from = P.sourceSeatFor(round, seat);
    if (from === -1) { bad('kaynak bulunamadı ama el bitmedi'); break; }
    if (from === seat) { bad('oyuncu kendinden çekiyor'); break; }

    const level = seat % 3;
    const tell = B.tellIndex(round.hands[from], from, round.no, level);
    if (tell !== null && (tell < 0 || tell >= round.hands[from].length)) {
      bad('tell konumu el dışında: ' + tell);
    }
    const idx = B.pickIndex(round.hands[from].length, tell, level);
    if (idx < 0 || idx >= round.hands[from].length) { bad('bot geçersiz konum seçti: ' + idx); break; }

    const r = P.drawCard(match, seat, idx);
    if (!r.ok) { bad('çekilemedi: ' + r.reason); break; }
    stats.draws++;
    if (r.draw.matched) stats.matches++;
    if (r.draw.papaz) stats.papazMoves++;
    checkCards(round, 'çekme sonrası');
  }

  if (steps >= 2000) bad('el 2000 adımda bitmedi');
  if (!round.finished) return null;

  const res = round.result;
  if (!res) { bad('sonuç yok'); return null; }
  if (res.loserSeat === null) { bad('kaybeden belirlenemedi'); return res; }

  /* kaybedenin elinde SADECE papaz kalmalı */
  const lh = round.hands[res.loserSeat];
  if (lh.length !== 1) bad(`kaybedenin elinde ${lh.length} kart kaldı, 1 olmalı`);
  else if (!P.isPapaz(lh[0])) bad('kaybedenin elindeki kart papaz değil');

  /* diğer herkesin eli boş olmalı */
  round.hands.forEach((h, i) => {
    if (i !== res.loserSeat && h.length) bad(`${i}. oyuncunun eli bitmemiş`);
  });
  if (res.outOrder.length !== match.n - 1) {
    bad(`kurtulan sayısı ${res.outOrder.length}, ${match.n - 1} olmalı`);
  }
  if (new Set(res.outOrder).size !== res.outOrder.length) bad('kurtulma sırasında tekrar var');

  stats.losses[res.loserSeat]++;
  return res;
}

/* ------------------------------------------------------------------ maç */
const MATCHES = parseInt(process.argv[2], 10) || 20;
const stats = { rounds: 0, draws: 0, matches: 0, papazMoves: 0, openingPairs: 0,
                losses: [0, 0, 0, 0, 0, 0], done: 0 };
const t0 = Date.now();

for (let g = 0; g < MATCHES; g++) {
  const n = 2 + (g % 5);                 // 2..6 oyuncu
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'O' + i, isBot: true }));
  const match = P.createGame(players, { rounds: 3, turnSeconds: 0 });

  let guard = 0;
  while (!match.over && guard++ < 20) {
    playRound(match, stats);
    stats.rounds++;
    P.applyResult(match);
    if (problems.length > 20) break;
  }
  if (match.over) {
    stats.done++;
    /* kazanan gerçekten en az papaz kalan mı? */
    const minLoss = Math.min(...match.players.map((p) => p.losses));
    if (match.players[match.winner].losses !== minLoss) bad('kazanan en az papaz kalan değil');
    const totalLosses = match.players.reduce((a, p) => a + p.losses, 0);
    if (totalLosses !== match.rules.rounds) bad(`toplam papaz ${totalLosses}, ${match.rules.rounds} olmalı`);
  }
  if (problems.length > 20) break;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n  ${MATCHES} maç · ${stats.rounds} el · ${secs} sn`);
console.log(`  biten maç: ${stats.done}/${MATCHES}`);
console.log(`  çekilen kart: ${stats.draws} · eşleşen: ${stats.matches} · açılış çifti: ${stats.openingPairs}`);
console.log(`  papaz el değiştirdi: ${stats.papazMoves} kez`);

if (problems.length) {
  console.log(`\n  ${problems.length} SORUN:`);
  for (const p of [...new Set(problems)].slice(0, 15)) console.log('   x ' + p);
  process.exit(1);
} else {
  console.log('\n  Kural ihlali yok, kart kaybı yok, papaz hep tek.\n');
}
