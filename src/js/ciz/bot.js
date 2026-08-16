/* =============================================================================
 *  PLAY NIGHT — ÇİZ BABACIM BOTLARI
 *  Botlar karalar ve saçmalar. Amaç kazanmak değil, masayı doldurmak.
 * ========================================================================== */
(function (w) {
  'use strict';

  const SUBJECTS = [
    'kaykay süren kedi', 'gitar çalan ahtapot', 'uzayda çay demleyen dede',
    'kravat takmış penguen', 'buzdolabında saklanan ejderha', 'balık tutan robot',
    'paten kayan fil', 'şemsiyeli kirpi', 'dans eden tost makinesi',
    'bisiklete binen zürafa', 'gözlüklü kurbağa', 'pizza yiyen astronot',
    'şapkalı timsah', 'uyuyan yanardağ', 'koşan buzdolabı',
    'kar küresindeki köpek', 'denizaltıda kahvaltı', 'çamaşır asan hayalet',
    'futbol oynayan kaplumbağa', 'saksafon çalan ayı', 'tırmanan tavuk',
    'sörf yapan koyun', 'çay içen dinozor', 'trafik ışığında bekleyen kedi',
    'balonla uçan inek', 'kitap okuyan baykuş', 'kaykaycı büyükanne',
    'ütü yapan maymun', 'yüzen bilgisayar', 'şarkı söyleyen havuç',
  ];

  const GUESS_PREFIX = [
    'galiba', 'kesin', 'bence', 'sanırım', 'muhtemelen', 'valla',
  ];
  const GUESS_THING = [
    'bir kedi', 'patates', 'uzay gemisi', 'ağaç', 'köpek', 'şapka',
    'peynir', 'bulut', 'ayakkabı', 'balık', 'ev', 'araba', 'çiçek',
    'kuş', 'kurbağa', 'pasta', 'şemsiye', 'bisiklet', 'çorap', 'dondurma',
  ];
  const GUESS_TAIL = [
    '', '', '', ' ama emin değilim', ' herhalde', ' olabilir', ' galiba',
  ];

  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

  /** Bot bir cümle üretir. round 0 ise serbest, değilse "tahmin" gibi durur. */
  function text(seed, isSeed) {
    const rnd = w.Okey101.mulberry32(seed >>> 0);
    if (isSeed) return pick(SUBJECTS, rnd);
    return `${pick(GUESS_PREFIX, rnd)} ${pick(GUESS_THING, rnd)}${pick(GUESS_TAIL, rnd)}`;
  }

  /** Bot bir karalama üretir. */
  function drawing(seed) { return w.CizDraw.scribble(seed); }

  /** Botun "düşünme" süresi — insanlar yetişebilsin diye biraz oyalanır. */
  function thinkMs(type) {
    return type === 'draw' ? 5000 + Math.random() * 9000 : 2500 + Math.random() * 5000;
  }

  w.CizBot = { text, drawing, thinkMs, SUBJECTS };
})(window);
