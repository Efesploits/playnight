/* =============================================================================
 *  PLAY NIGHT — PAPAZ KAÇTI BOTLARI
 *
 *  Amaç sadece "geçerli hamle" değil, masada oturuyormuş gibi davranmak:
 *   - Papazı tutan acemi bot kartı elinde huzursuzca oynatır ("tell" verir)
 *   - Bazıları blöf yapıp masum bir kartı öne iter
 *   - Usta bot tell vermez ama başkasının tell'ini okur
 *   - Herkes olan bitene kısa laflarla tepki verir
 * ========================================================================== */
(function (w) {
  'use strict';
  const P = w.Papaz;

  /* Aynı el durumunda aynı sonucu veren rastgelelik (tell titremesin). */
  function stable(seat, roundNo, len, salt) {
    return P.mulberry32(((seat + 1) * 7919 + roundNo * 104729 + len * 31 + (salt || 0)) >>> 0);
  }

  /* --------------------------------------------------------- tell ----- */
  /**
   * Botun elinde görsel olarak "öne ittiği" kartın konumu.
   * @returns {number|null} el içindeki konum ya da null (tell yok)
   */
  function tellIndex(hand, seat, roundNo, level) {
    if (!hand || hand.length < 2) return null;
    const rnd = stable(seat, roundNo, hand.length, 7);
    const papazAt = hand.indexOf(P.PAPAZ_ID);
    const roll = rnd();

    if (level === 0) {
      /* acemi: papazı elinde oynar, ele verir */
      if (papazAt !== -1 && roll < 0.55) return papazAt;
      if (roll < 0.7) return Math.floor(rnd() * hand.length);
      return null;
    }
    if (level === 1) {
      if (papazAt !== -1 && roll < 0.22) return papazAt;     // ara sıra sızdırır
      if (roll < 0.45) return Math.floor(rnd() * hand.length); // blöf
      return null;
    }
    /* usta: gerçek papazı asla göstermez, sadece blöf yapar */
    if (roll < 0.32) {
      let i = Math.floor(rnd() * hand.length);
      if (i === papazAt) i = (i + 1) % hand.length;
      return i;
    }
    return null;
  }

  /* -------------------------------------------------- kart seçimi ----- */
  /**
   * Rakibin yelpazesinden hangi konumdaki kart çekilsin?
   * @param count  rakibin elindeki kart sayısı
   * @param tell   rakibin öne ittiği konum (biliniyorsa)
   */
  function pickIndex(count, tell, level) {
    if (count <= 1) return 0;

    /* usta bot tell'i okur ve o kartı ES GEÇER (papaz olabilir) */
    if (level === 2 && tell !== null && tell !== undefined && Math.random() < 0.75) {
      let i = Math.floor(Math.random() * count);
      let guard = 0;
      while (i === tell && guard++ < 8) i = Math.floor(Math.random() * count);
      return i;
    }
    /* normal bot bazen tuzağa düşer */
    if (level === 1 && tell !== null && tell !== undefined && Math.random() < 0.3) {
      return tell;
    }
    /* acemi bot uçlardan çekmeyi sever (insanlar gibi) */
    if (level === 0 && Math.random() < 0.45) {
      return Math.random() < 0.5 ? 0 : count - 1;
    }
    return Math.floor(Math.random() * count);
  }

  /* ------------------------------------------------------ tepkiler ---- */
  const LINES = {
    think:    ['Hmm…', 'Şuradan mı acaba?', 'Bakalım…', 'Kısmet…', 'Bu olsun.'],
    gavePapaz:['Afiyet olsun 😈', 'Kolay gelsin!', 'Ohh, gitti be 😌', 'Güle güle kullan!'],
    gaveGood: ['Ay o değildi!', 'Onu alma dedim!', 'Hıh, tam da onu…', 'Yazık oldu.'],
    gotPapaz: ['Yok artık 😰', 'Bende kalmasın!', 'Bu ne şans ya!', 'Eyvah…'],
    paired:   ['Ohh be 😌', 'Gitti bir tane!', 'Bir eksildi!', 'İşte böyle!'],
    nothing:  ['Boş çıktı…', 'Olmadı.', 'Eh…', 'Tuttum tutacağım.'],
    out:      ['Kurtuldum! 🎉', 'Bana müsaade!', 'Bitti bende!', 'Kolay gelsin size 👋'],
    lose:     ['Yine bende 😩', 'Papaz beni sevdi…', 'Bir dahakine!', 'Olmadı ya!'],
    taunt:    ['Papaz kimde acaba? 👀', 'Elin titriyor bak!', 'O kartı sevdim…', 'Ben bilirim onu 😏'],
  };

  function line(kind) {
    const arr = LINES[kind] || LINES.think;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Botun bu olaya tepki verip vermeyeceği (her seferinde konuşmasın). */
  function shouldReact(kind) {
    if (kind === 'gotPapaz' || kind === 'out' || kind === 'lose') return true;
    if (kind === 'gavePapaz') return Math.random() < 0.8;
    if (kind === 'paired') return Math.random() < 0.35;
    if (kind === 'taunt') return Math.random() < 0.12;
    return Math.random() < 0.22;
  }

  /* --------------------------------------------------------- süre ----- */
  function thinkMs(level) {
    /* insanlar kartı hemen seçmez; biraz gezinir */
    const base = level === 2 ? 900 : 1200;
    return base + Math.random() * (level === 0 ? 1600 : 1100);
  }

  w.PapazBot = { pickIndex, tellIndex, line, shouldReact, thinkMs, LINES };
})(window);
