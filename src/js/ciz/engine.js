/* =============================================================================
 *  PLAY NIGHT — ÇİZ BABACIM (Gartic Phone tarzı)
 *
 *  Herkesin bir "defteri" vardır. 1. turda herkes kendi defterine bir cümle
 *  yazar. Sonra defterler el değiştirir: gelen cümleyi çizersin, sonraki oyuncu
 *  çizimi görüp ne olduğunu tahmin eder, o tahmini bir sonraki çizer...
 *  Sonunda her defter baştan sona açılır ve cümlenin ne hale geldiği görülür.
 *
 *  Saf mantık — DOM bilmez, Node'da da çalışır.
 * ========================================================================== */
(function (global) {
  'use strict';

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 8;

  const DEFAULT_RULES = {
    writeSeconds: 45,     // cümle yazma süresi
    drawSeconds: 75,      // çizim süresi
    guessSeconds: 40,     // çizimi tahmin etme süresi
    rounds: 0,            // 0 = oyuncu sayısına göre otomatik
    maxTextLen: 90,
    maxPoints: 14000,     // bir çizimdeki en fazla nokta (kötüye kullanım kalkanı)
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /** Oyuncu sayısına göre tur sayısı: herkes her deftere birer kez dokunsun. */
  function roundCountFor(n, rules) {
    if (rules && rules.rounds > 0) return clamp(rules.rounds, 2, MAX_PLAYERS);
    return clamp(Math.max(4, n), 2, MAX_PLAYERS);
  }

  /** Turun türü: çift turlar yazı, tek turlar çizim. */
  const roundType = (round) => (round % 2 === 0 ? 'text' : 'draw');

  /** Tur içinde oyuncunun hangi deftere baktığı (defterler her tur kayar). */
  const bookIndexFor = (seat, round, n) => ((seat - round) % n + n) % n;

  function createGame(players, rules) {
    const r = Object.assign({}, DEFAULT_RULES, rules || {});
    const n = players.length;
    if (n < MIN_PLAYERS) throw new Error('En az 2 oyuncu gerekir');

    return {
      rules: r,
      players: players.map((p, i) => ({
        seat: i, id: p.id, name: p.name, color: p.color || 0,
        isBot: !!p.isBot, connected: p.connected !== false,
      })),
      n,
      rounds: roundCountFor(n, r),
      round: 0,
      phase: 'play',           // play | present | done
      /* her defterin adımları: steps[round] = {type, by, value} */
      books: players.map((p, i) => ({ owner: i, ownerName: p.name, steps: [] })),
      submitted: [],           // bu turda gönderim yapan koltuklar
      deadline: null,
      present: { book: 0, step: 0 },
      startedAt: Date.now(),
    };
  }

  /** Bu turda oyuncunun önündeki görev. */
  function taskFor(game, seat) {
    if (game.phase !== 'play') return null;
    const round = game.round;
    const bookIdx = bookIndexFor(seat, round, game.n);
    const book = game.books[bookIdx];
    const type = roundType(round);
    const source = round === 0 ? null : (book.steps[round - 1] || null);

    return {
      round,
      total: game.rounds,
      bookIdx,
      type,                                   // 'text' | 'draw'
      /* round 0 serbest cümle, sonrakiler tahmin */
      kind: round === 0 ? 'seed' : (type === 'text' ? 'guess' : 'draw'),
      source,                                 // önceki adım (çizim ya da cümle)
      sourceBy: source ? sourceName(game, source.by) : null,
      done: game.submitted.indexOf(seat) !== -1,
      deadline: game.deadline,
      seconds: secondsFor(game, round),
    };
  }

  const sourceName = (game, seat) => (game.players[seat] ? game.players[seat].name : '?');

  function secondsFor(game, round) {
    const r = game.rules;
    if (round === 0) return r.writeSeconds;
    return roundType(round) === 'draw' ? r.drawSeconds : r.guessSeconds;
  }

  /** Turu başlat (süreyi kur, gönderimleri sıfırla). */
  function beginRound(game) {
    game.submitted = [];
    const secs = secondsFor(game, game.round);
    game.deadline = secs ? Date.now() + secs * 1000 : null;
    return game;
  }

  /* ----------------------------------------------------------- gönderim -- */
  const fail = (reason) => ({ ok: false, reason });

  /** Metni temizle ve kırp. */
  function cleanText(v, max) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /**
   * Çizim verisini doğrula ve normalize et.
   * Biçim: { strokes: [ {c:renkIdx, s:kalınlıkIdx, e:0|1, p:[x,y,...]} ] }
   * Koordinatlar 0..1000 (x) ve 0..700 (y) mantıksal düzlemde tamsayıdır.
   */
  function cleanDrawing(v, maxPoints) {
    const out = { strokes: [] };
    if (!v || !Array.isArray(v.strokes)) return out;
    let total = 0;
    for (const s of v.strokes) {
      if (!s || !Array.isArray(s.p) || s.p.length < 2) continue;
      const pts = [];
      for (let i = 0; i + 1 < s.p.length; i += 2) {
        const x = Math.round(Number(s.p[i])), y = Math.round(Number(s.p[i + 1]));
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        pts.push(clamp(x, 0, 1000), clamp(y, 0, 700));
        total += 1;
        if (total > maxPoints) break;
      }
      if (pts.length >= 2) {
        out.strokes.push({
          c: clamp(parseInt(s.c, 10) || 0, 0, 31),
          s: clamp(parseInt(s.s, 10) || 0, 0, 5),
          e: s.e ? 1 : 0,
          p: pts,
        });
      }
      if (total > maxPoints) break;
    }
    return out;
  }

  /** Oyuncunun bu turdaki gönderimini kaydet. */
  function submit(game, seat, round, value) {
    if (game.phase !== 'play') return fail('Şu an gönderim yapılamaz');
    if (round !== game.round) return fail('Tur değişmiş');
    if (game.submitted.indexOf(seat) !== -1) return fail('Zaten gönderdin');

    const bookIdx = bookIndexFor(seat, round, game.n);
    const type = roundType(round);
    const clean = type === 'text'
      ? cleanText(value, game.rules.maxTextLen)
      : cleanDrawing(value, game.rules.maxPoints);

    if (type === 'text' && !clean) return fail('Boş cümle gönderilemez');

    game.books[bookIdx].steps[round] = { type, by: seat, value: clean, at: Date.now() };
    game.submitted.push(seat);
    return { ok: true, allDone: game.submitted.length >= game.n };
  }

  /** Süre dolunca eksik gönderimleri yer tutucuyla doldur. */
  function fillMissing(game) {
    const filled = [];
    for (let seat = 0; seat < game.n; seat++) {
      if (game.submitted.indexOf(seat) !== -1) continue;
      const bookIdx = bookIndexFor(seat, game.round, game.n);
      const type = roundType(game.round);
      game.books[bookIdx].steps[game.round] = {
        type, by: seat, empty: true,
        value: type === 'text' ? '(yetiştiremedi)' : { strokes: [] },
        at: Date.now(),
      };
      game.submitted.push(seat);
      filled.push(seat);
    }
    return filled;
  }

  /** Sonraki tura geç; turlar bittiyse sunuma geç. */
  function advance(game) {
    game.round++;
    if (game.round >= game.rounds) {
      game.phase = 'present';
      game.present = { book: 0, step: 0 };
      game.deadline = null;
      return { phase: 'present' };
    }
    beginRound(game);
    return { phase: 'play', round: game.round };
  }

  /* ------------------------------------------------------------- sunum -- */
  /** Sunumda bir adım ilerle. */
  function presentNext(game) {
    if (game.phase !== 'present') return { done: true };
    const book = game.books[game.present.book];
    const steps = book.steps.filter(Boolean);

    if (game.present.step + 1 < steps.length) {
      game.present.step++;
      return { book: game.present.book, step: game.present.step, done: false };
    }
    if (game.present.book + 1 < game.books.length) {
      game.present.book++;
      game.present.step = 0;
      return { book: game.present.book, step: 0, newBook: true, done: false };
    }
    game.phase = 'done';
    return { done: true };
  }

  /** Sunumun o anki görünümü: defterin şu ana kadar açılan adımları. */
  function presentView(game) {
    const b = game.books[game.present.book];
    const steps = b.steps.filter(Boolean);
    return {
      bookIndex: game.present.book,
      bookCount: game.books.length,
      owner: b.owner,
      ownerName: b.ownerName,
      step: game.present.step,
      stepCount: steps.length,
      steps: steps.slice(0, game.present.step + 1).map((s) => ({
        type: s.type, by: s.by, byName: sourceName(game, s.by),
        value: s.value, empty: !!s.empty,
      })),
      isLastBook: game.present.book >= game.books.length - 1,
      isLastStep: game.present.step >= steps.length - 1,
    };
  }

  /** Tüm defterler (oyun sonu özeti / arşiv). */
  function allBooks(game) {
    return game.books.map((b) => ({
      owner: b.owner, ownerName: b.ownerName,
      steps: b.steps.filter(Boolean).map((s) => ({
        type: s.type, by: s.by, byName: sourceName(game, s.by), value: s.value, empty: !!s.empty,
      })),
    }));
  }

  /* ------------------------------------------------------- oyuncu görünümü */
  /** Bir koltuğa yollanacak durum (başkasının görevi sızmaz). */
  function viewFor(game, seat) {
    return {
      round: game.round,
      rounds: game.rounds,
      phase: game.phase,
      mySeat: seat,
      deadline: game.deadline,
      players: game.players.map((p) => ({
        seat: p.seat, id: p.id, name: p.name, color: p.color,
        isBot: p.isBot, connected: p.connected,
        done: game.submitted.indexOf(p.seat) !== -1,
      })),
      task: game.phase === 'play' ? taskFor(game, seat) : null,
      present: game.phase === 'present' || game.phase === 'done' ? presentView(game) : null,
      submittedCount: game.submitted.length,
    };
  }

  const Ciz = {
    MIN_PLAYERS, MAX_PLAYERS, DEFAULT_RULES,
    createGame, taskFor, beginRound, submit, fillMissing, advance,
    presentNext, presentView, allBooks, viewFor,
    roundType, bookIndexFor, roundCountFor, secondsFor,
    cleanText, cleanDrawing,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Ciz;
  global.Ciz = Ciz;
})(typeof window !== 'undefined' ? window : globalThis);
