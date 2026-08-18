/* =============================================================================
 *  PLAY NIGHT — SATRANÇ KURAL MOTORU
 *  Saf JavaScript, DOM bağımsız. Host (oda kurucu) otoriter olarak çalıştırır.
 *
 *  Kural kaynağı: FIDE Satranç Kuralları (rok, geçerken alma, terfi, pat,
 *  50 hamle, üç tekrar, yetersiz materyal — hepsi uygulanır).
 *
 *  MODLAR
 *   - 1v1: klasik iki kişilik satranç
 *   - 2v2: danışma satrancı — iki takım, her takım 2 kişi. Takımdaki HERHANGİ
 *     biri takımın hamlesini yapabilir; kararlar aralarında verilir.
 *     Takım arkadaşları birbirine "fikir" gönderebilir (kare + taş);
 *     fikirler YALNIZCA kendi takımına görünür, rakip asla görmez.
 *
 *  Tahta 0x88 düzenindedir (128 hücre). Dış dünyaya 0..63 indeksleri gider
 *  (a1 = 0, h8 = 63).
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------ sabitler */
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;      // taşlar (beyaz +, siyah -)
  const W = 1, BL = -1;                                // taraflar
  const EMPTY = 0;

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 4;

  const DEFAULT_RULES = {
    mode: '1v1',        // '1v1' | '2v2'
    rounds: 2,          // maç kaç oyundan oluşur (renkler her oyunda değişir)
    minutes: 10,        // oyuncu başına süre (0 = süresiz)
    increment: 5,       // hamle başına eklenen saniye
  };

  /* rok hakları bit maskesi */
  const CASTLE_WK = 1, CASTLE_WQ = 2, CASTLE_BK = 4, CASTLE_BQ = 8;

  /* hamle bayrakları */
  const F_DOUBLE = 1, F_EP = 2, F_CASTLE = 4;

  const KNIGHT_D = [31, 33, 14, 18, -31, -33, -14, -18];
  const KING_D = [1, -1, 16, -16, 15, 17, -15, -17];
  const BISHOP_D = [15, 17, -15, -17];
  const ROOK_D = [1, -1, 16, -16];
  const QUEEN_D = KING_D;

  const PIECE_LETTER = { [N]: 'N', [B]: 'B', [R]: 'R', [Q]: 'Q', [K]: 'K' };
  const PIECE_NAME = { [P]: 'Piyon', [N]: 'At', [B]: 'Fil', [R]: 'Kale', [Q]: 'Vezir', [K]: 'Şah' };

  /* ---------------------------------------------------------- koordinat */
  const to88 = (i) => ((i >> 3) << 4) | (i & 7);       // 0..63 -> 0x88
  const to64 = (s) => ((s >> 4) << 3) | (s & 7);       // 0x88 -> 0..63
  const off = (s) => (s & 0x88) !== 0;                 // tahta dışı mı
  const fileOf = (s) => s & 7;
  const rankOf = (s) => s >> 4;
  const alg = (i) => 'abcdefgh'[i & 7] + (1 + (i >> 3));           // 0..63 -> "e4"
  const algToI = (a) => (a.charCodeAt(1) - 49) * 8 + (a.charCodeAt(0) - 97);

  /* ------------------------------------------------------------- durum -- */
  /** Başlangıç pozisyonu. */
  function startState() {
    return parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  }

  const FEN_PIECE = { p: -P, n: -N, b: -B, r: -R, q: -Q, k: -K, P, N, B, R, Q, K };
  const PIECE_FEN = { [P]: 'P', [N]: 'N', [B]: 'B', [R]: 'R', [Q]: 'Q', [K]: 'K' };

  function parseFen(fen) {
    const parts = String(fen).trim().split(/\s+/);
    const st = {
      b: new Array(128).fill(EMPTY),
      turn: parts[1] === 'b' ? BL : W,
      castle: 0,
      ep: -1,                 // 0x88 kare ya da -1
      half: parseInt(parts[4], 10) || 0,
      full: parseInt(parts[5], 10) || 1,
      kings: [0, 0],          // [beyaz şah 0x88, siyah şah 0x88]
    };
    let sq = 0x70;            // a8'den başla
    for (const ch of parts[0]) {
      if (ch === '/') { sq = (sq & 0xF0) - 16; continue; }
      if (ch >= '1' && ch <= '8') { sq += ch.charCodeAt(0) - 48; continue; }
      const pc = FEN_PIECE[ch];
      st.b[sq] = pc;
      if (pc === K) st.kings[0] = sq;
      if (pc === -K) st.kings[1] = sq;
      sq++;
    }
    const c = parts[2] || '-';
    if (c.includes('K')) st.castle |= CASTLE_WK;
    if (c.includes('Q')) st.castle |= CASTLE_WQ;
    if (c.includes('k')) st.castle |= CASTLE_BK;
    if (c.includes('q')) st.castle |= CASTLE_BQ;
    if (parts[3] && parts[3] !== '-') st.ep = to88(algToI(parts[3]));
    return st;
  }

  function toFen(st) {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const pc = st.b[(r << 4) | f];
        if (!pc) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        const L = PIECE_FEN[Math.abs(pc)];
        out += pc > 0 ? L : L.toLowerCase();
      }
      if (empty) out += empty;
      if (r) out += '/';
    }
    out += st.turn === W ? ' w ' : ' b ';
    let c = '';
    if (st.castle & CASTLE_WK) c += 'K';
    if (st.castle & CASTLE_WQ) c += 'Q';
    if (st.castle & CASTLE_BK) c += 'k';
    if (st.castle & CASTLE_BQ) c += 'q';
    out += (c || '-') + ' ' + (st.ep >= 0 ? alg(to64(st.ep)) : '-') + ' ' + st.half + ' ' + st.full;
    return out;
  }

  /** Üç tekrar anahtarı: taşlar + sıra + rok + ep. */
  const posKey = (st) => toFen(st).split(' ').slice(0, 4).join(' ');

  /* ----------------------------------------------------------- saldırı -- */
  /** `sq` karesi `by` tarafınca tehdit ediliyor mu? */
  function attacked(st, sq, by) {
    const b = st.b;
    /* piyon */
    const pd = by === W ? -16 : 16;   // saldıran piyon sq'ya göre nerede
    for (const side of [-1, 1]) {
      const s = sq + pd + side;
      if (!off(s) && b[s] === P * by) return true;
    }
    /* at */
    for (const d of KNIGHT_D) {
      const s = sq + d;
      if (!off(s) && b[s] === N * by) return true;
    }
    /* şah */
    for (const d of KING_D) {
      const s = sq + d;
      if (!off(s) && b[s] === K * by) return true;
    }
    /* kayan taşlar */
    for (const d of BISHOP_D) {
      let s = sq + d;
      while (!off(s)) {
        const pc = b[s];
        if (pc) { if (pc === B * by || pc === Q * by) return true; break; }
        s += d;
      }
    }
    for (const d of ROOK_D) {
      let s = sq + d;
      while (!off(s)) {
        const pc = b[s];
        if (pc) { if (pc === R * by || pc === Q * by) return true; break; }
        s += d;
      }
    }
    return false;
  }

  const inCheck = (st, side) => attacked(st, st.kings[side === W ? 0 : 1], -side);

  /* --------------------------------------------------------- hamle üret */
  function pushPawnMoves(list, from, to, capt, side) {
    const rank = rankOf(to);
    if ((side === W && rank === 7) || (side === BL && rank === 0)) {
      for (const pr of [Q, R, B, N]) list.push({ from, to, piece: P * side, capt, promo: pr, flags: 0 });
    } else {
      list.push({ from, to, piece: P * side, capt, promo: 0, flags: 0 });
    }
  }

  /** Sözde-yasal hamleler (şah kontrolü filtrelenmemiş). */
  function genPseudo(st) {
    const list = [];
    const b = st.b;
    const side = st.turn;

    for (let from = 0; from < 128; from++) {
      if (off(from)) continue;
      const pc = b[from];
      if (!pc || (pc > 0 ? W : BL) !== side) continue;
      const t = Math.abs(pc);

      if (t === P) {
        const fwd = side === W ? 16 : -16;
        const one = from + fwd;
        if (!off(one) && !b[one]) {
          pushPawnMoves(list, from, one, 0, side);
          const startRank = side === W ? 1 : 6;
          const two = from + fwd * 2;
          if (rankOf(from) === startRank && !b[two]) {
            list.push({ from, to: two, piece: pc, capt: 0, promo: 0, flags: F_DOUBLE });
          }
        }
        for (const s of [fwd - 1, fwd + 1]) {
          const to = from + s;
          if (off(to)) continue;
          const target = b[to];
          if (target && (target > 0 ? W : BL) !== side) pushPawnMoves(list, from, to, target, side);
          else if (to === st.ep && st.ep >= 0) {
            list.push({ from, to, piece: pc, capt: P * -side, promo: 0, flags: F_EP });
          }
        }
      } else if (t === N || t === K) {
        for (const d of (t === N ? KNIGHT_D : KING_D)) {
          const to = from + d;
          if (off(to)) continue;
          const target = b[to];
          if (!target || (target > 0 ? W : BL) !== side) {
            list.push({ from, to, piece: pc, capt: target, promo: 0, flags: 0 });
          }
        }
      } else {
        const dirs = t === B ? BISHOP_D : t === R ? ROOK_D : QUEEN_D;
        for (const d of dirs) {
          let to = from + d;
          while (!off(to)) {
            const target = b[to];
            if (!target) list.push({ from, to, piece: pc, capt: 0, promo: 0, flags: 0 });
            else {
              if ((target > 0 ? W : BL) !== side) list.push({ from, to, piece: pc, capt: target, promo: 0, flags: 0 });
              break;
            }
            to += d;
          }
        }
      }
    }

    /* rok: şah tehdit altında olamaz, geçtiği kareler tehditsiz ve boş olmalı */
    const home = side === W ? 0x04 : 0x74;
    if (st.kings[side === W ? 0 : 1] === home && !inCheck(st, side)) {
      const kBit = side === W ? CASTLE_WK : CASTLE_BK;
      const qBit = side === W ? CASTLE_WQ : CASTLE_BQ;
      if ((st.castle & kBit) && !b[home + 1] && !b[home + 2]
        && b[home + 3] === R * side
        && !attacked(st, home + 1, -side) && !attacked(st, home + 2, -side)) {
        list.push({ from: home, to: home + 2, piece: K * side, capt: 0, promo: 0, flags: F_CASTLE });
      }
      if ((st.castle & qBit) && !b[home - 1] && !b[home - 2] && !b[home - 3]
        && b[home - 4] === R * side
        && !attacked(st, home - 1, -side) && !attacked(st, home - 2, -side)) {
        list.push({ from: home, to: home - 2, piece: K * side, capt: 0, promo: 0, flags: F_CASTLE });
      }
    }
    return list;
  }

  /* ------------------------------------------------------- yap / geri al */
  function makeMove(st, m) {
    const b = st.b;
    const side = st.turn;
    const undo = {
      capt: m.capt, castle: st.castle, ep: st.ep, half: st.half,
      captSq: m.to,
    };

    b[m.from] = EMPTY;
    b[m.to] = m.promo ? m.promo * side : m.piece;

    if (m.flags & F_EP) {
      undo.captSq = m.to + (side === W ? -16 : 16);
      b[undo.captSq] = EMPTY;
    }
    if (m.flags & F_CASTLE) {
      if (m.to > m.from) { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = EMPTY; }
      else { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = EMPTY; }
    }
    if (Math.abs(m.piece) === K) st.kings[side === W ? 0 : 1] = m.to;

    /* rok hakları: şah ya da kale oynadı / kale alındı */
    const CQ = { 0x00: CASTLE_WQ, 0x07: CASTLE_WK, 0x70: CASTLE_BQ, 0x77: CASTLE_BK };
    if (Math.abs(m.piece) === K) st.castle &= side === W ? ~(CASTLE_WK | CASTLE_WQ) : ~(CASTLE_BK | CASTLE_BQ);
    if (CQ[m.from] !== undefined) st.castle &= ~CQ[m.from];
    if (CQ[m.to] !== undefined) st.castle &= ~CQ[m.to];

    st.ep = (m.flags & F_DOUBLE) ? m.from + (side === W ? 16 : -16) : -1;
    st.half = (m.capt || Math.abs(m.piece) === P) ? 0 : st.half + 1;
    if (side === BL) st.full++;
    st.turn = -side;
    return undo;
  }

  function unmakeMove(st, m, undo) {
    const side = -st.turn;   // hamleyi yapan taraf
    st.turn = side;
    if (side === BL) st.full--;
    st.castle = undo.castle;
    st.ep = undo.ep;
    st.half = undo.half;

    st.b[m.from] = m.piece;
    st.b[m.to] = EMPTY;
    if (undo.capt) st.b[undo.captSq] = undo.capt;
    if (m.flags & F_CASTLE) {
      if (m.to > m.from) { st.b[m.from + 3] = st.b[m.from + 1]; st.b[m.from + 1] = EMPTY; }
      else { st.b[m.from - 4] = st.b[m.from - 1]; st.b[m.from - 1] = EMPTY; }
    }
    if (Math.abs(m.piece) === K) st.kings[side === W ? 0 : 1] = m.from;
  }

  /** Yasal hamleler (kendi şahını tehdide bırakan hamleler elenir). */
  function legalMoves(st) {
    const out = [];
    for (const m of genPseudo(st)) {
      const u = makeMove(st, m);
      if (!inCheck(st, -st.turn)) out.push(m);
      unmakeMove(st, m, u);
    }
    return out;
  }

  /** Perft — hamle üretici doğrulaması. */
  function perft(st, depth) {
    if (depth === 0) return 1;
    let nodes = 0;
    for (const m of genPseudo(st)) {
      const u = makeMove(st, m);
      if (!inCheck(st, -st.turn)) nodes += depth === 1 ? 1 : perft(st, depth - 1);
      unmakeMove(st, m, u);
    }
    return nodes;
  }

  /* --------------------------------------------------------------- SAN -- */
  /** Hamlenin standart cebirsel yazımı (pozisyon hamleden ÖNCE olmalı). */
  function san(st, m) {
    let out;
    const t = Math.abs(m.piece);

    if (m.flags & F_CASTLE) {
      out = m.to > m.from ? 'O-O' : 'O-O-O';
    } else if (t === P) {
      out = m.capt ? 'abcdefgh'[fileOf(m.from)] + 'x' + alg(to64(m.to)) : alg(to64(m.to));
      if (m.promo) out += '=' + PIECE_LETTER[m.promo];
    } else {
      /* belirsizlik çözümü: aynı türden başka taş da aynı kareye gidebiliyor mu */
      let sameFile = false, sameRank = false, amb = false;
      for (const o of legalMoves(st)) {
        if (o.from === m.from || o.to !== m.to || Math.abs(o.piece) !== t) continue;
        amb = true;
        if (fileOf(o.from) === fileOf(m.from)) sameFile = true;
        if (rankOf(o.from) === rankOf(m.from)) sameRank = true;
      }
      out = PIECE_LETTER[t];
      if (amb) {
        if (!sameFile) out += 'abcdefgh'[fileOf(m.from)];
        else if (!sameRank) out += String(1 + rankOf(m.from));
        else out += alg(to64(m.from));
      }
      if (m.capt) out += 'x';
      out += alg(to64(m.to));
    }

    const u = makeMove(st, m);
    if (inCheck(st, st.turn)) out += legalMoves(st).length ? '+' : '#';
    unmakeMove(st, m, u);
    return out;
  }

  /* ------------------------------------------------- yetersiz materyal -- */
  /** Bu taraf tek başına mat edebilir mi? (bayrak düşünce hükmen/berabere kararı) */
  function hasMatingMaterial(st, side) {
    let minor = 0;
    for (let s = 0; s < 128; s++) {
      if (off(s)) continue;
      const pc = st.b[s];
      if (!pc || (pc > 0 ? W : BL) !== side) continue;
      const t = Math.abs(pc);
      if (t === P || t === R || t === Q) return true;
      if (t === N || t === B) minor++;
    }
    return minor >= 2;   // iki hafif taş (yaklaşık — KNN teknik istisnası göz ardı)
  }

  /** İki taraf da mat edemiyorsa oyun ölüdür (K-K, K+hafif-K, K+F-K+F aynı renk). */
  function insufficientMaterial(st) {
    const pieces = [];
    for (let s = 0; s < 128; s++) {
      if (off(s)) continue;
      const pc = st.b[s];
      if (!pc) continue;
      const t = Math.abs(pc);
      if (t === P || t === R || t === Q) return false;
      if (t !== K) pieces.push({ t, sq: s });
    }
    if (pieces.length <= 1) return true;                         // K-K veya K+hafif-K
    if (pieces.length === 2 && pieces[0].t === B && pieces[1].t === B) {
      const c0 = (fileOf(pieces[0].sq) + rankOf(pieces[0].sq)) & 1;
      const c1 = (fileOf(pieces[1].sq) + rankOf(pieces[1].sq)) & 1;
      return c0 === c1;                                          // aynı renk filler
    }
    return false;
  }

  /* ========================================================== MAÇ ====== */
  const fail = (reason) => ({ ok: false, reason });
  const sideChar = (s) => (s === W ? 'w' : 'b');

  function createGame(players, rules) {
    const r = Object.assign({}, DEFAULT_RULES, rules || {});
    const n = players.length;
    if (r.mode === '2v2') {
      if (n !== 4) throw new Error('2v2 için 4 oyuncu gerekir');
    } else if (n !== 2) {
      throw new Error('1v1 için 2 oyuncu gerekir');
    }

    const ps = players.map((p, i) => ({
      seat: i, id: p.id, name: p.name, color: p.color || 0,
      isBot: !!p.isBot, connected: p.connected !== false,
      team: r.mode === '2v2' ? (p.team === 1 ? 1 : 0) : i,
    }));
    if (r.mode === '2v2') {
      const t0 = ps.filter((p) => p.team === 0).length;
      if (t0 !== 2) throw new Error('Takımlar 2\'şer kişi olmalı');
    }

    return {
      rules: r,
      mode: r.mode,
      players: ps,
      n,
      roundNo: 0,
      round: null,
      score: [0, 0],        // takım puanları (1v1'de oyuncu puanları)
      over: false,
      winner: null,          // kazanan takım indeksi (berabere: null)
      history: [],
    };
  }

  const teamOf = (match, seat) => match.players[seat].team;

  /** Bu elde koltuğun oynadığı taraf. */
  function sideOfSeat(match, round, seat) {
    return teamOf(match, seat) === round.whiteTeam ? W : BL;
  }

  /** Taraftaki koltuklar. */
  function seatsOfSide(match, round, side) {
    const team = side === W ? round.whiteTeam : 1 - round.whiteTeam;
    return match.players.filter((p) => p.team === team).map((p) => p.seat);
  }

  function startRound(match, seed, now) {
    void seed;   // satrançta rastgelelik yok; imza tutarlılığı için
    const t = now || Date.now();
    match.roundNo++;
    const round = {
      no: match.roundNo,
      whiteTeam: match.roundNo % 2 === 1 ? 0 : 1,   // renkler her elde değişir
      st: startState(),
      sanHistory: [],
      moves: [],                 // {from, to, promo} (0..63) — tekrar oynatma için
      lastMove: null,            // {from, to} (0..63)
      captured: { w: [], b: [] },// tarafın ALDIĞI taşlar (mutlak tür kodları)
      keys: {},                  // üç tekrar sayacı
      clocks: {
        w: match.rules.minutes ? match.rules.minutes * 60000 : null,
        b: match.rules.minutes ? match.rules.minutes * 60000 : null,
      },
      lastMoveAt: t,
      suggests: {},              // seat -> {from, to, at} — SADECE takım içi görünür
      drawOffer: null,           // {team, seat}
      phase: 'play',
      finished: false,
      result: null,
      startedAt: t,
    };
    round.keys[posKey(round.st)] = 1;
    match.round = round;
    return round;
  }

  /* ------------------------------------------------------------ bitirme */
  function finishRound(match, winner, reason) {
    const round = match.round;
    round.finished = true;
    round.phase = 'over';
    round.suggests = {};
    round.drawOffer = null;
    round.result = {
      winner,                                  // 'w' | 'b' | null (berabere)
      reason,
      winnerTeam: winner === 'w' ? round.whiteTeam : winner === 'b' ? 1 - round.whiteTeam : null,
      sanCount: round.sanHistory.length,
      finishedAt: Date.now(),
    };
    return { ok: true, finished: true, result: round.result };
  }

  /** Hamle sonrası otomatik bitiş kontrolleri. */
  function checkGameEnd(match) {
    const round = match.round;
    const st = round.st;
    const moves = legalMoves(st);

    if (!moves.length) {
      if (inCheck(st, st.turn)) {
        return finishRound(match, sideChar(-st.turn), 'mat');
      }
      return finishRound(match, null, 'pat');
    }
    if (st.half >= 100) return finishRound(match, null, '50 hamle');
    if ((round.keys[posKey(st)] || 0) >= 3) return finishRound(match, null, 'üç tekrar');
    if (insufficientMaterial(st)) return finishRound(match, null, 'yetersiz materyal');
    return null;
  }

  /* -------------------------------------------------------------- hamle */
  /**
   * Hamle yap. from/to 0..63, promo: Q/R/B/N kodu (gerekliyse).
   * 2v2'de sıradaki takımın HERHANGİ bir üyesi oynayabilir.
   */
  function move(match, seat, from64, to64i, promo, now) {
    const round = match.round;
    if (!round || round.finished) return fail('Oyun bitti');
    const st = round.st;
    const side = sideOfSeat(match, round, seat);
    if (st.turn !== side) return fail('Sıra sizde değil');

    const from = to88(from64 | 0), to = to88(to64i | 0);
    if (off(from) || off(to)) return fail('Geçersiz kare');

    const mv = legalMoves(st).find((m) => m.from === from && m.to === to
      && (!m.promo || m.promo === (promo || Q)));
    if (!mv) return fail('Geçersiz hamle');

    /* saat: geçen süreyi düş, bayrak düştüyse hamle yerine süre kaybı */
    const t = now || Date.now();
    if (round.clocks[sideChar(side)] !== null) {
      const left = round.clocks[sideChar(side)] - (t - round.lastMoveAt);
      if (left <= 0) return flagFall(match, side);
      round.clocks[sideChar(side)] = left + (match.rules.increment || 0) * 1000;
    }
    round.lastMoveAt = t;

    const notation = san(st, mv);
    const captType = mv.capt ? Math.abs(mv.capt) : 0;
    makeMove(st, mv);

    round.sanHistory.push(notation);
    round.moves.push({ from: from64 | 0, to: to64i | 0, promo: mv.promo || 0 });
    round.lastMove = { from: from64 | 0, to: to64i | 0 };
    if (captType) round.captured[sideChar(side)].push(captType);
    round.keys[posKey(st)] = (round.keys[posKey(st)] || 0) + 1;

    /* hamle yapılınca fikirler ve beraberlik teklifi düşer */
    round.suggests = {};
    round.drawOffer = null;

    const end = checkGameEnd(match);
    if (end) return Object.assign(end, { san: notation, moved: mv, capt: captType });

    return {
      ok: true, san: notation, moved: mv, capt: captType,
      check: inCheck(st, st.turn), turn: sideChar(st.turn),
    };
  }

  /** Bayrak düştü: rakibin mat edecek taşı varsa kaybeder, yoksa berabere. */
  function flagFall(match, side) {
    const round = match.round;
    if (hasMatingMaterial(round.st, -side)) {
      return finishRound(match, sideChar(-side), 'süre');
    }
    return finishRound(match, null, 'süre + yetersiz materyal');
  }

  /** Host'un periyodik saat kontrolü. Bayrak düştüyse eli bitirir. */
  function tickClock(match, now) {
    const round = match.round;
    if (!round || round.finished) return null;
    const side = round.st.turn;
    const c = round.clocks[sideChar(side)];
    if (c === null) return null;
    const t = now || Date.now();
    if (c - (t - round.lastMoveAt) > 0) return null;
    return flagFall(match, side);
  }

  /* --------------------------------------------------- teslim/beraberlik */
  function resign(match, seat) {
    const round = match.round;
    if (!round || round.finished) return fail('Oyun bitti');
    const side = sideOfSeat(match, round, seat);
    return finishRound(match, sideChar(-side), 'terk');
  }

  function offerDraw(match, seat) {
    const round = match.round;
    if (!round || round.finished) return fail('Oyun bitti');
    if (round.drawOffer) return fail('Zaten bir teklif var');
    round.drawOffer = { team: teamOf(match, seat), seat };
    return { ok: true };
  }

  function answerDraw(match, seat, accept) {
    const round = match.round;
    if (!round || round.finished) return fail('Oyun bitti');
    if (!round.drawOffer) return fail('Beraberlik teklifi yok');
    if (round.drawOffer.team === teamOf(match, seat)) return fail('Kendi teklifine cevap veremezsin');
    if (!accept) { round.drawOffer = null; return { ok: true, declined: true }; }
    return finishRound(match, null, 'anlaşma');
  }

  /* ------------------------------------------------------------- fikir -- */
  /**
   * Takım arkadaşına fikir gönder: "şu taşı şu kareye koyalım".
   * Yalnızca 2v2'de. Fikir SADECE kendi takımının görünümüne gider —
   * rakip takım bunu asla görmez (viewFor filtreler).
   */
  function suggestMove(match, seat, from64, to64i) {
    const round = match.round;
    if (!round || round.finished) return fail('Oyun bitti');
    if (match.mode !== '2v2') return fail('Fikir verme yalnızca 2v2 modunda');

    const from = to88(from64 | 0), to = to88(to64i | 0);
    if (off(from) || off(to) || from === to) return fail('Geçersiz kare');

    const side = sideOfSeat(match, round, seat);
    const pc = round.st.b[from];
    if (!pc || (pc > 0 ? W : BL) !== side) return fail('O karede senin taşın yok');

    /* sıra bizdeyse fikir yasal bir hamle olmalı; değilse plan serbesttir */
    if (round.st.turn === side) {
      const legal = legalMoves(round.st).some((m) => m.from === from && m.to === to);
      if (!legal) return fail('Bu hamle şu an yasal değil');
    }

    round.suggests[seat] = { from: from64 | 0, to: to64i | 0, at: Date.now() };
    return { ok: true };
  }

  function clearSuggest(match, seat) {
    const round = match.round;
    if (!round) return fail('Oyun yok');
    delete round.suggests[seat];
    return { ok: true };
  }

  /* --------------------------------------------------------- maça işle -- */
  function applyResult(match) {
    const res = match.round && match.round.result;
    if (!res) return null;

    if (res.winnerTeam !== null && res.winnerTeam !== undefined) {
      match.score[res.winnerTeam] += 1;
    } else {
      match.score[0] += 0.5;
      match.score[1] += 0.5;
    }
    match.history.push({ no: match.round.no, winner: res.winner, winnerTeam: res.winnerTeam, reason: res.reason });

    if (match.roundNo >= match.rules.rounds) {
      match.over = true;
      match.winner = match.score[0] > match.score[1] ? 0
        : match.score[1] > match.score[0] ? 1 : null;
    }
    return { over: match.over, winner: match.winner, score: match.score.slice() };
  }

  /* ---------------------------------------------------- oyuncu görünümü */
  /** 64'lük düz tahta (a1=0). */
  function board64(st) {
    const out = new Array(64);
    for (let i = 0; i < 64; i++) out[i] = st.b[to88(i)];
    return out;
  }

  /**
   * Bir koltuğa yollanacak durum. Tahta herkese açıktır (satrançta gizli
   * bilgi yoktur) — ama FİKİRLER yalnızca kendi takımına gider.
   */
  function viewFor(match, seat) {
    const round = match.round;
    const st = round.st;
    const side = sideOfSeat(match, round, seat);
    const myTurn = !round.finished && st.turn === side;
    const myTeam = teamOf(match, seat);

    /* fikirler: yalnızca kendi takımından olanlar */
    const suggests = [];
    for (const [s, sg] of Object.entries(round.suggests)) {
      const sSeat = parseInt(s, 10);
      if (teamOf(match, sSeat) === myTeam) {
        suggests.push({ seat: sSeat, from: sg.from, to: sg.to });
      }
    }

    const checkSq = inCheck(st, st.turn) ? to64(st.kings[st.turn === W ? 0 : 1]) : null;

    return {
      roundNo: round.no,
      rounds: match.rules.rounds,
      rules: match.rules,
      mode: match.mode,
      mySeat: seat,
      mySide: sideChar(side),
      myTeam,
      turn: sideChar(st.turn),
      myTurn,
      board: board64(st),
      castle: st.castle,
      ep: st.ep >= 0 ? to64(st.ep) : null,
      legal: myTurn
        ? legalMoves(st).map((m) => ({ from: to64(m.from), to: to64(m.to), promo: m.promo || 0 }))
        : [],
      check: checkSq,
      lastMove: round.lastMove,
      sanHistory: round.sanHistory.slice(),
      captured: { w: round.captured.w.slice(), b: round.captured.b.slice() },
      clocks: { w: round.clocks.w, b: round.clocks.b },
      lastMoveAt: round.lastMoveAt,
      increment: match.rules.increment,
      suggests,
      drawOffer: round.drawOffer ? { team: round.drawOffer.team } : null,
      score: match.score.slice(),
      whiteTeam: round.whiteTeam,
      finished: round.finished,
      result: round.result,
      players: match.players.map((p) => ({
        seat: p.seat, id: p.id, name: p.name, color: p.color,
        isBot: p.isBot, connected: p.connected, team: p.team,
        side: sideChar(sideOfSeat(match, round, p.seat)),
      })),
    };
  }

  /* -------------------------------------------- istemci yardımcıları --- */
  /**
   * Fikir seçici için: `to` karesine gidebilecek KENDİ taşlarım.
   * Sıra rakipteyken de çalışır (plan yapmak serbest) — o durumda sıra
   * bizdeymiş gibi hesaplanır.
   */
  function candidatesTo(view, target64) {
    const st = {
      b: new Array(128).fill(EMPTY),
      turn: view.mySide === 'w' ? W : BL,
      castle: view.castle || 0,
      ep: view.ep !== null && view.ep !== undefined ? to88(view.ep) : -1,
      half: 0, full: 1, kings: [0x04, 0x74],
    };
    for (let i = 0; i < 64; i++) {
      const pc = view.board[i];
      st.b[to88(i)] = pc;
      if (pc === K) st.kings[0] = to88(i);
      if (pc === -K) st.kings[1] = to88(i);
    }
    const out = [];
    for (const m of legalMoves(st)) {
      if (to64(m.to) !== target64) continue;
      if (out.some((o) => o.from === to64(m.from))) continue;   // terfi çeşitleri tek sayılır
      out.push({ from: to64(m.from), to: target64, piece: Math.abs(m.piece) });
    }
    return out;
  }

  const Satranc = {
    P, N, B, R, Q, K, W, BL, EMPTY,
    MIN_PLAYERS, MAX_PLAYERS, DEFAULT_RULES,
    PIECE_LETTER, PIECE_NAME,
    to88, to64, off, alg, algToI,
    startState, parseFen, toFen, posKey,
    attacked, inCheck, genPseudo, legalMoves, makeMove, unmakeMove, perft, san,
    hasMatingMaterial, insufficientMaterial, board64,
    createGame, startRound, move, tickClock, flagFall,
    resign, offerDraw, answerDraw, suggestMove, clearSuggest,
    applyResult, viewFor, candidatesTo,
    sideOfSeat, seatsOfSide, teamOf,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Satranc;
  global.Satranc = Satranc;
})(typeof window !== 'undefined' ? window : globalThis);
