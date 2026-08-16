/* =============================================================================
 *  PLAY NIGHT — 101 OKEY BOT
 *  Motorun saf kurallarını kullanarak karar üretir. DOM bilmez.
 *  Seviyeler: 0 acemi, 1 normal, 2 usta
 * ========================================================================== */
(function (w) {
  'use strict';
  const E = w.Okey101;

  /* --------------------------------------------------------- yardımcı --- */
  function handIndex(handIds, ctx) {
    const cnt = new Int8Array(52);
    let jokers = 0, fakes = 0;
    for (const id of handIds) {
      const t = E.tileById(id);
      if (E.isOkey(t, ctx)) { jokers++; continue; }
      if (t.fake) fakes++;
      const idn = E.identity(t, ctx);
      cnt[idn.c * 13 + idn.n - 1]++;
    }
    return { cnt, jokers, fakes, has: (c, n) => cnt[c * 13 + n - 1] > 0, num: (c, n) => cnt[c * 13 + n - 1] };
  }

  /** Taşın elde ne kadar işe yaradığı. Yüksek = tutmaya değer. */
  function utility(handIds, id, ctx, tableMelds) {
    const t = E.tileById(id);
    if (E.isOkey(t, ctx)) return 999;             // okey asla atılmaz
    const idn = E.identity(t, ctx);
    const ix = handIndex(handIds.filter((x) => x !== id), ctx);

    let u = 0;
    /* aynı sayı, farklı renk (grup potansiyeli) */
    let sameNum = 0;
    for (let c = 0; c < 4; c++) if (c !== idn.c && ix.has(c, idn.n)) sameNum++;
    u += sameNum * 3.2;
    if (sameNum >= 2) u += 5;                     // grup neredeyse tamam

    /* aynı taştan bir tane daha (çift potansiyeli) */
    if (ix.num(idn.c, idn.n) >= 1) u += 3.4;

    /* seri komşuları */
    let chain = 0;
    for (const d of [-2, -1, 1, 2]) {
      const n = idn.n + d;
      if (n >= 1 && n <= 13 && ix.has(idn.c, n)) { u += Math.abs(d) === 1 ? 4.2 : 1.8; chain++; }
    }
    if (chain >= 2) u += 4;

    /* sahte okey değerlidir */
    if (t.fake) u += 6;

    /* masadaki bir pere işlenebilen taşı atmak 101 ceza -> asla atma */
    if (tableMelds && tableMelds.length && E.isMeldableOnTable(tableMelds, id, ctx)) u += 60;

    return u;
  }

  /** Atılacak en uygun taşı seç. */
  function pickDiscard(round, seat, level) {
    const S = round.seats[seat];
    const ctx = round.ctx;
    const table = E.tableMelds(round);
    const scored = S.hand.map((id) => ({
      id,
      u: utility(S.hand, id, ctx, table),
      v: E.identity(E.tileById(id), ctx).n,
    }));

    /* acemi bot biraz rastgele davranır */
    if (level === 0) for (const s of scored) s.u += Math.random() * 7;
    else if (level === 1) for (const s of scored) s.u += Math.random() * 2.5;

    scored.sort((a, b) => (a.u - b.u) || (b.v - a.v));   // en işe yaramaz, eşitse en yüksek sayı
    return scored[0].id;
  }

  /** Taş çekme kararı: soldakinin attığını almak işe yarıyor mu? */
  function decideDraw(round, seat, level) {
    const S = round.seats[seat];
    const ctx = round.ctx;

    if (round.lastChance) {
      /* deste bitti: sadece bitirmeye yarıyorsa al, yoksa pas */
      const left = round.seats[(seat + 3) % 4].discards;
      if (!left.length) return 'pass';
      const cand = left[left.length - 1];
      const test = S.hand.concat([cand]);
      const sol = E.solveBest(test, ctx, S.openType === 'pairs' ? 'pairs' : 'sets');
      if (S.opened && sol.leftover <= 1) return 'discard';
      return 'pass';
    }

    const left = round.seats[(seat + 3) % 4].discards;
    if (!left.length) return 'pile';
    const cand = left[left.length - 1];
    const t = E.tileById(cand);

    /* okey yerdeyse her zaman al */
    if (E.isOkey(t, ctx)) return 'discard';

    const mode = S.openType === 'pairs' ? 'pairs' : 'sets';
    const before = E.solveBest(S.hand, ctx, mode);
    const after = E.solveBest(S.hand.concat([cand]), ctx, mode);

    if (S.opened) {
      /* açıksa: doğrudan işlenebiliyorsa veya per büyütüyorsa al */
      if (E.isMeldableOnTable(E.tableMelds(round), cand, ctx)) return 'discard';
      if (after.used > before.used) return 'discard';
      return 'pile';
    }

    /* açık değilse: 101'e yaklaştırıyorsa al */
    const gain = after.points - before.points;
    const need = ctx.rules.openPoints - before.points;
    if (after.points >= ctx.rules.openPoints) return 'discard';           // açılışı tamamlıyor
    if (gain >= (level === 2 ? 10 : 14) && need <= 45) return 'discard';  // ciddi katkı
    if (after.used > before.used + 1) return 'discard';
    return 'pile';
  }

  /**
   * Sıradaki tüm hamleleri planla (açma, per koyma, işleme, atma).
   * @returns {Array<{t:string, ...}>}
   */
  function planActions(round, seat, level) {
    const S = round.seats[seat];
    const ctx = round.ctx;
    const steps = [];

    /* elin simülasyonu: gerçek durumu bozmadan planla */
    let hand = S.hand.slice();
    let opened = S.opened;
    let openType = S.openType;
    /* masadaki perlerin kopyası (işleme simülasyonu için) */
    let table = E.tableMelds(round).map((m) => ({ mid: m.mid, type: m.type, tiles: m.tiles.slice(), points: m.points }));

    /* ---------------- 1) el açma ---------------- */
    if (!opened) {
      const sets = E.solveBest(hand, ctx, 'sets');
      const pairs = E.solveBest(hand, ctx, 'pairs');
      const canSets = sets.points >= ctx.rules.openPoints;
      const canPairs = pairs.melds.length >= ctx.rules.openPairs;

      /* çift oyunu daha çok puan getirir; bot çok güçlüyse çifti tercih eder */
      const preferPairs = canPairs && (!canSets || pairs.melds.length >= 8);

      if (canSets || canPairs) {
        const chosen = preferPairs ? pairs : (canSets ? sets : pairs);
        const groups = chosen.melds.map((m) => m.tiles.slice());
        const used = new Set(groups.flat());

        /* bitirmeye yetiyor mu? elde en az 1 taş kalmalı (atmak için) */
        if (hand.length - used.size >= 1) {
          steps.push({ t: 'open', groups, mode: preferPairs ? 'pairs' : 'sets' });
          hand = hand.filter((id) => !used.has(id));
          opened = true;
          openType = preferPairs ? 'pairs' : 'sets';
          for (const m of chosen.melds) {
            table.push({ mid: 'new' + table.length, type: m.type, tiles: m.tiles.slice(), points: m.points });
          }
        } else if (used.size === hand.length) {
          /* tüm taşlar perlere giriyor: birini dışarıda bırakıp elden bitir */
          const table0 = E.tableMelds(round);
          const dropId = hand.slice().sort((a, b) =>
            (utility(hand, a, ctx, table0) - utility(hand, b, ctx, table0))
            || (E.identity(E.tileById(b), ctx).n - E.identity(E.tileById(a), ctx).n))[0];
          const trimmed = groups
            .map((g) => g.filter((x) => x !== dropId))
            .filter((g) => g.length >= (preferPairs ? 2 : 3));
          const stillOk = trimmed.length && trimmed.every((g) => E.validateMeld(g, ctx).ok);
          const pts = stillOk ? trimmed.reduce((s, g) => s + E.validateMeld(g, ctx).points, 0) : 0;
          const okOpen = preferPairs ? trimmed.length >= ctx.rules.openPairs : pts >= ctx.rules.openPoints;
          if (stillOk && okOpen) {
            const u2 = new Set(trimmed.flat());
            steps.push({ t: 'open', groups: trimmed, mode: preferPairs ? 'pairs' : 'sets' });
            hand = hand.filter((id) => !u2.has(id));
            opened = true;
            openType = preferPairs ? 'pairs' : 'sets';
          }
        }
      }
    }

    /* ---------------- 2) ek per + işleme ---------------- */
    if (opened) {
      let changed = true;
      let guard = 0;
      while (changed && guard++ < 12) {
        changed = false;

        /* elden ek per koy (en az 1 taş kalsın) */
        if (hand.length > 1) {
          const sol = E.solveBest(hand, ctx, openType === 'pairs' ? 'pairs' : 'sets');
          for (const m of sol.melds) {
            if (hand.length - m.tiles.length < 1) continue;
            if (openType === 'pairs' && m.type !== 'pair') continue;
            if (openType === 'sets' && m.type === 'pair') continue;
            steps.push({ t: 'lay', tiles: m.tiles.slice() });
            const used = new Set(m.tiles);
            hand = hand.filter((id) => !used.has(id));
            table.push({ mid: 'new' + table.length, type: m.type, tiles: m.tiles.slice(), points: m.points });
            changed = true;
            break;
          }
        }

        /* işleme: masadaki perlere taş ekle */
        if (!changed && hand.length > 1) {
          outer:
          for (const id of hand.slice()) {
            for (const m of table) {
              if (typeof m.mid !== 'number') continue;      // bu turda konan perlere ekleme yapma
              const r = E.canAddToMeld(m, id, ctx);
              if (r.ok) {
                steps.push({ t: 'add', mid: m.mid, tile: id });
                m.tiles = r.tiles;
                hand = hand.filter((x) => x !== id);
                changed = true;
                break outer;
              }
            }
          }
        }
      }
    }

    /* ---------------- 3) taş atma ---------------- */
    let discardId;
    if (hand.length === 1) {
      discardId = hand[0];                                   // bitiriyor
    } else {
      const table2 = table.filter((m) => typeof m.mid === 'number');
      const scored = hand.map((id) => ({
        id,
        u: utility(hand, id, ctx, table2),
        v: E.identity(E.tileById(id), ctx).n,
      }));
      if (level === 0) for (const s of scored) s.u += Math.random() * 7;
      else if (level === 1) for (const s of scored) s.u += Math.random() * 2.5;
      scored.sort((a, b) => (a.u - b.u) || (b.v - a.v));
      discardId = scored[0].id;
    }
    steps.push({ t: 'discard', tile: discardId, force: true });

    return steps;
  }

  /** Botun düşünme süresi (insani hissettirmek için). */
  function thinkMs(level, kind) {
    const base = kind === 'draw' ? 620 : 900;
    const spread = level === 2 ? 380 : 700;
    return base + Math.random() * spread;
  }

  w.OkeyBot = { decideDraw, planActions, pickDiscard, utility, thinkMs };
})(window);
