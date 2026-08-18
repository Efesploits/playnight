/* =============================================================================
 *  PLAY NIGHT — SATRANÇ BOTU
 *  Alfa-beta + sessiz arama (yalnız alışlar), taş-kare tabloları, MVV-LVA
 *  hamle sıralaması. Host tarafında, motorun gerçek durumu üzerinde çalışır
 *  (yap / geri al — kopya yok).
 * ========================================================================== */
(function (global) {
  'use strict';
  const S = global.Satranc || (typeof require !== 'undefined' ? require('./engine.js') : null);

  const VAL = { 1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 0 };
  const INF = 1e9;
  const MATE = 1e6;

  /* Taş-kare tabloları (beyazın bakışıyla, a1 solda altta; 0..63). */
  const PST_P = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0];
  const PST_N = [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50];
  const PST_B = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20];
  const PST_R = [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0];
  const PST_Q = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
     0,  0,  5,  5,  5,  5,  0, -5,
    -5,  0,  5,  5,  5,  5,  0, -5,
   -10,  0,  5,  5,  5,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20];
  const PST_K = [
    20, 30, 10,  0,  0, 10, 30, 20,
    20, 20,  0,  0,  0,  0, 20, 20,
   -10,-20,-20,-20,-20,-20,-20,-10,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30];
  const PST = { 1: PST_P, 2: PST_N, 3: PST_B, 4: PST_R, 5: PST_Q, 6: PST_K };

  /* -------------------------------------------------------- değerleme -- */
  /** Pozisyon puanı — sıradaki tarafın bakışıyla (negamax uyumlu). */
  function evaluate(st) {
    let score = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const pc = st.b[sq];
      if (!pc) continue;
      const t = pc > 0 ? pc : -pc;
      const i = S.to64(sq);
      if (pc > 0) score += VAL[t] + PST[t][i];
      else score -= VAL[t] + PST[t][63 - ((i & ~7) | (7 - (i & 7)))]; // dikey ayna
    }
    return st.turn === S.W ? score : -score;
  }

  /* hamle sıralaması: önce büyük av / küçük avcı, sonra terfi */
  const orderKey = (m) => (m.capt ? 1000 + VAL[Math.abs(m.capt)] - VAL[Math.abs(m.piece)] / 10 : 0)
    + (m.promo ? 900 : 0);

  let nodes = 0;
  const NODE_BUDGET = 400000;

  /** Sessiz arama: yalnız alışlar, taşma yok. */
  function qsearch(st, alpha, beta) {
    nodes++;
    const stand = evaluate(st);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;

    const caps = S.genPseudo(st).filter((m) => m.capt);
    caps.sort((a, b2) => orderKey(b2) - orderKey(a));
    for (const m of caps) {
      const u = S.makeMove(st, m);
      if (S.inCheck(st, -st.turn)) { S.unmakeMove(st, m, u); continue; }
      const sc = -qsearch(st, -beta, -alpha);
      S.unmakeMove(st, m, u);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
      if (nodes > NODE_BUDGET) break;
    }
    return alpha;
  }

  function search(st, depth, alpha, beta, ply) {
    if (depth === 0) return qsearch(st, alpha, beta);
    nodes++;

    const moves = S.genPseudo(st);
    moves.sort((a, b2) => orderKey(b2) - orderKey(a));
    let any = false;

    for (const m of moves) {
      const u = S.makeMove(st, m);
      if (S.inCheck(st, -st.turn)) { S.unmakeMove(st, m, u); continue; }
      any = true;
      const sc = -search(st, depth - 1, -beta, -alpha, ply + 1);
      S.unmakeMove(st, m, u);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
      if (nodes > NODE_BUDGET) break;
    }

    if (!any) return S.inCheck(st, st.turn) ? -MATE + ply : 0;   // mat / pat
    return alpha;
  }

  /**
   * En iyi hamleyi seç.
   * @param st    motorun 0x88 durumu (yerinde aranır, değişmeden geri bırakılır)
   * @param level 0 acemi (derinlik 1) · 1 orta (2) · 2 usta (3)
   * @param seed  eşit hamleler arasında çeşitlilik için
   * @returns {{from,to,promo}|null} 0..63 koordinatlı hamle
   */
  function pickMove(st, level, seed) {
    const depth = level >= 2 ? 3 : level === 1 ? 2 : 1;
    const rnd = S.legalMoves ? mulberry(seed >>> 0) : Math.random;
    nodes = 0;

    const moves = S.legalMoves(st);
    if (!moves.length) return null;
    moves.sort((a, b2) => orderKey(b2) - orderKey(a));

    let best = null, bestScore = -INF;
    for (const m of moves) {
      const u = S.makeMove(st, m);
      let sc = -search(st, depth - 1, -INF, INF, 1);
      S.unmakeMove(st, m, u);
      sc += (rnd() - 0.5) * 8;   // küçük gürültü: her oyun aynı olmasın
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    return best ? { from: S.to64(best.from), to: S.to64(best.to), promo: best.promo || 0 } : null;
  }

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** İnsansı düşünme süresi (ms). */
  function thinkMs(level) {
    const base = level >= 2 ? 1100 : 800;
    return base + Math.random() * 1400;
  }

  const SatrancBot = { pickMove, thinkMs, evaluate };

  if (typeof module !== 'undefined' && module.exports) module.exports = SatrancBot;
  global.SatrancBot = SatrancBot;
})(typeof window !== 'undefined' ? window : globalThis);
