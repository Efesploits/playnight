/* =============================================================================
 *  PLAY NIGHT — PAPAZ KAÇTI KURAL MOTORU
 *  Saf JavaScript, DOM bağımsız. Host (oda kurucu) otoriter olarak çalıştırır.
 *
 *  Kural kaynakları: hurriyet.com.tr aile, milliyet.com.tr oyun,
 *  sabah.com.tr yaşam, oyunkurallari.org
 *
 *  ÖZET
 *   - 52'lik desteden 3 papaz çıkarılır -> 49 kart (24 çift + tek papaz)
 *   - Kartlar herkese olabildiğince eşit dağıtılır
 *   - Oyun başlamadan herkes elindeki çiftleri yere açar (renk değil, SAYI eşleşir)
 *   - Sırayla her oyuncu sağındaki oyuncunun elinden görmeden bir kart çeker
 *   - Çekilen kart bir çift oluşturursa o da yere açılır
 *   - Eli biten oyuncu kurtulur, oyundan çıkar
 *   - Sonunda elinde tek papaz kalan oyuncu kaybeder
 * ========================================================================== */
(function (global) {
  'use strict';

  /* maça, kupa, karo, sinek */
  const SUITS = ['maca', 'kupa', 'karo', 'sinek'];
  const SUIT_SYM = ['♠', '♥', '♦', '♣'];
  const SUIT_LABEL = ['Maça', 'Kupa', 'Karo', 'Sinek'];
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const RANK_NAME = { 1: 'As', 11: 'Vale', 12: 'Kız', 13: 'Papaz' };

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 6;

  const DEFAULT_RULES = {
    rounds: 5,            // maç kaç elden oluşur
    turnSeconds: 25,      // 0 = süre yok
    revealPause: true,    // çekilen kart çevrilirken bekleme (görsel)
  };

  /* ------------------------------------------------------------ deste -- */
  /**
   * 49 kart: 4 renkte A-Q (48) + tek maça papaz.
   * Diğer üç papaz desteden çıkarılmıştır.
   */
  function buildDeck() {
    const cards = [];
    let id = 0;
    for (let s = 0; s < 4; s++) {
      for (let r = 1; r <= 12; r++) cards.push({ id: id++, s, r });
    }
    cards.push({ id: id++, s: 0, r: 13 });   // maça papaz — tek ve eşsiz
    return cards;
  }

  const DECK = buildDeck();
  const cardById = (id) => DECK[id];
  const PAPAZ_ID = DECK[DECK.length - 1].id;
  const isPapaz = (id) => id === PAPAZ_ID;

  function cardLabel(card) {
    const r = RANK_LABEL[card.r] || String(card.r);
    if (card.r === 13) return 'Papaz';
    return `${SUIT_LABEL[card.s]} ${RANK_NAME[card.r] || r}`;
  }

  /* ------------------------------------------------------ karıştırma --- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ------------------------------------------------------------ çiftler */
  /**
   * Eldeki tüm çiftleri çıkarır. Eşleşme SAYIYA göredir, renk önemsizdir.
   * @returns {{pairs: Array<[number,number]>, rest: number[]}}
   */
  function extractPairs(hand) {
    const byRank = new Map();
    for (const id of hand) {
      const r = cardById(id).r;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r).push(id);
    }
    const pairs = [];
    const rest = [];
    for (const [, ids] of byRank) {
      let i = 0;
      for (; i + 1 < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
      for (; i < ids.length; i++) rest.push(ids[i]);
    }
    return { pairs, rest };
  }

  /** Eldeki bir kartla eşleşen ilk kartı bul (çekilen kart için). */
  function findMatch(hand, cardId) {
    const r = cardById(cardId).r;
    for (const id of hand) {
      if (id !== cardId && cardById(id).r === r) return id;
    }
    return null;
  }

  /* ----------------------------------------------------------- kurulum - */
  function createGame(players, rules) {
    const r = Object.assign({}, DEFAULT_RULES, rules || {});
    const n = players.length;
    if (n < MIN_PLAYERS) throw new Error('En az 2 oyuncu gerekir');
    if (n > MAX_PLAYERS) throw new Error('En fazla 6 oyuncu');
    return {
      rules: r,
      players: players.map((p, i) => ({
        seat: i, id: p.id, name: p.name, color: p.color || 0,
        acc: p.acc || null,                 // 3B karakter aksesuarları
        isBot: !!p.isBot, connected: p.connected !== false,
        losses: 0, saves: 0,
      })),
      n,
      roundNo: 0,
      dealer: 0,
      round: null,
      over: false,
      loser: null,     // maçı kaybeden (en çok papaz kalan)
      winner: null,
      history: [],
    };
  }

  function startRound(match, seed) {
    const rnd = mulberry32(seed >>> 0);
    const n = match.n;
    const order = shuffle(DECK.map((c) => c.id), rnd);

    /* olabildiğince eşit dağıt; artanlar baştan birer fazla alır */
    const hands = Array.from({ length: n }, () => []);
    order.forEach((id, i) => hands[i % n].push(id));

    /* açılış çiftleri: herkes elindeki çiftleri yere açar */
    const opening = [];
    const pairs = [];
    for (let s = 0; s < n; s++) {
      const { pairs: p, rest } = extractPairs(hands[s]);
      hands[s] = shuffle(rest, rnd);      // el karıştırılır, kimse sırayı bilmesin
      pairs.push(p);
      opening.push(p.length);
    }

    /* dağıtanın sağındaki başlar */
    let starter = (match.dealer + 1) % n;
    let guard = 0;
    while (hands[starter].length === 0 && guard++ < n) starter = (starter + 1) % n;

    match.roundNo++;
    match.round = {
      no: match.roundNo,
      rules: match.rules,
      hands,
      pairs,                    // her oyuncunun yere açtığı çiftler
      opening,                  // açılışta kaç çift açıldı (animasyon için)
      out: hands.map((h) => h.length === 0),
      outOrder: [],             // kurtulma sırası
      turn: starter,
      phase: 'play',            // play | over
      lastDraw: null,           // {by, from, cardId, matched, pair}
      turnEndsAt: match.rules.turnSeconds ? Date.now() + match.rules.turnSeconds * 1000 : null,
      log: [],
      finished: false,
      result: null,
      startedAt: Date.now(),
    };

    /* açılışta eli biten olduysa hemen kurtulmuş sayılır */
    for (let s = 0; s < n; s++) if (match.round.out[s]) match.round.outOrder.push(s);

    checkEnd(match);
    return match.round;
  }

  /* -------------------------------------------------------- yardımcılar */
  const alive = (round) => round.hands.reduce((a, h, i) => (h.length ? a.concat(i) : a), []);

  /**
   * Sıradaki oyuncunun kart çekeceği kişi: sağındaki (turda kendinden önceki)
   * eli boş olmayan oyuncu.
   */
  function sourceSeatFor(round, seat) {
    const n = round.hands.length;
    for (let k = 1; k < n; k++) {
      const s = ((seat - k) % n + n) % n;
      if (round.hands[s].length > 0) return s;
    }
    return -1;
  }

  /** Sırayı, eli boş olmayan bir sonraki oyuncuya taşı. */
  function advanceTurn(round) {
    const n = round.hands.length;
    for (let k = 1; k <= n; k++) {
      const s = (round.turn + k) % n;
      if (round.hands[s].length > 0) { round.turn = s; break; }
    }
    round.turnEndsAt = round.rules.turnSeconds ? Date.now() + round.rules.turnSeconds * 1000 : null;
  }

  /* ------------------------------------------------------------- hamle - */
  const fail = (reason) => ({ ok: false, reason });

  /**
   * Sağdaki oyuncunun elinden `index` konumundaki kartı çek.
   * Kart yüzü çekene kadar kimseye görünmez; index yalnızca konum belirtir.
   */
  function drawCard(match, seat, index) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (round.phase !== 'play') return fail('Şu an kart çekilemez');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.hands[seat].length === 0) return fail('Eliniz zaten boş');

    const from = sourceSeatFor(round, seat);
    if (from === -1) return fail('Kart çekilecek kimse yok');

    const src = round.hands[from];
    const i = Math.max(0, Math.min(src.length - 1, parseInt(index, 10) || 0));
    const cardId = src.splice(i, 1)[0];

    /* eşleşme var mı? */
    const match2 = findMatch(round.hands[seat], cardId);
    let pair = null;
    if (match2 !== null) {
      round.hands[seat].splice(round.hands[seat].indexOf(match2), 1);
      pair = [cardId, match2];
      round.pairs[seat].push(pair);
    } else {
      /* eşleşmeyen kart ele rastgele bir yere sokulur (gerçek hayattaki gibi) */
      const rnd = mulberry32((Date.now() ^ (cardId * 2654435761)) >>> 0);
      const pos = Math.floor(rnd() * (round.hands[seat].length + 1));
      round.hands[seat].splice(pos, 0, cardId);
    }

    round.lastDraw = { by: seat, from, cardId, matched: !!pair, pair, papaz: isPapaz(cardId) };
    round.log.push({ t: 'draw', by: seat, from, matched: !!pair, papaz: isPapaz(cardId) });

    /* eli biten kurtulur */
    for (const s of [seat, from]) {
      if (round.hands[s].length === 0 && !round.out[s]) {
        round.out[s] = true;
        round.outOrder.push(s);
        round.log.push({ t: 'out', seat: s });
      }
    }

    if (checkEnd(match)) return { ok: true, finished: true, result: round.result, draw: round.lastDraw };

    advanceTurn(round);
    return { ok: true, draw: round.lastDraw, turn: round.turn };
  }

  /**
   * Oyuncu kendi elini yeniden dizer.
   *
   * Bu sadece görsel değildir: rakip senin elinden KONUMA göre kart çeker,
   * dolayısıyla papazı saklamanın gerçek yolu kartları karıştırmaktır.
   * Adil olsun diye, sıradaki oyuncu tam senden çekmek üzereyken karıştırılamaz.
   *
   * @param order eldeki kartların yeni sırası (aynı kartların permütasyonu)
   */
  function reorderHand(match, seat, order) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (!Array.isArray(order)) return fail('Geçersiz sıralama');

    const hand = round.hands[seat];
    if (order.length !== hand.length) return fail('Kart sayısı uyuşmuyor');

    /* gerçekten aynı kartların bir permütasyonu mu? */
    const a = hand.slice().sort((x, y) => x - y);
    const b = order.slice().sort((x, y) => x - y);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return fail('Elinizde olmayan kart');
    }

    if (sourceSeatFor(round, round.turn) === seat) {
      return fail('Sıradaki oyuncu senden kart çekiyor, şimdi karıştıramazsın');
    }

    round.hands[seat] = order.slice();
    return { ok: true };
  }

  /** Tek oyuncu kaldıysa el biter; papaz ondadır. */
  function checkEnd(match) {
    const round = match.round;
    if (round.finished) return true;
    const left = alive(round);
    if (left.length > 1) return false;

    const loser = left.length === 1 ? left[0] : null;
    round.finished = true;
    round.phase = 'over';
    round.turnEndsAt = null;
    round.result = {
      loserSeat: loser,
      outOrder: round.outOrder.slice(),
      pairCounts: round.pairs.map((p) => p.length),
      finishedAt: Date.now(),
    };
    return true;
  }

  /** El sonucunu maça işle. */
  function applyResult(match) {
    const res = match.round && match.round.result;
    if (!res) return null;
    if (res.loserSeat !== null && res.loserSeat !== undefined) {
      match.players[res.loserSeat].losses++;
    }
    for (const s of res.outOrder) match.players[s].saves++;
    match.history.push({ no: match.round.no, loserSeat: res.loserSeat, outOrder: res.outOrder.slice() });
    match.dealer = (match.dealer + 1) % match.n;

    if (match.roundNo >= match.rules.rounds) {
      match.over = true;
      /* en az papaz kalan kazanır; eşitlikte daha erken kurtulan */
      const rank = match.players.slice().sort((a, b) => a.losses - b.losses || b.saves - a.saves);
      match.winner = rank[0].seat;
      match.loser = rank[rank.length - 1].seat;
    }
    return {
      over: match.over, winner: match.winner, loser: match.loser,
      roundsLeft: Math.max(0, match.rules.rounds - match.roundNo),
    };
  }

  /* ---------------------------------------------------- oyuncu görünümü */
  /**
   * Bir koltuğa yollanacak durum.
   * Kendi elin açık; başkalarının elleri yalnızca sayı olarak görünür.
   * Sıra sendeyse kart çekeceğin oyuncunun el büyüklüğü verilir (kartlar değil).
   */
  function viewFor(match, seat) {
    const round = match.round;
    const myTurn = round.turn === seat && !round.finished;
    const from = myTurn ? sourceSeatFor(round, seat) : -1;

    return {
      roundNo: round.no,
      rounds: match.rules.rounds,
      rules: match.rules,
      mySeat: seat,
      turn: round.turn,
      phase: round.phase,
      finished: round.finished,
      turnEndsAt: round.turnEndsAt,
      myHand: round.hands[seat].slice(),
      myPairs: round.pairs[seat].map((p) => p.slice()),
      drawFrom: from,
      drawCount: from >= 0 ? round.hands[from].length : 0,
      /* biri senden çekmek üzereyse elini karıştıramazsın */
      canReorder: !round.finished && sourceSeatFor(round, round.turn) !== seat,
      lastDraw: round.lastDraw
        ? {
          by: round.lastDraw.by, from: round.lastDraw.from,
          matched: round.lastDraw.matched, papaz: round.lastDraw.papaz,
          /* çekilen kart yalnızca çeken oyuncuya ve eşleştiyse herkese açıktır */
          cardId: (round.lastDraw.by === seat || round.lastDraw.matched) ? round.lastDraw.cardId : null,
          pair: round.lastDraw.pair ? round.lastDraw.pair.slice() : null,
        }
        : null,
      players: match.players.map((p, i) => ({
        seat: i, id: p.id, name: p.name, color: p.color, acc: p.acc,
        isBot: p.isBot, connected: p.connected,
        cards: round.hands[i].length,       // yalnızca SAYI — kartlar asla gitmez
        pairs: round.pairs[i].length,
        out: round.out[i],
        losses: p.losses,
      })),
      result: round.result,
    };
  }

  const Papaz = {
    SUITS, SUIT_SYM, SUIT_LABEL, RANK_LABEL, RANK_NAME,
    MIN_PLAYERS, MAX_PLAYERS, DEFAULT_RULES,
    DECK, buildDeck, cardById, PAPAZ_ID, isPapaz, cardLabel,
    extractPairs, findMatch, sourceSeatFor, alive,
    createGame, startRound, drawCard, reorderHand, applyResult, viewFor, checkEnd,
    mulberry32, shuffle,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Papaz;
  global.Papaz = Papaz;
})(typeof window !== 'undefined' ? window : globalThis);
