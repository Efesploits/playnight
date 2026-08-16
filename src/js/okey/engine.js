/* =============================================================================
 *  PLAY NIGHT - 101 OKEY KURAL MOTORU
 *  Saf JavaScript, DOM bağımsız. Host (oda kurucu) otoriter olarak çalıştırır.
 *
 *  Kural kaynağı: pagat.com/rummy/okey101, tr.wikipedia Okey_101,
 *  okeydeyim.net, altinstar.com Okey 101 kuralları.
 *
 *  ÖZET
 *   - 106 taş: 1-13 x 4 renk x 2 kopya (104) + 2 sahte okey
 *   - Her oyuncuya 21 taş, başlayan oyuncuya 22
 *   - Gösterge açılır; okey = aynı renk, bir üst sayı (13 -> 1)
 *   - Sahte okeyler göstergenin taşı yerine geçer
 *   - El açma: tek hamlede en az 101 puanlık per (seri/grup) VEYA en az 5 çift
 *   - Seri ve çift aynı elde karıştırılamaz
 *   - Açtıktan sonra işleme (rakip perlerine taş ekleme) serbest
 *   - Her tur bir taş atarak biter, bitiren el dahil
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------- */
  /* Sabitler                                                                 */
  /* ----------------------------------------------------------------------- */
  const COLORS = ['sari', 'mavi', 'siyah', 'kirmizi'];
  const COLOR_LABEL = ['Sarı', 'Mavi', 'Siyah', 'Kırmızı'];
  const TILE_COUNT = 106;
  const HAND_SIZE = 21;
  const MAX_RUN = 13;

  /* Varsayılan ev kuralları */
  const DEFAULT_RULES = {
    openPoints: 101,        // el açma eşiği
    openPairs: 5,           // çiftten açmak için gereken çift sayısı
    aceValue: 1,            // 12-13-1 dizisinde 1'in puanı (14 yapılabilir)
    aceHighAllowed: true,   // 12-13-1 dizisine izin
    okeyInHandPenalty: 101, // el bitince elde kalan her okey için ceza (0 = kapalı)
    discardMeldablePenalty: 101, // yerdeki pere işlenebilecek taşı atma cezası
    failedOpenPenalty: 101, // hatalı açma denemesi cezası
    startScore: 0,          // puanlar sıfırdan başlar, bitiren eksiye iner
    deals: 11,              // maç kaç elde biter (en düşük puan kazanır)
    turnSeconds: 30,        // 0 = süre yok
  };

  /* ----------------------------------------------------------------------- */
  /* Taşlar                                                                   */
  /* ----------------------------------------------------------------------- */
  /** id: 0..105  |  c: 0..3 renk  |  n: 1..13 sayı  |  fake: sahte okey mi */
  function buildDeck() {
    const deck = [];
    let id = 0;
    for (let copy = 0; copy < 2; copy++) {
      for (let c = 0; c < 4; c++) {
        for (let n = 1; n <= 13; n++) deck.push({ id: id++, c, n, fake: false });
      }
    }
    deck.push({ id: id++, c: null, n: null, fake: true });
    deck.push({ id: id++, c: null, n: null, fake: true });
    return deck; // 106
  }

  /** Deste tekil olduğu için id -> taş eşlemesi sabittir. */
  const DECK = buildDeck();
  const tileById = (id) => DECK[id];

  /* ----------------------------------------------------------------------- */
  /* Bağlam (gösterge / okey)                                                 */
  /* ----------------------------------------------------------------------- */
  function makeContext(indicatorId, rules) {
    const ind = tileById(indicatorId);
    if (!ind || ind.fake) throw new Error('Gösterge sahte okey olamaz');
    const okey = { c: ind.c, n: ind.n === 13 ? 1 : ind.n + 1 };
    return {
      rules: Object.assign({}, DEFAULT_RULES, rules || {}),
      indicatorId,
      indicator: { c: ind.c, n: ind.n },
      okey, // gerçek okey taşının rengi/sayısı
    };
  }

  /** Taş gerçek okey (joker) mi? */
  function isOkey(tile, ctx) {
    return !tile.fake && tile.c === ctx.okey.c && tile.n === ctx.okey.n;
  }

  /** Taşın oyundaki kimliği. Sahte okey göstergenin taşı yerine geçer. */
  function identity(tile, ctx) {
    if (tile.fake) return { c: ctx.indicator.c, n: ctx.indicator.n };
    return { c: tile.c, n: tile.n };
  }

  /** Taşın puan değeri (elde kalınca / per içinde). */
  function tileValue(tile, ctx) {
    const idn = identity(tile, ctx);
    return idn.n;
  }

  /**
   * Elde kalan taşların ceza puanı.
   * Ev kuralı `okeyInHandPenalty` açıksa elde kalan her okey o kadar puan yazar,
   * kapalıysa (0) okey sadece kendi sayı değerini yazar.
   */
  function handValue(tileIds, ctx) {
    const okeyPen = ctx.rules.okeyInHandPenalty;
    let sum = 0;
    for (const id of tileIds) {
      const t = tileById(id);
      if (isOkey(t, ctx)) { sum += okeyPen > 0 ? okeyPen : ctx.okey.n; continue; }
      sum += tileValue(t, ctx);
    }
    return sum;
  }

  /* ----------------------------------------------------------------------- */
  /* Sayım vektörü: 52 hücre (renk*13 + sayı-1) + joker sayacı                */
  /* ----------------------------------------------------------------------- */
  const cell = (c, n) => c * 13 + (n - 1);

  function toCounts(tileIds, ctx) {
    const counts = new Int8Array(52);
    let jokers = 0;
    for (const id of tileIds) {
      const t = tileById(id);
      if (isOkey(t, ctx)) { jokers++; continue; }
      const idn = identity(t, ctx);
      counts[cell(idn.c, idn.n)]++;
    }
    return { counts, jokers };
  }

  /** Sayım vektöründeki hücreleri gerçek taş id'lerine geri eşler. */
  function makeAllocator(tileIds, ctx) {
    const byCell = new Map();
    const jokerIds = [];
    for (const id of tileIds) {
      const t = tileById(id);
      if (isOkey(t, ctx)) { jokerIds.push(id); continue; }
      const idn = identity(t, ctx);
      const k = cell(idn.c, idn.n);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(id);
    }
    return {
      take(c, n) {
        const arr = byCell.get(cell(c, n));
        return arr && arr.length ? arr.pop() : null;
      },
      takeJoker() { return jokerIds.length ? jokerIds.pop() : null; },
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Per (meld) doğrulama                                                     */
  /* ----------------------------------------------------------------------- */
  /**
   * Verilen taş id dizisinin geçerli bir per olup olmadığını söyler.
   * @returns {{ok:boolean, type?:'run'|'set'|'pair', points?:number,
   *            slots?:Array, reason?:string}}
   */
  function validateMeld(tileIds, ctx) {
    if (!Array.isArray(tileIds) || tileIds.length < 2) {
      return { ok: false, reason: 'En az 2 taş gerekir' };
    }
    if (new Set(tileIds).size !== tileIds.length) {
      return { ok: false, reason: 'Aynı taş iki kez kullanılamaz' };
    }
    if (tileIds.length === 2) return validatePair(tileIds, ctx);

    const asSet = validateSet(tileIds, ctx);
    const asRun = validateRun(tileIds, ctx);
    if (asSet.ok && asRun.ok) return asSet.points >= asRun.points ? asSet : asRun;
    if (asSet.ok) return asSet;
    if (asRun.ok) return asRun;
    return { ok: false, reason: 'Geçerli seri veya grup değil' };
  }

  /** Grup: aynı sayı, farklı renkler, 3-4 taş. */
  function validateSet(tileIds, ctx) {
    if (tileIds.length < 3 || tileIds.length > 4) {
      return { ok: false, reason: 'Grup 3 veya 4 taş olmalı' };
    }
    let num = null;
    const usedColors = new Set();
    let jokers = 0;
    for (const id of tileIds) {
      const t = tileById(id);
      if (isOkey(t, ctx)) { jokers++; continue; }
      const idn = identity(t, ctx);
      if (num === null) num = idn.n;
      else if (num !== idn.n) return { ok: false, reason: 'Grupta sayılar aynı olmalı' };
      if (usedColors.has(idn.c)) return { ok: false, reason: 'Grupta renkler farklı olmalı' };
      usedColors.add(idn.c);
    }
    if (num === null) return { ok: false, reason: 'Grupta en az bir gerçek taş olmalı' };
    if (usedColors.size + jokers > 4) return { ok: false, reason: 'Grup en fazla 4 taş' };

    /* jokerlerin oturacağı boş renkler */
    const free = [0, 1, 2, 3].filter((c) => !usedColors.has(c));
    const slots = [];
    for (const id of tileIds) {
      const t = tileById(id);
      if (isOkey(t, ctx)) slots.push({ id, c: free.shift(), n: num, joker: true });
      else slots.push({ id, c: identity(t, ctx).c, n: num, joker: false });
    }
    return { ok: true, type: 'set', points: num * tileIds.length, slots };
  }

  /** Seri: aynı renk, ardışık, 3+ taş. 1 en altta; kural açıksa 12-13-1 de olur. */
  function validateRun(tileIds, ctx) {
    const L = tileIds.length;
    if (L < 3 || L > MAX_RUN) return { ok: false, reason: `Seri 3-${MAX_RUN} taş olmalı` };

    let color = null;
    const fixed = []; // {id, n}
    let jokers = 0;
    for (const id of tileIds) {
      const t = tileById(id);
      if (isOkey(t, ctx)) { jokers++; continue; }
      const idn = identity(t, ctx);
      if (color === null) color = idn.c;
      else if (color !== idn.c) return { ok: false, reason: 'Seride renkler aynı olmalı' };
      fixed.push({ id, n: idn.n });
    }
    if (color === null) return { ok: false, reason: 'Seride en az bir gerçek taş olmalı' };

    const maxPos = ctx.rules.aceHighAllowed ? 14 : 13;
    const numAt = (p) => (p > 13 ? p - 13 : p);
    const valAt = (p) => (numAt(p) === 1 ? (p > 13 ? ctx.rules.aceValue : 1) : numAt(p));

    for (let start = 1; start + L - 1 <= maxPos; start++) {
      const positions = [];
      for (let k = 0; k < L; k++) positions.push(start + k);

      /* sabit taşları konumlara oturt */
      const slotOf = new Map(); // pos -> tile id
      let ok = true;
      for (const f of fixed) {
        const match = positions.filter((p) => numAt(p) === f.n && !slotOf.has(p));
        if (!match.length) { ok = false; break; }
        slotOf.set(match[0], f.id);
      }
      if (!ok) continue;
      const empty = positions.filter((p) => !slotOf.has(p));
      if (empty.length !== jokers) continue;

      /* geçerli - slotları üret */
      const jokerIds = tileIds.filter((id) => isOkey(tileById(id), ctx));
      const slots = [];
      let ji = 0;
      let points = 0;
      for (const p of positions) {
        const id = slotOf.has(p) ? slotOf.get(p) : jokerIds[ji++];
        slots.push({ id, c: color, n: numAt(p), pos: p, joker: !slotOf.has(p) });
        points += valAt(p);
      }
      return { ok: true, type: 'run', points, slots, color, start, end: start + L - 1 };
    }
    return { ok: false, reason: 'Taşlar ardışık değil' };
  }

  /** Çift: iki özdeş taş (joker herhangi bir taşın eşi olabilir). */
  function validatePair(tileIds, ctx) {
    if (tileIds.length !== 2) return { ok: false, reason: 'Çift 2 taş olmalı' };
    const [a, b] = tileIds.map(tileById);
    const ja = isOkey(a, ctx), jb = isOkey(b, ctx);
    if (ja && jb) {
      return { ok: true, type: 'pair', points: ctx.okey.n * 2,
        slots: tileIds.map((id) => ({ id, c: ctx.okey.c, n: ctx.okey.n, joker: true })) };
    }
    if (ja || jb) {
      const real = identity(ja ? b : a, ctx);
      return { ok: true, type: 'pair', points: real.n * 2,
        slots: tileIds.map((id) => ({ id, c: real.c, n: real.n, joker: isOkey(tileById(id), ctx) })) };
    }
    const ia = identity(a, ctx), ib = identity(b, ctx);
    if (ia.c !== ib.c || ia.n !== ib.n) return { ok: false, reason: 'Çift taşları birebir aynı olmalı' };
    return { ok: true, type: 'pair', points: ia.n * 2,
      slots: tileIds.map((id) => ({ id, c: ia.c, n: ia.n, joker: false })) };
  }

  /* ----------------------------------------------------------------------- */
  /* Per çözücü: eldeki taşlardan en iyi per dağılımını bulur                 */
  /* ----------------------------------------------------------------------- */
  /** Aday perleri üret (sayım vektörü üzerinden, joker kullanımıyla). */
  function generateCandidates(counts, jokers, ctx) {
    const cands = [];
    const maxPos = ctx.rules.aceHighAllowed ? 14 : 13;
    const numAt = (p) => (p > 13 ? p - 13 : p);
    const valAt = (p) => (numAt(p) === 1 ? (p > 13 ? ctx.rules.aceValue : 1) : numAt(p));

    /* seriler */
    for (let c = 0; c < 4; c++) {
      for (let start = 1; start <= maxPos - 2; start++) {
        for (let L = 3; L <= MAX_RUN && start + L - 1 <= maxPos; L++) {
          const cells = [];
          let need = 0;
          let points = 0;
          const local = new Map();
          let feasible = true;
          for (let k = 0; k < L; k++) {
            const p = start + k;
            const cl = cell(c, numAt(p));
            const already = local.get(cl) || 0;
            if (counts[cl] - already > 0) { cells.push(cl); local.set(cl, already + 1); }
            else { need++; }
            points += valAt(p);
            if (need > jokers) { feasible = false; break; }
          }
          if (!feasible || need > jokers) break; // uzatmak daha çok joker ister
          if (cells.length === 0) continue;
          cands.push({ type: 'run', cells: cells.slice(), jokers: need, points, size: L, c, start });
        }
      }
    }

    /* gruplar */
    const COLOR_SUBSETS = [
      [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3], [0, 1, 2, 3],
    ];
    for (let n = 1; n <= 13; n++) {
      for (const sub of COLOR_SUBSETS) {
        const cells = [];
        let need = 0;
        for (const c of sub) {
          if (counts[cell(c, n)] > 0) cells.push(cell(c, n));
          else need++;
        }
        if (need > jokers || cells.length === 0) continue;
        cands.push({ type: 'set', cells, jokers: need, points: n * sub.length, size: sub.length, n });
      }
    }
    return cands;
  }

  /**
   * Eldeki taşlardan en iyi per bölüntüsünü arar (branch & bound + memo).
   * @param mode 'sets' (seri/grup) | 'pairs' (çift)
   * @returns {{melds:Array, points:number, used:number, leftover:number}}
   */
  function solveBest(tileIds, ctx, mode) {
    if (mode === 'pairs') return solvePairs(tileIds, ctx);

    const { counts, jokers } = toCounts(tileIds, ctx);
    const cands = generateCandidates(counts, jokers, ctx);
    const byCell = new Map();
    for (const cd of cands) {
      for (const cl of cd.cells) {
        if (!byCell.has(cl)) byCell.set(cl, []);
        byCell.get(cl).push(cd);
      }
    }

    const memo = new Map();
    let nodes = 0;
    const NODE_CAP = 120000;

    const keyOf = (cnt, jk) => String.fromCharCode.apply(null, cnt) + String.fromCharCode(jk);

    function dfs(cnt, jk) {
      if (nodes++ > NODE_CAP) return { points: 0, used: 0, melds: [] };
      const key = keyOf(cnt, jk);
      const hit = memo.get(key);
      if (hit) return hit;

      /* kullanılmayan taşlarla bitir */
      let best = { points: 0, used: 0, melds: [] };

      /* ilk dolu hücreyi seç (exact-cover daraltması) */
      let pivot = -1;
      for (let i = 0; i < 52; i++) if (cnt[i] > 0) { pivot = i; break; }

      if (pivot === -1) {
        /* sadece jokerler kaldı - tek başlarına per olamaz */
        memo.set(key, best);
        return best;
      }

      /* seçenek 1: pivot taşını hiçbir pere koyma */
      {
        const next = cnt.slice();
        next[pivot]--;
        const r = dfs(next, jk);
        if (r.points > best.points || (r.points === best.points && r.used > best.used)) {
          best = { points: r.points, used: r.used, melds: r.melds };
        }
      }

      /* seçenek 2: pivotu içeren adaylardan birini kullan */
      const list = byCell.get(pivot) || [];
      for (const cd of list) {
        if (cd.jokers > jk) continue;
        const next = cnt.slice();
        let fits = true;
        for (const cl of cd.cells) {
          if (next[cl] <= 0) { fits = false; break; }
          next[cl]--;
        }
        if (!fits) continue;
        const r = dfs(next, jk - cd.jokers);
        const pts = r.points + cd.points;
        const used = r.used + cd.size;
        if (pts > best.points || (pts === best.points && used > best.used)) {
          best = { points: pts, used, melds: [cd].concat(r.melds) };
        }
      }

      memo.set(key, best);
      return best;
    }

    const res = dfs(Array.from(counts), jokers);
    return materialize(res, tileIds, ctx);
  }

  /** Soyut per listesini gerçek taş id'lerine dönüştürür. */
  function materialize(res, tileIds, ctx) {
    const alloc = makeAllocator(tileIds, ctx);
    const melds = [];
    const numAt = (p) => (p > 13 ? p - 13 : p);

    for (const cd of res.melds) {
      const ids = [];
      if (cd.type === 'run') {
        for (let k = 0; k < cd.size; k++) {
          const n = numAt(cd.start + k);
          const id = alloc.take(cd.c, n);
          ids.push(id !== null ? id : alloc.takeJoker());
        }
      } else {
        /* Adayın seçtiği hücreleri birebir kullan. Rastgele "ilk uygun rengi al"
           denirse başka bir perin ihtiyaç duyduğu taş çalınır ve çözüm bozulur. */
        for (const cl of cd.cells) {
          const id = alloc.take(Math.floor(cl / 13), (cl % 13) + 1);
          if (id !== null) ids.push(id);
        }
        for (let k = 0; k < cd.jokers; k++) {
          const j = alloc.takeJoker();
          if (j !== null) ids.push(j);
        }
      }
      if (ids.every((x) => x !== null && x !== undefined)) {
        const v = validateMeld(ids, ctx);
        if (v.ok) melds.push({ type: v.type, tiles: ids, points: v.points });
      }
    }
    const used = melds.reduce((s, m) => s + m.tiles.length, 0);
    const points = melds.reduce((s, m) => s + m.points, 0);
    return { melds, points, used, leftover: tileIds.length - used };
  }

  /** Çift çözücü: özdeş taş çiftleri + jokerler. */
  function solvePairs(tileIds, ctx) {
    const alloc = makeAllocator(tileIds, ctx);
    const { counts, jokers } = toCounts(tileIds, ctx);
    const melds = [];

    for (let i = 0; i < 52; i++) {
      while (counts[i] >= 2) {
        counts[i] -= 2;
        const c = Math.floor(i / 13), n = (i % 13) + 1;
        const a = alloc.take(c, n), b = alloc.take(c, n);
        if (a === null || b === null) break;
        melds.push({ type: 'pair', tiles: [a, b], points: n * 2 });
      }
    }
    /* kalan jokerleri tekil taşlarla eşle (yüksek puanlıdan başla) */
    let jk = jokers;
    const singles = [];
    for (let i = 0; i < 52; i++) if (counts[i] === 1) singles.push(i);
    singles.sort((x, y) => ((y % 13) + 1) - ((x % 13) + 1));
    for (const i of singles) {
      if (jk <= 0) break;
      const c = Math.floor(i / 13), n = (i % 13) + 1;
      const a = alloc.take(c, n), j = alloc.takeJoker();
      if (a === null || j === null) break;
      jk--;
      melds.push({ type: 'pair', tiles: [a, j], points: n * 2 });
    }
    /* iki joker kaldıysa onlar da çifttir */
    if (jk >= 2) {
      const j1 = alloc.takeJoker(), j2 = alloc.takeJoker();
      if (j1 !== null && j2 !== null) {
        jk -= 2;
        melds.push({ type: 'pair', tiles: [j1, j2], points: ctx.okey.n * 2 });
      }
    }
    const used = melds.reduce((s, m) => s + m.tiles.length, 0);
    const points = melds.reduce((s, m) => s + m.points, 0);
    return { melds, points, used, leftover: tileIds.length - used };
  }

  /* ----------------------------------------------------------------------- */
  /* İşleme: yerdeki bir pere taş eklenebilir mi?                             */
  /* ----------------------------------------------------------------------- */
  /**
   * @returns {{ok:boolean, tiles?:number[], reason?:string}}  yeni per dizilimi
   */
  function canAddToMeld(meld, tileId, ctx) {
    if (meld.type === 'pair') return { ok: false, reason: 'Çiftlere işleme yapılamaz' };
    const t = tileById(tileId);

    if (meld.type === 'set') {
      if (meld.tiles.length >= 4) return { ok: false, reason: 'Grup dolu' };
      const test = meld.tiles.concat([tileId]);
      const v = validateSet(test, ctx);
      return v.ok ? { ok: true, tiles: test, points: v.points } : { ok: false, reason: v.reason };
    }

    /* seri: iki uçtan biri */
    const head = [tileId].concat(meld.tiles);
    const tail = meld.tiles.concat([tileId]);
    const vh = validateRun(head, ctx);
    if (vh.ok) return { ok: true, tiles: head, points: vh.points };
    const vt = validateRun(tail, ctx);
    if (vt.ok) return { ok: true, tiles: tail, points: vt.points };
    return { ok: false, reason: 'Bu taş seriye eklenemez' };
  }

  /** Taş masadaki herhangi bir pere işlenebiliyor mu? (atma cezası kontrolü) */
  function isMeldableOnTable(tableMelds, tileId, ctx) {
    for (const m of tableMelds) {
      if (canAddToMeld(m, tileId, ctx).ok) return true;
    }
    return false;
  }

  /* ----------------------------------------------------------------------- */
  /* Karıştırma (deterministik, tohumlanabilir - senkron için şart)           */
  /* ----------------------------------------------------------------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(seed) {
    const rnd = mulberry32(seed);
    const ids = DECK.map((t) => t.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  /* ----------------------------------------------------------------------- */
  /* Oyun durumu                                                              */
  /* ----------------------------------------------------------------------- */
  /**
   * @param players [{id, name, isBot, avatar}]  - 4 kişi
   */
  function createMatch(players, rules) {
    const r = Object.assign({}, DEFAULT_RULES, rules || {});
    return {
      rules: r,
      players: players.map((p, i) => ({
        seat: i,
        id: p.id,
        name: p.name,
        avatar: p.avatar || null,
        isBot: !!p.isBot,
        score: r.startScore,
        roundsWon: 0,
        connected: true,
      })),
      roundNo: 0,
      dealer: 0,
      round: null,
      history: [],
      over: false,
      winner: null,
    };
  }

  function startRound(match, seed) {
    const order = shuffled(seed >>> 0);

    /* gösterge sahte okey olamaz - uygun taşı öne al */
    let indIdx = order.findIndex((id) => !tileById(id).fake);
    const indicatorId = order.splice(indIdx, 1)[0];

    const ctx = makeContext(indicatorId, match.rules);
    const starter = (match.dealer + 1) % 4;

    const hands = [[], [], [], []];
    let k = 0;
    for (let s = 0; s < 4; s++) {
      const n = s === starter ? HAND_SIZE + 1 : HAND_SIZE;
      for (let i = 0; i < n; i++) hands[s].push(order[k++]);
    }
    const pile = order.slice(k);

    match.roundNo++;
    match.round = {
      no: match.roundNo,
      ctx,
      indicatorId,
      okey: ctx.okey,
      pile,
      seats: match.players.map((p, s) => ({
        seat: s,
        hand: sortHand(hands[s], ctx, 'group'),
        discards: [],
        opened: false,
        openType: null,   // 'sets' | 'pairs'
        openedTurn: -1,   // hangi turda açtı (elden bitirme tespiti için)
        penalty: 0,
        melds: [],        // {mid, type, tiles, points, owner}
      })),
      meldSeq: 1,
      turnId: 0,          // her sıra değişiminde artar
      turn: starter,
      phase: 'draw',      // 'draw' -> 'act'
      drawnFrom: null,
      drawnTile: null,
      lastChance: false,  // deste bitti, sıradaki oyuncunun son alma hakkı
      startedAt: Date.now(),
      turnStartedAt: Date.now(),
      finished: false,
      result: null,
      log: [],
    };
    /* başlayan oyuncu 22 taşla başlar, doğrudan atma aşamasında */
    match.round.phase = 'act';
    match.round.drawnFrom = 'deal';
    return match.round;
  }

  /* Tüm masadaki perler (her koltuğun perleri birleşik) */
  function tableMelds(round) {
    const out = [];
    for (const s of round.seats) for (const m of s.melds) out.push(m);
    return out;
  }

  function findMeld(round, mid) {
    for (const s of round.seats) {
      const m = s.melds.find((x) => x.mid === mid);
      if (m) return { seat: s, meld: m };
    }
    return null;
  }

  /* ----------------------------------------------------------------------- */
  /* Hamleler                                                                 */
  /* ----------------------------------------------------------------------- */
  const fail = (reason) => ({ ok: false, reason });

  /** Yerden (kapalı desteden) taş çek. */
  function drawFromPile(round, seat) {
    if (round.finished) return fail('El bitti');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.phase !== 'draw') return fail('Önce taş atmalısınız');
    if (round.lastChance) return fail('Deste bitti, sadece yerdeki taşı alabilirsiniz');
    if (!round.pile.length) return fail('Destede taş kalmadı');

    const id = round.pile.shift();
    round.seats[seat].hand.push(id);
    round.phase = 'act';
    round.drawnFrom = 'pile';
    round.drawnTile = id;
    round.log.push({ t: 'draw', seat, from: 'pile' });
    return { ok: true, tile: id, pileLeft: round.pile.length };
  }

  /** Soldaki oyuncunun attığı taşı al. */
  function drawFromDiscard(round, seat) {
    if (round.finished) return fail('El bitti');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.phase !== 'draw') return fail('Önce taş atmalısınız');

    const left = (seat + 3) % 4;
    const pileD = round.seats[left].discards;
    if (!pileD.length) return fail('Solunuzda atılmış taş yok');

    const id = pileD.pop();
    round.seats[seat].hand.push(id);
    round.phase = 'act';
    round.drawnFrom = 'discard';
    round.drawnTile = id;
    round.lastChance = false;
    round.log.push({ t: 'draw', seat, from: 'discard', tile: id });
    return { ok: true, tile: id, pileLeft: round.pile.length };
  }

  /**
   * Deste bittiğinde sıradaki oyuncu yerdeki taşı almayı reddeder -> el biter.
   * Sadece `lastChance` durumunda çağrılabilir.
   */
  function passLastChance(round, seat) {
    if (round.finished) return fail('El bitti');
    if (!round.lastChance) return fail('Pas geçilemez');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    round.log.push({ t: 'pass', seat });
    return endWithoutWinner(round);
  }

  /**
   * El açma. meldGroups: [[tileId,...], ...]
   * Seri modunda toplam >= 101, çift modunda >= 5 çift olmalı.
   */
  function openHand(round, seat, meldGroups) {
    if (round.finished) return fail('El bitti');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.phase !== 'act') return fail('Önce taş çekmelisiniz');
    const S = round.seats[seat];
    if (S.opened) return fail('Zaten açtınız');
    if (!Array.isArray(meldGroups) || !meldGroups.length) return fail('Per seçilmedi');

    const ctx = round.ctx;
    const all = meldGroups.flat();
    if (new Set(all).size !== all.length) return fail('Bir taşı iki perde kullanamazsınız');
    const handSet = new Set(S.hand);
    for (const id of all) if (!handSet.has(id)) return fail('Elinizde olmayan taş');

    const validated = [];
    let pairCount = 0, seriesCount = 0, total = 0;
    for (const g of meldGroups) {
      const v = validateMeld(g, ctx);
      if (!v.ok) return fail(v.reason || 'Geçersiz per');
      if (v.type === 'pair') pairCount++; else seriesCount++;
      total += v.points;
      validated.push({ type: v.type, tiles: g.slice(), points: v.points });
    }
    if (pairCount && seriesCount) return fail('Seri ve çift aynı elde açılamaz');

    const mode = pairCount ? 'pairs' : 'sets';
    if (mode === 'pairs') {
      if (pairCount < ctx.rules.openPairs) {
        return fail(`Çiftten açmak için en az ${ctx.rules.openPairs} çift gerekir (${pairCount} var)`);
      }
    } else if (total < ctx.rules.openPoints) {
      return fail(`El açmak için en az ${ctx.rules.openPoints} puan gerekir (${total} puan)`);
    }

    /* elden çıkar ve masaya koy */
    for (const m of validated) {
      for (const id of m.tiles) S.hand.splice(S.hand.indexOf(id), 1);
      S.melds.push({ mid: round.meldSeq++, type: m.type, tiles: m.tiles, points: m.points, owner: seat });
    }
    S.opened = true;
    S.openType = mode;
    S.openedTurn = round.turnId;
    round.log.push({ t: 'open', seat, mode, points: total, melds: validated.length });
    return { ok: true, mode, points: total, melds: validated.length, straight: S.hand.length === 1 };
  }

  /** Açtıktan sonra ek per koyma. */
  function layMeld(round, seat, tileIds) {
    if (round.finished) return fail('El bitti');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.phase !== 'act') return fail('Önce taş çekmelisiniz');
    const S = round.seats[seat];
    if (!S.opened) return fail('Önce el açmalısınız');

    const v = validateMeld(tileIds, round.ctx);
    if (!v.ok) return fail(v.reason || 'Geçersiz per');
    if (S.openType === 'pairs' && v.type !== 'pair') return fail('Çift açtınız, sadece çift koyabilirsiniz');
    if (S.openType === 'sets' && v.type === 'pair') return fail('Seri açtınız, çift koyamazsınız');

    const handSet = new Set(S.hand);
    for (const id of tileIds) if (!handSet.has(id)) return fail('Elinizde olmayan taş');
    for (const id of tileIds) S.hand.splice(S.hand.indexOf(id), 1);
    S.melds.push({ mid: round.meldSeq++, type: v.type, tiles: tileIds.slice(), points: v.points, owner: seat });
    round.log.push({ t: 'lay', seat, type: v.type, points: v.points });
    return { ok: true, type: v.type, points: v.points };
  }

  /** İşleme: masadaki bir pere taş ekleme. */
  function addToMeld(round, seat, mid, tileId) {
    if (round.finished) return fail('El bitti');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.phase !== 'act') return fail('Önce taş çekmelisiniz');
    const S = round.seats[seat];
    if (!S.opened) return fail('İşleme için önce el açmalısınız');
    if (!S.hand.includes(tileId)) return fail('Elinizde olmayan taş');

    const found = findMeld(round, mid);
    if (!found) return fail('Per bulunamadı');
    const res = canAddToMeld(found.meld, tileId, round.ctx);
    if (!res.ok) return fail(res.reason);

    found.meld.tiles = res.tiles;
    found.meld.points = res.points;
    S.hand.splice(S.hand.indexOf(tileId), 1);
    round.log.push({ t: 'add', seat, mid, tile: tileId });
    return { ok: true, mid, tiles: res.tiles.slice() };
  }

  /**
   * Taş atma - turu bitirir. Bitirme kontrolü burada yapılır.
   * @param force  ceza uyarısını görmezden gel
   */
  function discard(round, seat, tileId, force) {
    if (round.finished) return fail('El bitti');
    if (round.turn !== seat) return fail('Sıra sizde değil');
    if (round.phase !== 'act') return fail('Önce taş çekmelisiniz');
    const S = round.seats[seat];
    if (!S.hand.includes(tileId)) return fail('Elinizde olmayan taş');

    const ctx = round.ctx;
    const t = tileById(tileId);
    const willFinish = S.hand.length === 1 && S.opened;

    /* okey atma cezası (bitirme hamlesi hariç ödüle döner) */
    const discardedOkey = isOkey(t, ctx);

    /* işlenebilir taş atma cezası */
    let penalty = 0;
    if (!willFinish) {
      if (discardedOkey) {
        if (!force) return { ok: false, needsConfirm: 'okey', reason: 'Okey atıyorsunuz: +101 ceza' };
        penalty += ctx.rules.discardMeldablePenalty;
      } else if (isMeldableOnTable(tableMelds(round), tileId, ctx)) {
        if (!force) return { ok: false, needsConfirm: 'meldable', reason: 'Bu taş yerdeki bir pere işlenebilir: +101 ceza' };
        penalty += ctx.rules.discardMeldablePenalty;
      }
    }

    S.hand.splice(S.hand.indexOf(tileId), 1);
    S.discards.push(tileId);
    S.penalty += penalty;
    round.log.push({ t: 'discard', seat, tile: tileId, penalty });

    /* --- bitirme --- */
    if (S.hand.length === 0 && S.opened) {
      return finishRound(round, seat, discardedOkey);
    }

    /* --- sıra sonraki oyuncuya --- */
    round.turn = (seat + 1) % 4;
    round.turnId++;
    round.phase = 'draw';
    round.drawnFrom = null;
    round.drawnTile = null;
    round.turnStartedAt = Date.now();

    /* deste bittiyse sıradaki oyuncunun tek hakkı yerdeki taşı almaktır */
    round.lastChance = round.pile.length === 0;

    return { ok: true, turn: round.turn, lastChance: round.lastChance };
  }

  /* ----------------------------------------------------------------------- */
  /* El sonu ve puanlama                                                      */
  /* ----------------------------------------------------------------------- */
  /**
   * Pagat puanlama tablosu:
   *
   *  Bitiş türü                       Kazanan | Seri açanlar | Çift açanlar | Açmayanlar
   *  Seri, normal taş atarak            -101  |  el toplamı  |    2x        |   +202
   *  Seri, okey atarak                  -202  |     2x       |    4x        |   +404
   *  Çift, normal taş atarak            -202  |     2x       |    4x        |   +404
   *  Çift, okey atarak                  -404  |     4x       |    8x        |   +404
   *  Elden bitirme (kimse açmadan)      -202  |      -       |     -        |   +404
   *  Elden bitirme, okey atarak         -404  |      -       |     -        |   +808
   */
  function finishRound(round, winnerSeat, discardedOkey) {
    const ctx = round.ctx;
    const W = round.seats[winnerSeat];
    const winType = W.openType === 'pairs' ? 'pairs' : 'sets';

    /* Elden bitirme: kazanan tüm 21 taşını tek turda yere serdi ve
       o ana kadar hiçbir rakip el açmamıştı. */
    const anyOpponentOpened = round.seats.some((s, i) => i !== winnerSeat && s.opened);
    const straightOut = W.openedTurn === round.turnId && !anyOpponentOpened;

    let winnerDelta, unopenedPts, multSets, multPairs;

    if (straightOut) {
      winnerDelta = discardedOkey ? -404 : -202;
      unopenedPts = discardedOkey ? 808 : 404;
      multSets = null; multPairs = null;
    } else if (winType === 'sets') {
      winnerDelta = discardedOkey ? -202 : -101;
      multSets = discardedOkey ? 2 : 1;
      multPairs = discardedOkey ? 4 : 2;
      unopenedPts = discardedOkey ? 404 : 202;
    } else {
      winnerDelta = discardedOkey ? -404 : -202;
      multSets = discardedOkey ? 4 : 2;
      multPairs = discardedOkey ? 8 : 4;
      unopenedPts = 404;
    }

    const rows = round.seats.map((S, i) => {
      if (i === winnerSeat) {
        return { seat: i, delta: winnerDelta + S.penalty, hand: 0, reason: straightOut ? 'Elden bitirdi' : 'Bitirdi', winner: true };
      }
      if (!S.opened) {
        return { seat: i, delta: unopenedPts + S.penalty, hand: handValue(S.hand, ctx), reason: 'El açmadı', winner: false };
      }
      if (straightOut) {
        return { seat: i, delta: unopenedPts + S.penalty, hand: handValue(S.hand, ctx), reason: 'Elden bitirildi', winner: false };
      }
      const mult = S.openType === 'pairs' ? multPairs : multSets;
      const hv = handValue(S.hand, ctx);
      return { seat: i, delta: hv * mult + S.penalty, hand: hv, mult, reason: `Elde kalan x${mult}`, winner: false };
    });

    round.finished = true;
    round.result = {
      winnerSeat,
      winType,
      straightOut,
      discardedOkey,
      rows,
      finishedAt: Date.now(),
    };
    return { ok: true, finished: true, result: round.result };
  }

  /** Deste bitti, kimse bitiremedi: elinde okey olana +101. */
  function endWithoutWinner(round) {
    const ctx = round.ctx;
    const rows = round.seats.map((S, i) => {
      const okeys = S.hand.filter((id) => isOkey(tileById(id), ctx)).length;
      return {
        seat: i,
        delta: okeys * (ctx.rules.okeyInHandPenalty || 101) + S.penalty,
        hand: handValue(S.hand, ctx),
        reason: okeys ? `Elde ${okeys} okey` : 'Deste bitti',
        winner: false,
      };
    });
    round.finished = true;
    round.result = { winnerSeat: null, winType: null, straightOut: false, discardedOkey: false, rows, noWinner: true, finishedAt: Date.now() };
    return { ok: true, finished: true, result: round.result };
  }

  /** El sonucunu maç tablosuna işler, maç bitti mi bakar. */
  function applyResult(match) {
    const res = match.round.result;
    if (!res) return null;
    for (const row of res.rows) match.players[row.seat].score += row.delta;
    if (res.winnerSeat !== null && res.winnerSeat !== undefined) {
      match.players[res.winnerSeat].roundsWon++;
    }
    match.history.push({ no: match.round.no, rows: res.rows, winnerSeat: res.winnerSeat });
    match.dealer = (match.dealer + 1) % 4;

    /* Kararlaştırılan el sayısı dolunca en düşük puanlı oyuncu maçı kazanır. */
    if (match.roundNo >= match.rules.deals) {
      const best = match.players.slice().sort((a, b) => a.score - b.score || b.roundsWon - a.roundsWon)[0];
      match.over = true;
      match.winner = best.seat;
    }
    return {
      over: match.over,
      winner: match.winner,
      dealsLeft: Math.max(0, match.rules.deals - match.roundNo),
      scores: match.players.map((p) => p.score),
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Yardımcılar: sıralama, öneri                                             */
  /* ----------------------------------------------------------------------- */
  /** mode: 'group' (renk+sayı) | 'run' (seri odaklı) | 'smart' (perleri öne al) */
  function sortHand(tileIds, ctx, mode) {
    const ids = tileIds.slice();
    if (mode === 'smart') {
      const sol = solveBest(ids, ctx, 'sets');
      const used = new Set();
      const out = [];
      for (const m of sol.melds) { for (const id of m.tiles) { out.push(id); used.add(id); } }
      const rest = ids.filter((id) => !used.has(id));
      rest.sort(cmpFactory(ctx, 'group'));
      return out.concat(rest);
    }
    ids.sort(cmpFactory(ctx, mode || 'group'));
    return ids;
  }

  function cmpFactory(ctx, mode) {
    return (a, b) => {
      const ta = tileById(a), tb = tileById(b);
      const ja = isOkey(ta, ctx), jb = isOkey(tb, ctx);
      if (ja !== jb) return ja ? 1 : -1;      // okeyler sona
      const ia = identity(ta, ctx), ib = identity(tb, ctx);
      if (mode === 'run') {
        if (ia.c !== ib.c) return ia.c - ib.c;
        return ia.n - ib.n;
      }
      if (ia.n !== ib.n) return ia.n - ib.n;   // sayıya göre grupla
      return ia.c - ib.c;
    };
  }

  /** Oyuncuya "şu an açabilir misin" önerisi. */
  function suggestOpen(round, seat) {
    const S = round.seats[seat];
    const ctx = round.ctx;
    const sets = solveBest(S.hand, ctx, 'sets');
    const pairs = solveBest(S.hand, ctx, 'pairs');
    return {
      sets: { ...sets, canOpen: sets.points >= ctx.rules.openPoints },
      pairs: { ...pairs, canOpen: pairs.melds.length >= ctx.rules.openPairs },
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Dışa aktarım                                                             */
  /* ----------------------------------------------------------------------- */
  const Okey101 = {
    COLORS, COLOR_LABEL, TILE_COUNT, HAND_SIZE, DEFAULT_RULES,
    DECK, tileById, buildDeck,
    makeContext, isOkey, identity, tileValue, handValue,
    validateMeld, validateSet, validateRun, validatePair,
    canAddToMeld, isMeldableOnTable, tableMelds, findMeld,
    solveBest, solvePairs, suggestOpen, sortHand,
    createMatch, startRound, applyResult,
    drawFromPile, drawFromDiscard, passLastChance, openHand, layMeld, addToMeld, discard,
    finishRound, endWithoutWinner,
    shuffled, mulberry32,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Okey101;
  global.Okey101 = Okey101;
})(typeof window !== 'undefined' ? window : globalThis);
