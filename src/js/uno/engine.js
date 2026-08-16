/* =============================================================================
 *  PLAY NIGHT — UNO KURAL MOTORU
 *  Saf JavaScript, DOM bağımsız. Host (oda kurucu) otoriter olarak çalıştırır.
 *
 *  Kural kaynağı: unorules.com (resmi kurallar) ve Mattel resmi kural kitapçığı.
 *
 *  ÖZET
 *   - 108 kart: her renkte bir 0, ikişer 1-9, ikişer Skip/Reverse/+2
 *     (renk başına 25) + 4 Joker + 4 Joker+4
 *   - Herkese 7 kart, üstten bir kart açılır
 *   - Renk, sayı ya da sembol eşleştirerek oyna; joker her zaman oynanır
 *   - Oynayamıyorsan bir kart çek; çektiğin oynanabiliyorsa hemen oynayabilirsin
 *   - Joker+4 yalnızca elinde masadaki RENKTEN kart yokken oynanır (itiraz edilebilir)
 *   - Son ikinci kartı oynarken "UNO" demezsen ve yakalanırsan 2 kart çekersin
 *   - Puanlama: sayı kartları değeri, aksiyon kartları 20, jokerler 50
 * ========================================================================== */
(function (global) {
  'use strict';

  const COLORS = ['kirmizi', 'sari', 'yesil', 'mavi'];
  const COLOR_LABEL = ['Kırmızı', 'Sarı', 'Yeşil', 'Mavi'];
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 6;

  const DEFAULT_RULES = {
    handSize: 7,
    targetScore: 500,      // bu puana ulaşan maçı kazanır
    turnSeconds: 30,       // 0 = süre yok
    challengeSeconds: 8,   // Joker+4 itiraz penceresi
    unoCatchSeconds: 4,    // "UNO" demeyeni yakalama süresi
    unoPenalty: 2,         // UNO demeyi unutmanın cezası
    challengeEnabled: true,
  };

  /* ----------------------------------------------------------- deste --- */
  function buildDeck() {
    const cards = [];
    let id = 0;
    for (let c = 0; c < 4; c++) {
      cards.push({ id: id++, c, kind: 'num', num: 0 });
      for (let n = 1; n <= 9; n++) {
        cards.push({ id: id++, c, kind: 'num', num: n });
        cards.push({ id: id++, c, kind: 'num', num: n });
      }
      for (const k of ['skip', 'rev', 'd2']) {
        cards.push({ id: id++, c, kind: k, num: null });
        cards.push({ id: id++, c, kind: k, num: null });
      }
    }
    for (let i = 0; i < 4; i++) cards.push({ id: id++, c: null, kind: 'wild', num: null });
    for (let i = 0; i < 4; i++) cards.push({ id: id++, c: null, kind: 'wd4', num: null });
    return cards; // 108
  }

  const DECK = buildDeck();
  const cardById = (id) => DECK[id];
  const isWild = (card) => card.kind === 'wild' || card.kind === 'wd4';

  /** Kartın puan değeri (el sonu hesabı). */
  function cardPoints(card) {
    if (card.kind === 'num') return card.num;
    if (card.kind === 'wild' || card.kind === 'wd4') return 50;
    return 20; // skip, rev, d2
  }

  const handPoints = (ids) => ids.reduce((s, id) => s + cardPoints(cardById(id)), 0);

  /** Kartın okunabilir etiketi. */
  function cardLabel(card) {
    if (card.kind === 'num') return `${COLOR_LABEL[card.c]} ${card.num}`;
    if (card.kind === 'skip') return `${COLOR_LABEL[card.c]} Pas`;
    if (card.kind === 'rev') return `${COLOR_LABEL[card.c]} Yön Değiştir`;
    if (card.kind === 'd2') return `${COLOR_LABEL[card.c]} +2`;
    if (card.kind === 'wild') return 'Joker';
    return 'Joker +4';
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
  function shuffle(ids, rnd) {
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* -------------------------------------------------------- oynanırlık - */
  /**
   * Kart şu anki masaya oynanabilir mi?
   *
   * Not: Joker+4 her zaman "oynanabilir" sayılır. Resmi kurala göre onu ancak
   * elinde masadaki renkten kart yokken oynamalısın — ama kural bunu fiziksel
   * olarak engellemez, <b>blöf yapabilirsin</b>. Yaptırım itiraz mekanizmasıdır:
   * blöf yakalanırsa 4 kart çekersin. Bu yüzden motor blöfü engellemez,
   * yalnızca yasallığı kaydeder (bkz. isWd4Legal).
   */
  function canPlay(card, activeColor, topCard, hand) {
    if (isWild(card)) return true;
    if (card.c === activeColor) return true;
    if (topCard.kind === 'num' && card.kind === 'num' && card.num === topCard.num) return true;
    if (topCard.kind !== 'num' && !isWild(topCard) && card.kind === topCard.kind) return true;
    return false;
  }

  /**
   * Joker+4 kurallara uygun mu oynanıyor?
   * Elde masadaki RENKTEN başka kart varsa blöftür.
   * @param exceptId  Joker+4'ün kendisi sayılmaz
   */
  function isWd4Legal(hand, activeColor, exceptId) {
    return !hand.some((id) => id !== exceptId && cardById(id).c === activeColor);
  }

  /** Elde oynanabilecek kartların id listesi. */
  function playableCards(state, seat) {
    const hand = state.hands[seat];
    const top = cardById(state.discard[state.discard.length - 1]);
    return hand.filter((id) => canPlay(cardById(id), state.activeColor, top, hand));
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
        isBot: !!p.isBot, connected: p.connected !== false,
        score: 0, roundsWon: 0,
      })),
      n,
      roundNo: 0,
      dealer: 0,
      round: null,
      over: false,
      winner: null,
      history: [],
    };
  }

  /** Yeni el dağıt. Açılan ilk kartın kuralları burada uygulanır. */
  function startRound(match, seed) {
    const rnd = mulberry32(seed >>> 0);
    const n = match.n;
    const r = match.rules;

    let pile = shuffle(DECK.map((c) => c.id), rnd);
    const hands = [];
    for (let s = 0; s < n; s++) hands.push(pile.splice(0, r.handSize));

    /* ilk kart Joker+4 ise desteye geri konur ve yenisi açılır */
    let firstIdx = 0;
    while (cardById(pile[firstIdx]).kind === 'wd4' && firstIdx < pile.length - 1) firstIdx++;
    const firstId = pile.splice(firstIdx, 1)[0];
    const first = cardById(firstId);

    const starter = (match.dealer + 1) % n;

    const round = {
      no: match.roundNo + 1,
      rules: r,                      // süre hesapları için elde tutulur
      hands,
      drawPile: pile,
      discard: [firstId],
      activeColor: first.c,          // joker ise aşağıda null kalır
      turn: starter,
      dir: 1,
      phase: 'play',                 // play | color | challenge | over
      drawnCard: null,               // bu turda çekilen, oynanabilecek kart
      hasDrawn: false,
      saidUno: new Array(n).fill(false),
      unoPending: null,              // {seat, until}
      pendingWild: null,             // {seat, cardId} renk bekleniyor
      challenge: null,               // {target, by, legal, until, chosenColor}
      reveal: null,                  // {to, seat, cards} itiraz sonrası el gösterimi
      turnEndsAt: null,
      log: [],
      finished: false,
      result: null,
      startedAt: Date.now(),
    };

    /* --- açılan ilk kartın etkisi --- */
    if (first.kind === 'wild') {
      /* ilk oyuncu rengi seçer */
      round.activeColor = null;
      round.phase = 'color';
      round.pendingWild = { seat: starter, cardId: firstId, fromFlip: true };
      round.log.push({ t: 'flip', kind: 'wild' });
    } else if (first.kind === 'skip') {
      round.log.push({ t: 'flip', kind: 'skip', seat: starter });
      round.turn = nextSeat(round, starter);
    } else if (first.kind === 'rev') {
      round.dir = -1;
      /* yön dönünce dağıtanın solundaki değil sağındaki başlar */
      round.turn = ((match.dealer - 1) % n + n) % n;
      round.log.push({ t: 'flip', kind: 'rev' });
    } else if (first.kind === 'd2') {
      drawCards(round, starter, 2);
      round.log.push({ t: 'flip', kind: 'd2', seat: starter });
      round.turn = nextSeat(round, starter);
    }

    round.turnEndsAt = r.turnSeconds ? Date.now() + r.turnSeconds * 1000 : null;

    match.roundNo++;
    match.round = round;
    return round;
  }

  const nextSeat = (round, from) => ((from + round.dir) % round.hands.length + round.hands.length) % round.hands.length;

  /* -------------------------------------------------- deste yönetimi --- */
  /** Deste bitince atık yığını (üst kart hariç) karıştırılıp yeniden kullanılır. */
  function refillDraw(round) {
    if (round.drawPile.length) return true;
    if (round.discard.length <= 1) return false;
    const top = round.discard.pop();
    const rest = round.discard;
    round.discard = [top];
    /* jokerlerin seçilmiş rengi sıfırlanır (karta yazılı değil, durumda tutulur) */
    const rnd = mulberry32((Date.now() ^ rest.length * 2654435761) >>> 0);
    round.drawPile = shuffle(rest, rnd);
    round.log.push({ t: 'reshuffle', count: round.drawPile.length });
    return true;
  }

  function drawCards(round, seat, count) {
    const taken = [];
    for (let i = 0; i < count; i++) {
      if (!round.drawPile.length && !refillDraw(round)) break;
      const id = round.drawPile.shift();
      round.hands[seat].push(id);
      taken.push(id);
    }
    /* kart çeken oyuncunun UNO durumu düşer */
    if (round.hands[seat].length > 1) round.saidUno[seat] = false;
    return taken;
  }

  /* ------------------------------------------------------------ hamle -- */
  const fail = (reason) => ({ ok: false, reason });

  function resetTurnFlags(round) {
    round.hasDrawn = false;
    round.drawnCard = null;
  }

  function advanceTurn(round, skip) {
    let next = nextSeat(round, round.turn);
    if (skip) next = nextSeat(round, next);
    round.turn = next;
    resetTurnFlags(round);
    const secs = round.rules ? round.rules.turnSeconds : 0;
    round.turnEndsAt = secs ? Date.now() + secs * 1000 : null;
    return next;
  }

  /**
   * Kart oyna.
   * @param chosenColor joker kartlar için 0..3 (yoksa 'color' aşamasına geçilir)
   */
  function playCard(match, seat, cardId, chosenColor) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (round.phase === 'challenge') return fail('Önce itiraz kararı verilmeli');
    if (round.phase === 'color') return fail('Önce renk seçilmeli');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (!round.hands[seat].includes(cardId)) return fail('Elinizde olmayan kart');

    const card = cardById(cardId);
    const top = cardById(round.discard[round.discard.length - 1]);
    const hand = round.hands[seat];

    /* bu turda kart çektiysen yalnızca o kartı oynayabilirsin */
    if (round.hasDrawn && round.drawnCard !== null && cardId !== round.drawnCard) {
      return fail('Çektiğin kartı oynayabilir ya da pas geçebilirsin');
    }

    if (!canPlay(card, round.activeColor, top, hand)) return fail('Bu kart masaya uymuyor');

    /* Joker+4 kurallara uygun muydu? Blöf serbesttir, yaptırımı itirazdır. */
    const wd4Legal = card.kind === 'wd4' ? isWd4Legal(hand, round.activeColor, cardId) : null;

    /* kartı elden çıkar ve masaya koy */
    hand.splice(hand.indexOf(cardId), 1);
    round.discard.push(cardId);
    resetTurnFlags(round);
    round.log.push({ t: 'play', seat, cardId, kind: card.kind });

    /* renk belirle */
    if (isWild(card)) {
      if (chosenColor === null || chosenColor === undefined) {
        round.phase = 'color';
        round.pendingWild = { seat, cardId, wd4Legal };
        return { ok: true, needColor: true };
      }
      round.activeColor = clampColor(chosenColor);
    } else {
      round.activeColor = card.c;
    }

    return afterPlay(match, seat, card, wd4Legal);
  }

  const clampColor = (c) => (c === 0 || c === 1 || c === 2 || c === 3 ? c : 0);

  /** Joker oynandıktan sonra renk seçimi. */
  function chooseColor(match, seat, color) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (round.phase !== 'color' || !round.pendingWild) return fail('Renk seçimi beklenmiyor');
    if (round.pendingWild.seat !== seat) return fail('Rengi seçecek oyuncu siz değilsiniz');

    const pw = round.pendingWild;
    round.activeColor = clampColor(color);
    round.pendingWild = null;
    round.phase = 'play';
    round.log.push({ t: 'color', seat, color: round.activeColor });

    /* açılış kartı jokerse: renk seçildi, sıra aynı oyuncuda kalır */
    if (pw.fromFlip) return { ok: true, flip: true };

    return afterPlay(match, seat, cardById(pw.cardId), pw.wd4Legal);
  }

  /** Kart masaya kondu: etkileri uygula, bitiş ve UNO kontrolü yap. */
  function afterPlay(match, seat, card, wd4Legal) {
    const round = match.round;
    const r = match.rules;
    const hand = round.hands[seat];

    /* --- UNO durumu --- */
    if (hand.length === 1 && !round.saidUno[seat]) {
      round.unoPending = { seat, until: Date.now() + r.unoCatchSeconds * 1000 };
    }

    /* --- el bitti mi? --- */
    if (hand.length === 0) {
      /* son kart +2 / +4 ise sonraki oyuncu yine de çeker */
      if (card.kind === 'd2') drawCards(round, nextSeat(round, seat), 2);
      else if (card.kind === 'wd4') drawCards(round, nextSeat(round, seat), 4);
      return finishRound(match, seat);
    }

    /* --- aksiyon etkileri --- */
    switch (card.kind) {
      case 'skip':
        round.log.push({ t: 'skip', seat: nextSeat(round, seat) });
        advanceTurn(round, true);
        break;

      case 'rev':
        if (round.hands.length === 2) {
          /* iki kişilikte Yön Değiştir, Pas gibi davranır */
          round.log.push({ t: 'rev2' });
          advanceTurn(round, true);
        } else {
          round.dir *= -1;
          round.log.push({ t: 'rev', dir: round.dir });
          advanceTurn(round, false);
        }
        break;

      case 'd2': {
        const target = nextSeat(round, seat);
        drawCards(round, target, 2);
        round.log.push({ t: 'draw2', seat: target });
        advanceTurn(round, true);
        break;
      }

      case 'wd4': {
        const target = nextSeat(round, seat);
        if (match.rules.challengeEnabled) {
          round.phase = 'challenge';
          round.challenge = {
            target, by: seat, legal: wd4Legal !== false,
            until: Date.now() + r.challengeSeconds * 1000,
          };
          round.log.push({ t: 'wd4', seat, target });
          return { ok: true, challenge: true, target };
        }
        drawCards(round, target, 4);
        advanceTurn(round, true);
        break;
      }

      default:
        advanceTurn(round, false);
    }

    round.turnEndsAt = r.turnSeconds ? Date.now() + r.turnSeconds * 1000 : null;
    return { ok: true, turn: round.turn };
  }

  /**
   * Joker+4 itirazı.
   * Resmi kural: blöf yakalanırsa oynayan 4 çeker ve sıra itiraz edene geçer;
   * itiraz haksızsa itiraz eden 4 yerine 6 kart çeker ve sırasını kaybeder.
   */
  function resolveChallenge(match, seat, doChallenge) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (round.phase !== 'challenge' || !round.challenge) return fail('İtiraz beklenmiyor');
    if (round.challenge.target !== seat) return fail('İtiraz hakkı sizde değil');

    const ch = round.challenge;
    const r = match.rules;
    let outcome;

    if (!doChallenge) {
      drawCards(round, seat, 4);
      outcome = { challenged: false, drew: 4, by: ch.by, target: seat };
      round.challenge = null;
      round.phase = 'play';
      round.turn = seat;
      advanceTurn(round, false);           // itiraz etmeyen sırasını kaybeder
    } else if (!ch.legal) {
      /* blöf yakalandı: oynayan 4 çeker, sıra itiraz edene geçer */
      drawCards(round, ch.by, 4);
      outcome = { challenged: true, bluff: true, drew: 4, by: ch.by, target: seat };
      round.reveal = { to: seat, seat: ch.by, cards: round.hands[ch.by].slice() };
      round.challenge = null;
      round.phase = 'play';
      round.turn = seat;                    // itiraz eden normal oynar
      resetTurnFlags(round);
    } else {
      /* itiraz haksız: itiraz eden 6 çeker ve sırasını kaybeder */
      drawCards(round, seat, 6);
      outcome = { challenged: true, bluff: false, drew: 6, by: ch.by, target: seat };
      round.reveal = { to: seat, seat: ch.by, cards: round.hands[ch.by].slice() };
      round.challenge = null;
      round.phase = 'play';
      round.turn = seat;
      advanceTurn(round, false);
    }

    round.turnEndsAt = r.turnSeconds ? Date.now() + r.turnSeconds * 1000 : null;
    round.log.push({ t: 'challenge', ...outcome });
    return { ok: true, outcome };
  }

  /** Süre dolarsa itiraz edilmemiş sayılır. */
  function autoResolveChallenge(match) {
    const round = match.round;
    if (!round || round.phase !== 'challenge' || !round.challenge) return null;
    if (Date.now() < round.challenge.until) return null;
    return resolveChallenge(match, round.challenge.target, false);
  }

  /* ------------------------------------------------------------- çekme - */
  function draw(match, seat) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (round.phase !== 'play') return fail('Şu an kart çekilemez');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.hasDrawn) return fail('Bu turda zaten kart çektin');

    const taken = drawCards(round, seat, 1);
    if (!taken.length) return fail('Çekilecek kart kalmadı');

    round.hasDrawn = true;
    const card = cardById(taken[0]);
    const top = cardById(round.discard[round.discard.length - 1]);
    const playable = canPlay(card, round.activeColor, top, round.hands[seat]);
    round.drawnCard = playable ? taken[0] : null;
    round.log.push({ t: 'draw', seat });

    /* çekilen kart oynanamıyorsa tur biter */
    if (!playable) {
      advanceTurn(round, false);
      round.turnEndsAt = match.rules.turnSeconds ? Date.now() + match.rules.turnSeconds * 1000 : null;
      return { ok: true, card: taken[0], playable: false, turn: round.turn };
    }
    return { ok: true, card: taken[0], playable: true };
  }

  /** Çekilen kartı oynamayıp turu bitir. */
  function pass(match, seat) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    if (round.phase !== 'play') return fail('Şu an pas geçilemez');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (!round.hasDrawn) return fail('Pas geçmek için önce kart çekmelisin');

    round.log.push({ t: 'pass', seat });
    advanceTurn(round, false);
    round.turnEndsAt = match.rules.turnSeconds ? Date.now() + match.rules.turnSeconds * 1000 : null;
    return { ok: true, turn: round.turn };
  }

  /* --------------------------------------------------------------- UNO - */
  /** "UNO!" de — son kartına inerken ceza yememek için. */
  function callUno(match, seat) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    const len = round.hands[seat].length;
    /* iki kartlıyken önden, tek kartlıyken pencere kapanmadan denebilir */
    if (len > 2) return fail('Henüz UNO diyemezsin');
    round.saidUno[seat] = true;
    if (round.unoPending && round.unoPending.seat === seat) round.unoPending = null;
    round.log.push({ t: 'uno', seat });
    return { ok: true };
  }

  /** UNO demeyi unutanı yakala. */
  function catchUno(match, byS, targetSeat) {
    const round = match.round;
    if (!round || round.finished) return fail('El bitti');
    const p = round.unoPending;
    if (!p || p.seat !== targetSeat) return fail('Yakalanacak kimse yok');
    if (byS === targetSeat) return fail('Kendini yakalayamazsın');
    if (Date.now() > p.until) { round.unoPending = null; return fail('Çok geç'); }

    drawCards(round, targetSeat, match.rules.unoPenalty);
    round.unoPending = null;
    round.log.push({ t: 'caught', seat: targetSeat, by: byS, penalty: match.rules.unoPenalty });
    return { ok: true, penalty: match.rules.unoPenalty, target: targetSeat };
  }

  /** Yakalama süresi dolduysa pencereyi kapat. */
  function expireUno(match) {
    const round = match.round;
    if (!round || !round.unoPending) return false;
    if (Date.now() <= round.unoPending.until) return false;
    round.saidUno[round.unoPending.seat] = true;   // yakalanmadı, temiz
    round.unoPending = null;
    return true;
  }

  /* ------------------------------------------------------------ el sonu */
  function finishRound(match, winnerSeat) {
    const round = match.round;
    const rows = round.hands.map((h, i) => ({
      seat: i,
      cards: h.length,
      points: i === winnerSeat ? 0 : handPoints(h),
      winner: i === winnerSeat,
    }));
    const gained = rows.reduce((s, r) => s + r.points, 0);

    round.finished = true;
    round.phase = 'over';
    round.unoPending = null;
    round.challenge = null;
    round.result = { winnerSeat, gained, rows, finishedAt: Date.now() };
    return { ok: true, finished: true, result: round.result };
  }

  /** El sonucunu maça işle, maç bitti mi bak. */
  function applyResult(match) {
    const res = match.round && match.round.result;
    if (!res) return null;
    match.players[res.winnerSeat].score += res.gained;
    match.players[res.winnerSeat].roundsWon++;
    match.history.push({ no: match.round.no, winnerSeat: res.winnerSeat, gained: res.gained });
    match.dealer = (match.dealer + 1) % match.n;

    if (match.players[res.winnerSeat].score >= match.rules.targetScore) {
      match.over = true;
      match.winner = res.winnerSeat;
    }
    return {
      over: match.over, winner: match.winner,
      scores: match.players.map((p) => p.score),
    };
  }

  /* --------------------------------------------------- oyuncu görünümü - */
  /** Bir koltuğa yollanacak durum — başkalarının elleri gizlidir. */
  function viewFor(match, seat) {
    const round = match.round;
    const top = round.discard[round.discard.length - 1];
    const playable = round.phase === 'play' && round.turn === seat
      ? (round.hasDrawn && round.drawnCard !== null ? [round.drawnCard] : playableCards(round, seat))
      : [];

    return {
      roundNo: round.no,
      rules: match.rules,
      mySeat: seat,
      turn: round.turn,
      dir: round.dir,
      phase: round.phase,
      activeColor: round.activeColor,
      topCard: top,
      discardCount: round.discard.length,
      drawCount: round.drawPile.length,
      hasDrawn: round.hasDrawn,
      drawnCard: round.turn === seat ? round.drawnCard : null,
      turnEndsAt: round.turnEndsAt,
      myHand: round.hands[seat].slice(),
      playable,
      needColor: round.phase === 'color' && round.pendingWild && round.pendingWild.seat === seat,
      challenge: round.challenge
        ? { target: round.challenge.target, by: round.challenge.by, until: round.challenge.until }
        : null,
      unoPending: round.unoPending
        ? { seat: round.unoPending.seat, until: round.unoPending.until }
        : null,
      canCallUno: round.hands[seat].length <= 2 && !round.saidUno[seat],
      reveal: round.reveal && round.reveal.to === seat ? round.reveal : null,
      finished: round.finished,
      players: match.players.map((p, i) => ({
        seat: i, id: p.id, name: p.name, color: p.color,
        isBot: p.isBot, connected: p.connected, score: p.score,
        cards: round.hands[i].length,
        saidUno: round.saidUno[i],
      })),
    };
  }

  const Uno = {
    COLORS, COLOR_LABEL, MIN_PLAYERS, MAX_PLAYERS, DEFAULT_RULES,
    DECK, buildDeck, cardById, isWild, cardPoints, handPoints, cardLabel,
    canPlay, isWd4Legal, playableCards, nextSeat,
    createGame, startRound, viewFor,
    playCard, chooseColor, draw, pass,
    callUno, catchUno, expireUno,
    resolveChallenge, autoResolveChallenge,
    finishRound, applyResult, refillDraw, drawCards,
    mulberry32, shuffle,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Uno;
  global.Uno = Uno;
})(typeof window !== 'undefined' ? window : globalThis);
