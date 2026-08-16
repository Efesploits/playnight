/* =============================================================================
 *  PLAY NIGHT — UNO BOTLARI
 *  Motorun saf kurallarını kullanır. Seviyeler: 0 acemi, 1 normal, 2 usta
 * ========================================================================== */
(function (w) {
  'use strict';
  const U = w.Uno;

  /** Elde hangi renkten kaç kart var? */
  function colorCounts(hand) {
    const c = [0, 0, 0, 0];
    for (const id of hand) {
      const card = U.cardById(id);
      if (card.c !== null) c[card.c]++;
    }
    return c;
  }

  /** Joker oynarken seçilecek renk: elde en çok bulunan. */
  function pickColor(hand, level) {
    const counts = colorCounts(hand);
    if (level === 0) {
      /* acemi bot bazen rastgele seçer */
      if (Math.random() < 0.35) return Math.floor(Math.random() * 4);
    }
    let best = 0, bestN = -1;
    for (let c = 0; c < 4; c++) {
      /* eşitlikte yüksek puanlı renk tercih edilsin */
      const weight = counts[c] * 10 + hand.reduce((s, id) => {
        const k = U.cardById(id);
        return k.c === c ? s + U.cardPoints(k) / 10 : s;
      }, 0);
      if (weight > bestN) { bestN = weight; best = c; }
    }
    return best;
  }

  /**
   * Oynanacak kartı seç.
   * Öncelik: rakip UNO'daysa saldır -> aksiyon kartı -> yüksek puanı boşalt
   * -> jokerleri sona sakla.
   */
  function pickCard(view, level) {
    const options = view.playable;
    if (!options.length) return null;

    const hand = view.myHand;
    const counts = colorCounts(hand);
    const nextSeat = nextPlayer(view);
    const nextCards = nextSeat !== null ? view.players[nextSeat].cards : 9;
    const threat = nextCards <= 2;              // sonraki oyuncu bitmek üzere

    /* Blöf iştahı: yasadışı Joker+4'ü ne sıklıkla göze alır?
       Acemi bot kuralı bilmediği için sık, usta bot hesaplı davranır. */
    const bluffAppetite = level === 0 ? 0.55 : level === 1 ? 0.22 : 0.32;

    const scored = options.map((id) => {
      const card = U.cardById(id);
      let s = 0;

      if (card.kind === 'd2') s += threat ? 90 : 42;
      else if (card.kind === 'skip') s += threat ? 85 : 40;
      else if (card.kind === 'rev') s += threat ? 70 : 26;
      else if (card.kind === 'wd4') {
        const legal = U.isWd4Legal(hand, view.activeColor, id);
        if (legal) s += threat ? 78 : 8;                    // normalde saklanır
        else s += (Math.random() < bluffAppetite ? (threat ? 66 : 4) : -1000);  // blöf riski
      }
      else if (card.kind === 'wild') s += threat ? 60 : 6;
      else s += 20 + card.num;                              // yüksek sayıyı önce boşalt

      /* rengi elde çoksa o rengi sürdürmek iyi */
      if (card.c !== null) s += counts[card.c] * 3;

      /* son karta yaklaşıyorsak sadeleş: en yüksek puanlıyı at */
      if (hand.length <= 3) s += U.cardPoints(card) * 0.6;

      if (level === 0) s += Math.random() * 45;
      else if (level === 1) s += Math.random() * 14;
      return { id, s };
    });

    scored.sort((a, b) => b.s - a.s);
    /* Tek seçenek reddedilen bir blöfse kart çekmeyi tercih et.
       (Pratikte olamaz: blöf, elde uyan renk varken yapılır — o kart zaten
       oynanabilir olurdu. Yine de güvenli tarafta kalalım.) */
    if (scored[0].s <= -900) return null;
    return scored[0].id;
  }

  function nextPlayer(view) {
    const n = view.players.length;
    if (!n) return null;
    return ((view.mySeat + view.dir) % n + n) % n;
  }

  /**
   * Joker+4 itirazı: rakip bu turdan önce masadaki renkten kart oynamışsa
   * ya da eli kalabalıksa blöf ihtimali yüksektir.
   */
  function shouldChallenge(view, level) {
    if (level === 0) return Math.random() < 0.18;
    const byCards = view.players[view.challenge.by].cards;
    /* Eli kalabalık olanın masadaki renkten kartı olma ihtimali yüksektir,
       yani blöf şansı artar. Az kartlıyken genelde dürüsttür. */
    const base = byCards >= 6 ? 0.48 : byCards >= 4 ? 0.34 : 0.18;
    return Math.random() < (level === 2 ? base + 0.08 : base);
  }

  /** Botun "düşünme" süresi. */
  function thinkMs(level, kind) {
    if (kind === 'color') return 500 + Math.random() * 500;
    if (kind === 'challenge') return 900 + Math.random() * 1400;
    const base = 900;
    const spread = level === 2 ? 500 : 1100;
    return base + Math.random() * spread;
  }

  /** Bot "UNO" demeyi unutur mu? */
  function forgetsUno(level) {
    if (level === 0) return Math.random() < 0.4;
    if (level === 1) return Math.random() < 0.12;
    return false;
  }

  /** Bot başkasını yakalar mı, ne kadar sonra? */
  function catchDelay(level) {
    if (level === 0) return Math.random() < 0.35 ? 1200 + Math.random() * 1500 : null;
    if (level === 1) return Math.random() < 0.7 ? 700 + Math.random() * 1200 : null;
    return 450 + Math.random() * 700;
  }

  w.UnoBot = { pickCard, pickColor, shouldChallenge, thinkMs, forgetsUno, catchDelay, colorCounts };
})(window);
