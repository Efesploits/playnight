/* =============================================================================
 *  PLAY NIGHT — UNO MASA ARAYÜZÜ
 *  Sunucu (oda kurucu) otoritedir; burada yalnızca görünüm ve girdi vardır.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, $$, el, clear } = w.U;
  const U = w.Uno;

  const T = {
    view: null,
    timerRaf: 0,
    chalRaf: 0,
    lastTop: null,
    lastRound: -1,
    lastHandKey: '',
    colorModalOpen: false,
    chalModalOpen: false,
    mounted: false,
    onAction: () => {},
    onLeave: () => {},
  };

  const SVG_SKIP = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>';
  const SVG_REV = '<svg viewBox="0 0 24 24"><path d="M7 8h9a4 4 0 0 1 0 8h-1"/><path d="M10 5L7 8l3 3"/><path d="M17 19l3-3-3-3"/></svg>';

  /* ============================================================= KART == */
  /** @param opts {small:bool, back:bool} */
  function cardNode(cardId, opts) {
    const o = opts || {};
    if (o.back) {
      const n = el('div', { class: 'uno-card back' });
      n.innerHTML = '<div class="uc-oval"></div><div class="uc-mid">PLAY<br>NIGHT</div>';
      if (o.small) { n.style.setProperty('--cw', '46px'); n.style.setProperty('--ch', '68px'); }
      return n;
    }

    const card = U.cardById(cardId);
    const isW = U.isWild(card);
    const cls = ['uno-card', isW ? 'cw' : 'c' + card.c];
    const n = el('div', { class: cls.join(' '), dataset: { cid: String(cardId) } });

    let mid = '', corner = '';
    if (card.kind === 'num') { mid = String(card.num); corner = String(card.num); }
    else if (card.kind === 'skip') { mid = SVG_SKIP; corner = SVG_SKIP; }
    else if (card.kind === 'rev') { mid = SVG_REV; corner = SVG_REV; }
    else if (card.kind === 'd2') { mid = '+2'; corner = '+2'; }
    else if (card.kind === 'wild') { mid = ''; corner = 'W'; }
    else { mid = '+4'; corner = '+4'; }

    n.innerHTML =
      '<div class="uc-oval"></div>' +
      (card.kind === 'wild' ? '<div class="uc-wheel"></div>' : '') +
      `<div class="uc-mid">${mid}</div>` +
      `<span class="uc-corner uc-tl">${corner}</span>` +
      `<span class="uc-corner uc-br">${corner}</span>`;

    if (o.small) { n.style.setProperty('--cw', '46px'); n.style.setProperty('--ch', '68px'); }
    n.title = U.cardLabel(card);
    return n;
  }

  /* ============================================================ ÜST ==== */
  function renderTop() {
    const v = T.view;
    $('#utRound').textContent = String(v.roundNo);
    $('#utTarget').textContent = String(v.rules.targetScore);
    $('#utDraw').textContent = String(v.drawCount);

    const dir = $('#utDir');
    dir.classList.toggle('rev', v.dir === -1);
    dir.querySelector('span').textContent = v.dir === 1 ? 'SAĞA' : 'SOLA';

    $('#unoRoot').dataset.color = v.activeColor === null || v.activeColor === undefined ? '' : String(v.activeColor);
  }

  function renderTimer() {
    cancelAnimationFrame(T.timerRaf);
    const box = $('#utTimer');
    const v = T.view;
    if (!v || v.finished || !v.turnEndsAt || v.phase !== 'play') { clear(box); return; }
    if (!box.firstChild) {
      box.innerHTML =
        '<svg viewBox="0 0 40 40"><circle class="tm-bg" cx="20" cy="20" r="17"></circle>' +
        '<circle class="tm-fg" cx="20" cy="20" r="17" stroke-dasharray="106.8" stroke-dashoffset="0"></circle></svg>' +
        '<div class="tm-num"></div>';
    }
    const total = (v.rules.turnSeconds || 30) * 1000;
    const fg = box.querySelector('.tm-fg'), num = box.querySelector('.tm-num');
    const tick = () => {
      if (!T.view || !T.view.turnEndsAt) return;
      const left = Math.max(0, T.view.turnEndsAt - Date.now());
      const frac = Math.max(0, Math.min(1, left / total));
      fg.style.strokeDashoffset = String(106.8 * (1 - frac));
      num.textContent = String(Math.ceil(left / 1000));
      box.classList.toggle('tm-low', frac < 0.28);
      T.timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  /* ========================================================= RAKİPLER == */
  function renderOpponents() {
    const v = T.view;
    const box = $('#unoOpps');
    clear(box);
    const n = v.players.length;

    /* kendimden sonrakiler sırayla (oyun yönünde) */
    for (let k = 1; k < n; k++) {
      const seat = (v.mySeat + k * (v.dir === -1 ? -1 : 1) + n * k) % n;
      const P = v.players[seat];
      const node = el('div', {
        class: 'uopp'
          + (v.turn === seat && !v.finished ? ' turn' : '')
          + (P.cards <= 2 ? ' danger' : '')
          + (P.connected === false ? ' disconnected' : ''),
      });

      const av = el('div', { class: 'uopp-av', style: { background: w.U.avatarStyle(P.id, P.color) }, text: w.U.initials(P.name) });
      if (P.isBot) av.appendChild(el('span', { class: 'bot-tag', text: 'BOT' }));

      node.appendChild(el('div', { class: 'uopp-head' }, [
        av,
        el('div', { class: 'uopp-meta' }, [
          el('div', { class: 'uopp-name', text: P.name }),
          el('div', { class: 'uopp-score', html: `Puan <b>${P.score}</b>` }),
        ]),
      ]));

      const cards = el('div', { class: 'uopp-cards' });
      for (let i = 0; i < Math.min(P.cards, 8); i++) cards.appendChild(el('span', { class: 'mini-back' }));
      node.appendChild(cards);
      node.appendChild(el('div', { class: 'uopp-count', text: String(P.cards) }));

      /* UNO bayrağı ya da yakalama düğmesi */
      const pending = v.unoPending && v.unoPending.seat === seat;
      if (pending) {
        node.appendChild(el('button', {
          class: 'catch-btn', text: 'YAKALA!',
          onclick: () => { w.SFX.play('warn'); T.onAction({ t: 'catchUno', target: seat }); },
        }));
      } else if (P.cards === 1 && P.saidUno) {
        node.appendChild(el('div', { class: 'uno-flag', text: 'UNO!' }));
      }

      box.appendChild(node);
    }
  }

  function renderMe() {
    const v = T.view;
    const P = v.players[v.mySeat];
    const box = $('#unoMe');
    clear(box);
    box.classList.toggle('turn', v.turn === v.mySeat && !v.finished);
    box.appendChild(el('div', { class: 'ume-av', style: { background: w.U.avatarStyle(P.id, P.color) }, text: w.U.initials(P.name) }));
    box.appendChild(el('div', {}, [
      el('div', { class: 'ume-name', text: P.name }),
      el('div', { class: 'ume-score', html: `Puan <b>${P.score}</b> · ${P.cards} kart` }),
    ]));
  }

  /* =========================================================== MERKEZ == */
  function renderCenter() {
    const v = T.view;

    /* deste */
    const draw = $('#unoDraw');
    const canDraw = v.phase === 'play' && v.turn === v.mySeat && !v.hasDrawn && !v.finished;
    draw.classList.toggle('can', canDraw);
    $('#unoDrawCount').textContent = String(v.drawCount);

    /* atık */
    const disc = $('#unoDiscard');
    if (T.lastTop !== v.topCard) {
      clear(disc);
      disc.appendChild(el('div', { class: 'color-orb', dataset: { c: String(v.activeColor === null ? '' : v.activeColor) } }));
      const c = cardNode(v.topCard);
      c.classList.add('fresh');
      disc.appendChild(c);
      T.lastTop = v.topCard;
      w.SFX.play('tile');
    } else {
      const orb = disc.querySelector('.color-orb');
      if (orb) orb.dataset.c = String(v.activeColor === null ? '' : v.activeColor);
    }

    $('#unoRing').classList.toggle('rev', v.dir === -1);
  }

  /* ============================================================== EL === */
  function renderHand() {
    const v = T.view;
    const box = $('#unoHand');
    const playable = new Set(v.playable);
    const key = v.myHand.join(',') + '|' + v.playable.join(',') + '|' + v.turn + '|' + v.phase;
    if (key === T.lastHandKey) return;
    const isNewDeal = T.lastRound !== v.roundNo;
    T.lastHandKey = key;
    T.lastRound = v.roundNo;

    clear(box);
    /* çok kart varsa daha çok bindir */
    const overlap = v.myHand.length > 14 ? -46 : v.myHand.length > 10 ? -36 : v.myHand.length > 7 ? -28 : -18;
    box.style.setProperty('--overlap', overlap + 'px');

    v.myHand.forEach((id, i) => {
      const can = playable.has(id);
      const wrap = el('div', {
        class: 'hand-card' + (can ? ' playable' : (v.turn === v.mySeat && v.phase === 'play' ? ' dim' : ''))
          + (isNewDeal ? ' dealt' : '')
          + (v.drawnCard === id ? ' drawn' : ''),
      });
      if (isNewDeal) wrap.style.animationDelay = (i * 45) + 'ms';
      const c = cardNode(id);
      if (can) c.onclick = () => tryPlay(id);
      wrap.appendChild(c);
      box.appendChild(wrap);
    });

    if (isNewDeal) for (let i = 0; i < Math.min(7, v.myHand.length); i++) w.SFX.play('deal', i);

    /* UNO düğmesi */
    const unoBtn = $('#btnUno');
    unoBtn.disabled = !v.canCallUno;
    unoBtn.classList.toggle('armed', v.canCallUno && v.myHand.length === 2 && v.turn === v.mySeat);

    /* pas düğmesi */
    const passBtn = $('#btnPass');
    passBtn.hidden = !(v.phase === 'play' && v.turn === v.mySeat && v.hasDrawn);
  }

  function tryPlay(cardId) {
    const v = T.view;
    if (!v || v.turn !== v.mySeat || v.phase !== 'play') return;
    const card = U.cardById(cardId);
    w.SFX.play('pick');

    /* Joker+4 blöfü: kural bunu engellemez ama itiraz edilirse 4 kart çekersin.
       Kazayla oynanmasın diye önce uyar. */
    if (card.kind === 'wd4' && !U.isWd4Legal(v.myHand, v.activeColor, cardId)) {
      w.UI.confirm({
        title: 'BU BİR BLÖF',
        sub: `Elinde ${U.COLOR_LABEL[v.activeColor].toLowerCase()} kart varken Joker+4 oynuyorsun. `
           + 'Kurala göre bunu yapmamalısın — rakip itiraz eder ve haklı çıkarsa 4 kart çekersin.',
        confirm: 'RİSKİ AL', cancel: 'VAZGEÇ', danger: true,
      }).then((yes) => { if (yes) openColorPicker(cardId); });
      return;
    }

    if (U.isWild(card)) { openColorPicker(cardId); return; }
    T.onAction({ t: 'play', card: cardId });
  }

  /* ------------------------------------------------------ renk seçici -- */
  function openColorPicker(cardId) {
    if (T.colorModalOpen) return;
    T.colorModalOpen = true;
    const pick = (c) => {
      T.colorModalOpen = false;
      w.UI.closeModal();
      w.SFX.play('ok');
      if (cardId === null) T.onAction({ t: 'color', color: c });
      else T.onAction({ t: 'play', card: cardId, color: c });
    };
    const grid = el('div', { class: 'color-pick' });
    U.COLOR_LABEL.forEach((label, c) => {
      grid.appendChild(el('button', { class: 'cp' + c, text: w.U.upper(label), onclick: () => pick(c) }));
    });
    w.UI.modal({
      title: 'RENK SEÇ',
      sub: cardId === null ? 'Açılan joker için bir renk belirle.' : 'Joker hangi renge dönüşsün?',
      body: grid, closable: false,
    });
  }

  /* --------------------------------------------------------- itiraz ---- */
  function openChallenge() {
    if (T.chalModalOpen) return;
    T.chalModalOpen = true;
    const v = T.view;
    const by = v.players[v.challenge.by];
    const until = v.challenge.until;
    const total = (v.rules.challengeSeconds || 8) * 1000;

    const bar = el('i');
    const box = el('div', { class: 'chal-box' }, [
      el('p', { class: 'muted small', html:
        `<b>${w.U.escapeHtml(by.name)}</b> Joker+4 oynadı. Kurala göre bunu ancak elinde masadaki renkten kart yoksa oynayabilir.<br>` +
        'İtiraz edersen eli açılır: <b>blöfse o 4 çeker</b>, <b>değilse sen 6 çekersin</b>.' }),
      el('div', { class: 'chal-bar' }, [bar]),
    ]);

    const decide = (challenge) => {
      T.chalModalOpen = false;
      cancelAnimationFrame(T.chalRaf);
      w.UI.closeModal();
      T.onAction({ t: 'challenge', challenge });
    };

    w.UI.modal({
      title: 'JOKER +4 — İTİRAZ?', body: box, closable: false,
      actions: [
        { label: '4 KART ÇEK', kind: 'btn-ghost', onClick: () => decide(false) },
        { label: 'İTİRAZ ET!', kind: 'btn-gold', onClick: () => decide(true) },
      ],
    });
    w.SFX.play('warn');

    const tick = () => {
      if (!T.chalModalOpen) return;
      const left = Math.max(0, until - Date.now());
      bar.style.width = Math.round((left / total) * 100) + '%';
      if (left <= 0) { decide(false); return; }
      T.chalRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  /* =========================================================== ÇİZİM === */
  function render(view) {
    const prev = T.view;
    T.view = view;

    renderTop();
    renderOpponents();
    renderMe();
    renderCenter();
    renderHand();
    renderTimer();

    /* yön değişimini vurgula */
    if (prev && prev.dir !== view.dir) {
      const d = $('#utDir');
      d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
      banner('YÖN DEĞİŞTİ', view.dir === 1 ? 'SAĞA' : 'SOLA');
      w.SFX.play('turn');
    }

    /* sıra bana geldi */
    if (prev && prev.turn !== view.turn && view.turn === view.mySeat && !view.finished) {
      w.SFX.play('turn');
    }

    /* joker rengi seçmem gerekiyor */
    if (view.needColor && !T.colorModalOpen) openColorPicker(null);
    if (!view.needColor && T.colorModalOpen && view.phase !== 'color') {
      T.colorModalOpen = false; w.UI.closeModal();
    }

    /* itiraz penceresi bana açıldı */
    if (view.phase === 'challenge' && view.challenge && view.challenge.target === view.mySeat) openChallenge();
    else if (T.chalModalOpen && view.phase !== 'challenge') {
      T.chalModalOpen = false; cancelAnimationFrame(T.chalRaf); w.UI.closeModal();
    }

    /* itiraz sonrası el gösterimi */
    if (view.reveal && (!prev || !prev.reveal || prev.reveal.seat !== view.reveal.seat
        || (prev.reveal.cards || []).length !== (view.reveal.cards || []).length)) {
      showReveal(view.reveal, view.players);
    }
  }

  function showReveal(reveal, players) {
    const hand = el('div', { class: 'chal-hand' });
    for (const id of reveal.cards) hand.appendChild(cardNode(id, { small: true }));
    const name = players[reveal.seat] ? players[reveal.seat].name : '?';
    w.UI.modal({
      title: 'ELİ GÖRDÜN',
      sub: `${name} oyuncusunun Joker+4'ten sonraki eli:`,
      body: hand,
      actions: [{ label: 'TAMAM', kind: 'btn-primary' }],
    });
  }

  function banner(main, sub, gold) {
    const b = $('#unoBanner');
    if (!b) return;
    b.classList.toggle('gold', !!gold);
    b.innerHTML = w.U.escapeHtml(main) + (sub ? `<span class="sub">${w.U.escapeHtml(sub)}</span>` : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  /* ============================================================ MODAL == */
  function showScores() {
    const v = T.view;
    if (!v) return;
    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>Oyuncu</th><th>Kart</th><th style="text-align:right">Puan</th></tr></thead>';
    const tb = el('tbody');
    v.players.slice().sort((a, b) => b.score - a.score).forEach((P) => {
      const tr = el('tr', { class: P.seat === v.mySeat ? 'me-row' : '' });
      tr.appendChild(el('td', { text: P.name + (P.isBot ? ' (bot)' : '') }));
      tr.appendChild(el('td', { text: String(P.cards) }));
      tr.appendChild(el('td', { class: 'num', text: String(P.score) }));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    w.UI.modal({
      title: 'PUAN TABLOSU',
      sub: `${v.roundNo}. el. ${v.rules.targetScore} puana ulaşan maçı kazanır.`,
      body: table, actions: [{ label: 'KAPAT', kind: 'btn-primary' }],
    });
  }

  function showResult(result, players, onNext, isHost) {
    const iWon = result.winnerSeat === T.view.mySeat;
    const winner = players[result.winnerSeat];

    const head = el('div', { class: 'result-head' }, [
      el('div', { class: 'result-crown', text: iWon ? '👑' : '🏁' }),
      el('div', { class: 'result-title', text: iWon ? 'ELİ SEN BİTİRDİN!' : `${winner.name} BİTİRDİ` }),
      el('div', { class: 'result-why', text: `+${result.gained} PUAN` }),
    ]);

    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>Oyuncu</th><th>Elde kalan</th><th style="text-align:right">Bu el</th><th style="text-align:right">Toplam</th></tr></thead>';
    const tb = el('tbody');
    for (const row of result.rows) {
      const P = players[row.seat];
      const tr = el('tr', { class: (row.winner ? 'win-row ' : '') + (row.seat === T.view.mySeat ? 'me-row' : '') });
      tr.appendChild(el('td', { text: P.name }));
      tr.appendChild(el('td', { text: row.winner ? '—' : `${row.cards} kart` }));
      tr.appendChild(el('td', { class: 'num', text: row.winner ? `+${result.gained}` : String(row.points) }));
      tr.appendChild(el('td', { class: 'num', text: String(P.score) }));
      tb.appendChild(tr);
    }
    table.appendChild(tb);

    w.SFX.play(iWon ? 'win' : 'lose');
    w.UI.modal({
      title: '', closable: false, wide: true,
      body: el('div', {}, [head, table]),
      actions: isHost
        ? [{ label: 'SONRAKİ EL', kind: 'btn-primary', onClick: onNext }]
        : [{ label: 'BEKLENİYOR…', kind: 'btn-ghost', close: false }],
    });
  }

  function showMatchOver(payload, mySeat) {
    const iWon = payload.winner === mySeat;
    const winner = payload.players.find((p) => p.seat === payload.winner);
    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>#</th><th>Oyuncu</th><th style="text-align:right">Puan</th><th style="text-align:right">El</th></tr></thead>';
    const tb = el('tbody');
    payload.players.slice().sort((a, b) => b.score - a.score).forEach((p, i) => {
      const tr = el('tr', { class: (i === 0 ? 'win-row ' : '') + (p.seat === mySeat ? 'me-row' : '') });
      tr.appendChild(el('td', { text: String(i + 1) }));
      tr.appendChild(el('td', { text: p.name }));
      tr.appendChild(el('td', { class: 'num', text: String(p.score) }));
      tr.appendChild(el('td', { class: 'num', text: String(p.roundsWon) }));
      tb.appendChild(tr);
    });
    table.appendChild(tb);

    w.SFX.play(iWon ? 'win' : 'lose');
    w.UI.modal({
      title: '', closable: false, wide: true,
      body: el('div', {}, [
        el('div', { class: 'result-head' }, [
          el('div', { class: 'result-crown', text: iWon ? '🏆' : '🎬' }),
          el('div', { class: 'result-title', text: iWon ? 'MAÇI KAZANDIN!' : `${winner.name} KAZANDI` }),
        ]),
        table,
      ]),
      actions: [{ label: 'LOBİYE DÖN', kind: 'btn-primary', onClick: () => T.onLeave(true) }],
    });
  }

  /* ============================================================ OLAY === */
  function playEvent(ev) {
    switch (ev.t) {
      case 'uno': banner('UNO!', ev.name, true); w.SFX.play('open'); break;
      case 'caught': banner('YAKALANDI!', `${ev.name} +${ev.penalty} kart`, true); w.SFX.play('err'); break;
      case 'challenge':
        banner(ev.bluff ? 'BLÖF YAKALANDI!' : (ev.challenged ? 'İTİRAZ BOŞA GİTTİ' : 'İTİRAZ YOK'),
          `${ev.name} +${ev.drew} kart`, ev.bluff);
        w.SFX.play(ev.bluff ? 'win' : 'warn');
        break;
      case 'reshuffle': w.UI.toast('Deste bitti, atılanlar karıştırıldı', 'info'); break;
      case 'skip': w.SFX.play('warn'); break;
      default: break;
    }
  }

  /* ========================================================== KURULUM == */
  function mount() {
    if (T.mounted) return;
    T.mounted = true;

    $('#unoLeave').onclick = () => T.onLeave(false);
    $('#unoScores').onclick = showScores;
    $('#unoRules').onclick = () => w.UnoRules.show();

    $('#unoDraw').onclick = () => {
      const v = T.view;
      if (!v || v.turn !== v.mySeat || v.phase !== 'play' || v.hasDrawn) return;
      w.SFX.play('draw');
      T.onAction({ t: 'draw' });
    };
    $('#btnUno').onclick = () => { w.SFX.play('open'); T.onAction({ t: 'uno' }); };
    $('#btnPass').onclick = () => { w.SFX.play('back'); T.onAction({ t: 'pass' }); };

    document.addEventListener('keydown', (e) => {
      if (!T.view || !document.querySelector('.view[data-view="uno"]').classList.contains('active')) return;
      if (!document.getElementById('modalHost').hidden) return;
      if (e.key === 'u' || e.key === 'U') { if (!$('#btnUno').disabled) $('#btnUno').click(); }
      else if (e.key === ' ') {
        e.preventDefault();
        const v = T.view;
        if (v.turn === v.mySeat && v.phase === 'play') { if (v.hasDrawn) $('#btnPass').click(); else $('#unoDraw').click(); }
      }
    });
  }

  function reset() {
    T.view = null; T.lastTop = null; T.lastRound = -1; T.lastHandKey = '';
    T.colorModalOpen = false; T.chalModalOpen = false;
    cancelAnimationFrame(T.timerRaf); cancelAnimationFrame(T.chalRaf);
    const h = $('#unoHand'); if (h) clear(h);
    const o = $('#unoOpps'); if (o) clear(o);
    const d = $('#unoDiscard'); if (d) clear(d);
  }

  w.UnoTable = {
    mount, render, reset, playEvent, banner, cardNode,
    showResult, showMatchOver, showScores,
    set onAction(fn) { T.onAction = fn; },
    set onLeave(fn) { T.onLeave = fn; },
  };
})(window);
