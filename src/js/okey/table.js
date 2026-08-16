/* =============================================================================
 *  PLAY NIGHT — 101 OKEY MASA ARAYÜZÜ
 *  Sunucu (host) otoritedir; bu dosya yalnızca görünüm + girdi üretir.
 *  Table.onAction(action) ile hamleleri dışarı verir.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, $$, el, clear } = w.U;
  const E = w.Okey101;

  const COLS = 16;                 // ıstakada satır başına yuva
  const ROWS = 2;

  const T = {
    view: null,                    // son gelen görünüm durumu
    ctx: null,                     // motor bağlamı (gösterge/okey)
    rack: new Array(COLS * ROWS).fill(null),
    selected: null,
    dragging: null,
    ghost: null,
    timerRaf: 0,
    lastRoundNo: -1,
    mounted: false,
    onAction: () => {},
    onLeave: () => {},
  };

  /* ======================================================== TAŞ ÇİZİMİ === */
  function tileNode(id, extraClass) {
    const t = E.tileById(id);
    const ctx = T.ctx;
    const isOkey = ctx && E.isOkey(t, ctx);
    const idn = ctx ? E.identity(t, ctx) : { c: t.c, n: t.n };
    const cls = ['tile', 'c' + idn.c];
    if (isOkey) cls.push('is-okey');
    if (t.fake) cls.push('is-fake');
    if (extraClass) cls.push(extraClass);
    return el('div', { class: cls.join(' '), dataset: { id: String(id) } }, [
      el('span', { class: 't-n', text: String(idn.n) }),
      el('span', { class: 't-d' }),
    ]);
  }

  function backNode() { return el('div', { class: 'tile back' }); }

  /* ============================================================ ISTAKA == */
  function buildRack() {
    const rows = $$('#rack .rack-row');
    rows.forEach((row, r) => {
      clear(row);
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        row.appendChild(el('div', { class: 'slot', dataset: { idx: String(idx) } }));
      }
    });
  }

  /** Eldeki taşları ıstaka yuvalarıyla eşitle (kullanıcı dizilimini korur). */
  function syncRack(hand, freshDeal) {
    const inHand = new Set(hand);

    if (freshDeal) {
      T.rack.fill(null);
      const sorted = T.ctx ? E.sortHand(hand, T.ctx, 'group') : hand.slice();
      /* ilk satır dolana kadar sırayla yerleştir */
      sorted.forEach((id, i) => { if (i < T.rack.length) T.rack[i] = id; });
      return;
    }

    /* elden çıkanları temizle */
    for (let i = 0; i < T.rack.length; i++) {
      if (T.rack[i] !== null && !inHand.has(T.rack[i])) T.rack[i] = null;
    }
    /* yeni gelenleri ilk boş yuvaya koy */
    const placed = new Set(T.rack.filter(Boolean));
    for (const id of hand) {
      if (placed.has(id)) continue;
      let idx = T.rack.indexOf(null);
      if (idx === -1) idx = T.rack.length - 1;
      T.rack[idx] = id;
      placed.add(id);
    }
  }

  function renderRack(justDrawn) {
    const slots = $$('#rack .slot');
    const groups = readGroups();
    const groupTiles = new Set();
    for (const g of groups) {
      if (g.length < 2) continue;
      const v = E.validateMeld(g, T.ctx);
      if (v.ok) for (const id of g) groupTiles.add(id);
    }

    slots.forEach((slot, i) => {
      const id = T.rack[i];
      const existing = slot.firstChild;
      const wantId = id === null ? null : String(id);
      const haveId = existing ? existing.dataset.id : null;

      if (wantId !== haveId) {
        clear(slot);
        if (id !== null) {
          const node = tileNode(id, id === justDrawn ? 'just-drawn' : null);
          slot.appendChild(node);
        }
      }
      slot.classList.toggle('grp-ok', id !== null && groupTiles.has(id));
      const tile = slot.firstChild;
      if (tile) tile.classList.toggle('sel', T.selected === id);
    });
  }

  /** Istakadaki bitişik taş öbeklerini oku (aralarında boş yuva olanlar ayrı). */
  function readGroups() {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      let cur = [];
      for (let c = 0; c < COLS; c++) {
        const id = T.rack[r * COLS + c];
        if (id === null) { if (cur.length) out.push(cur); cur = []; }
        else cur.push(id);
      }
      if (cur.length) out.push(cur);
    }
    return out;
  }

  /* --------------------------------------------------- sürükle & bırak -- */
  function slotIndexFromPoint(x, y) {
    const node = document.elementFromPoint(x, y);
    if (!node) return -1;
    const slot = node.closest ? node.closest('.slot') : null;
    return slot ? parseInt(slot.dataset.idx, 10) : -1;
  }

  function onRackPointerDown(e) {
    if (e.button !== 0) return;
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const slot = tile.closest('.slot');
    if (!slot) return;

    const id = parseInt(tile.dataset.id, 10);
    const fromIdx = parseInt(slot.dataset.idx, 10);
    const startX = e.clientX, startY = e.clientY;
    let moved = false;

    const rect = tile.getBoundingClientRect();
    const onMove = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        moved = true;
        tile.classList.add('dragging');
        T.ghost = tileNode(id, 'drag-ghost');
        T.ghost.style.width = rect.width + 'px';
        T.ghost.style.height = rect.height + 'px';
        document.body.appendChild(T.ghost);
        w.SFX.play('pick');
      }
      T.ghost.style.left = ev.clientX + 'px';
      T.ghost.style.top = ev.clientY + 'px';

      $$('#rack .slot').forEach((s) => s.classList.remove('drop-hot'));
      const overIdx = slotIndexFromPoint(ev.clientX, ev.clientY);
      if (overIdx >= 0) $$('#rack .slot')[overIdx].classList.add('drop-hot');

      const dz = document.elementFromPoint(ev.clientX, ev.clientY);
      const zone = dz && dz.closest ? dz.closest('.dz-0') : null;
      const myDz = $('.dz-0');
      if (myDz) myDz.classList.toggle('hot', !!zone && canDiscardNow());
    };

    const onUp = (ev) => {
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      $$('#rack .slot').forEach((s) => s.classList.remove('drop-hot'));
      const myDz = $('.dz-0');
      if (myDz) myDz.classList.remove('hot');
      if (T.ghost) { T.ghost.remove(); T.ghost = null; }
      tile.classList.remove('dragging');

      if (!moved) { onTileClick(id); return; }

      /* atma bölgesine bırakıldı mı? */
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (under && under.closest && under.closest('.dz-0') && canDiscardNow()) {
        tryDiscard(id);
        return;
      }
      /* masadaki bir pere bırakıldı mı? (işleme) */
      const meldEl = under && under.closest ? under.closest('.md-meld') : null;
      if (meldEl && meldEl.classList.contains('target')) {
        T.onAction({ t: 'add', mid: parseInt(meldEl.dataset.mid, 10), tile: id });
        T.selected = null;
        return;
      }

      const toIdx = slotIndexFromPoint(ev.clientX, ev.clientY);
      if (toIdx >= 0 && toIdx !== fromIdx) {
        moveTile(fromIdx, toIdx);
        w.SFX.play('tile');
      }
      renderRack();
    };

    w.addEventListener('pointermove', onMove);
    w.addEventListener('pointerup', onUp);
    e.preventDefault();
  }

  /** Taşı yuvalar arasında taşı; hedef doluysa en yakın boşluğa kaydır. */
  function moveTile(from, to) {
    const id = T.rack[from];
    if (id === null) return;
    if (T.rack[to] === null) { T.rack[from] = null; T.rack[to] = id; return; }

    /* hedef dolu: aynı satırda boşluk aç */
    T.rack[from] = null;
    const row = Math.floor(to / COLS);
    const start = row * COLS, end = start + COLS;

    let hole = -1;
    for (let i = to; i < end; i++) if (T.rack[i] === null) { hole = i; break; }
    if (hole !== -1) {
      for (let i = hole; i > to; i--) T.rack[i] = T.rack[i - 1];
      T.rack[to] = id;
      return;
    }
    for (let i = to; i >= start; i--) if (T.rack[i] === null) { hole = i; break; }
    if (hole !== -1) {
      for (let i = hole; i < to; i++) T.rack[i] = T.rack[i + 1];
      T.rack[to] = id;
      return;
    }
    /* satır tamamen dolu: global ilk boşluğa koy */
    const any = T.rack.indexOf(null);
    T.rack[any === -1 ? from : any] = id;
  }

  function onTileClick(id) {
    T.selected = T.selected === id ? null : id;
    w.SFX.play('pick');
    renderRack();
    renderMelds();
  }

  /* ============================================================ EYLEM === */
  const isMyTurn = () => T.view && T.view.turn === T.view.mySeat && !T.view.finished;
  const canDrawNow = () => isMyTurn() && T.view.phase === 'draw';
  const canDiscardNow = () => isMyTurn() && T.view.phase === 'act';

  function tryDiscard(id) {
    if (!canDiscardNow()) return;
    const t = E.tileById(id);
    const me = T.view.seats[T.view.mySeat];
    const willFinish = T.view.myHand.length === 1 && me.opened;

    const finishAndSend = () => { T.selected = null; T.onAction({ t: 'discard', tile: id, force: true }); };

    if (willFinish) { finishAndSend(); return; }

    if (E.isOkey(t, T.ctx)) {
      w.UI.confirm({
        title: 'OKEY ATIYORSUN',
        sub: 'Okey taşını atarsan +101 ceza puanı yazarsın. Devam edilsin mi?',
        confirm: 'YİNE DE AT', danger: true,
      }).then((yes) => { if (yes) finishAndSend(); });
      return;
    }
    const allMelds = [];
    for (const s of T.view.seats) for (const m of s.melds) allMelds.push(m);
    if (allMelds.length && E.isMeldableOnTable(allMelds, id, T.ctx)) {
      w.UI.confirm({
        title: 'İŞLENEBİLİR TAŞ',
        sub: 'Bu taş masadaki bir pere eklenebiliyor. Atarsan +101 ceza yazarsın.',
        confirm: 'YİNE DE AT', danger: true,
      }).then((yes) => { if (yes) finishAndSend(); });
      return;
    }
    finishAndSend();
  }

  /**
   * Istakadaki öbekleri seri/çift olarak ayrıştırır.
   * Kullanıcı seri ile açarken kenarda kalan ikili taşlar yanlışlıkla "çift"
   * sayılıp "seri ve çift karıştırılamaz" hatasına yol açmasın diye
   * iki yorum ayrı ayrı hesaplanır.
   */
  function readOpenPlan() {
    const rules = (T.view && T.view.rules) || E.DEFAULT_RULES;
    const sets = [], pairs = [];
    let setPoints = 0;
    for (const g of readGroups()) {
      if (g.length < 2) continue;
      const v = E.validateMeld(g, T.ctx);
      if (!v.ok) continue;
      if (v.type === 'pair') pairs.push(g);
      else { sets.push(g); setPoints += v.points; }
    }
    return {
      sets, pairs, setPoints,
      canSets: sets.length > 0 && setPoints >= rules.openPoints,
      canPairs: pairs.length >= rules.openPairs && sets.length === 0,
    };
  }

  function doOpen() {
    if (!canDiscardNow()) { w.UI.toast('Önce taş çekmelisin', 'warn'); return; }
    const plan = readOpenPlan();
    if (plan.canSets) { T.onAction({ t: 'open', groups: plan.sets }); return; }
    if (plan.canPairs) { T.onAction({ t: 'open', groups: plan.pairs }); return; }

    const rules = T.view.rules || E.DEFAULT_RULES;
    if (!plan.sets.length && !plan.pairs.length) {
      w.UI.toast('Istakanda geçerli per yok. Perleri yan yana diz, araya boşluk bırak.', 'warn');
    } else if (plan.sets.length) {
      w.UI.toast(`El açmak için ${rules.openPoints} puan gerekiyor — şu an ${plan.setPoints}`, 'warn');
    } else {
      w.UI.toast(`Çiftten açmak için ${rules.openPairs} çift gerekiyor — şu an ${plan.pairs.length}`, 'warn');
    }
  }

  function doLay() {
    if (!canDiscardNow()) { w.UI.toast('Önce taş çekmelisin', 'warn'); return; }
    const me = T.view.seats[T.view.mySeat];
    const groups = readGroups().filter((g) => {
      if (g.length < 2) return false;
      const v = E.validateMeld(g, T.ctx);
      if (!v.ok) return false;
      return me.openType === 'pairs' ? v.type === 'pair' : v.type !== 'pair';
    });
    if (!groups.length) { w.UI.toast('Koyulabilecek geçerli per yok', 'warn'); return; }
    T.onAction({ t: 'lay', groups });
  }

  function autoArrange() {
    if (!T.view) return;
    const me = T.view.seats[T.view.mySeat];
    const mode = me.openType === 'pairs' ? 'pairs' : 'sets';
    const sol = E.solveBest(T.view.myHand, T.ctx, mode);
    const used = new Set();
    T.rack.fill(null);

    let idx = 0;
    const place = (ids) => {
      /* per satır sonuna sığmıyorsa sonraki satıra geç */
      const row = Math.floor(idx / COLS);
      if (Math.floor((idx + ids.length - 1) / COLS) !== row) idx = (row + 1) * COLS;
      for (const id of ids) { if (idx < T.rack.length) T.rack[idx++] = id; }
      idx++; // perler arasına boşluk
    };
    for (const m of sol.melds) { place(m.tiles); m.tiles.forEach((id) => used.add(id)); }

    const rest = E.sortHand(T.view.myHand.filter((id) => !used.has(id)), T.ctx, 'run');
    for (const id of rest) {
      while (idx < T.rack.length && T.rack[idx] !== null) idx++;
      if (idx >= T.rack.length) {
        const free = T.rack.indexOf(null);
        if (free === -1) break;
        T.rack[free] = id;
      } else T.rack[idx++] = id;
    }
    w.SFX.play('meld');
    renderRack();
    updateOpenButton();
  }

  function sortRack(mode) {
    if (!T.view) return;
    const sorted = E.sortHand(T.view.myHand, T.ctx, mode);
    T.rack.fill(null);
    sorted.forEach((id, i) => { if (i < T.rack.length) T.rack[i] = id; });
    w.SFX.play('tile');
    renderRack();
    updateOpenButton();
  }

  /* =========================================================== ÇİZİM ==== */
  function render(view) {
    const fresh = !T.view || view.roundNo !== T.lastRoundNo;
    T.view = view;
    T.ctx = E.makeContext(view.indicatorId, view.rules);
    if (fresh) {
      T.lastRoundNo = view.roundNo;
      T.selected = null;
      syncRack(view.myHand, true);
      dealAnimation();
    } else {
      syncRack(view.myHand, false);
    }

    renderTop();
    renderOpponents();
    renderMe();
    renderCenter();
    renderDiscards();
    renderMelds();
    renderRack(view.justDrawn);
    updateOpenButton();
    startTimer();
  }

  function renderTop() {
    const v = T.view;
    $('#otRound').textContent = String(v.roundNo);
    $('#otPile').textContent = String(v.pileLeft);
    const ind = $('#otIndicator'); clear(ind);
    ind.appendChild(tileNode(v.indicatorId));
    ind.firstChild.style.setProperty('--tw', '30px');
    ind.firstChild.style.setProperty('--th', '42px');

    const ok = $('#otOkey'); clear(ok);
    /* okey taşının kendisi: aynı renk, bir üst sayı */
    const okId = findTileId(v.okey.c, v.okey.n);
    if (okId !== null) {
      ok.appendChild(tileNode(okId));
      ok.firstChild.classList.add('is-okey');
      ok.firstChild.style.setProperty('--tw', '30px');
      ok.firstChild.style.setProperty('--th', '42px');
    }
  }

  function findTileId(c, n) {
    for (const t of E.DECK) if (!t.fake && t.c === c && t.n === n) return t.id;
    return null;
  }

  function seatView(seat) { return (seat - T.view.mySeat + 4) % 4; }

  function renderOpponents() {
    const v = T.view;
    for (let vs = 1; vs <= 3; vs++) {
      const seat = (v.mySeat + vs) % 4;
      const S = v.seats[seat];
      const box = $(`.opp-${vs}`);
      clear(box);
      box.classList.toggle('turn', v.turn === seat && !v.finished);
      box.classList.toggle('opened', !!S.opened);
      box.classList.toggle('disconnected', S.connected === false);

      const av = el('div', { class: 'op-av', style: { background: w.U.avatarStyle(S.id, S.color) }, text: w.U.initials(S.name) });
      if (S.isBot) av.appendChild(el('span', { class: 'bot-tag', text: 'BOT' }));

      const meta = el('div', { class: 'op-meta' }, [
        el('div', { class: 'op-name', text: S.name }),
        el('div', { class: 'op-stat' }, [
          el('span', { class: 'op-score', text: String(S.score) }),
          el('span', { text: `${S.handCount} taş` }),
          S.opened ? el('span', { class: 'op-chip', text: S.openType === 'pairs' ? 'ÇİFT' : 'AÇIK' }) : null,
        ]),
      ]);

      const top = el('div', { class: 'op-top' }, [av, meta, timerRing(seat, 'op-timer')]);
      box.appendChild(top);

      const hand = el('div', { class: 'op-hand' });
      for (let i = 0; i < Math.min(S.handCount, 22); i++) hand.appendChild(el('span', { class: 'back' }));
      box.appendChild(hand);
    }
  }

  function timerRing(seat, cls) {
    const v = T.view;
    const wrap = el('div', { class: cls, dataset: { seat: String(seat) } });
    if (v.turn !== seat || v.finished || !v.turnSeconds) return wrap;
    wrap.innerHTML =
      '<svg viewBox="0 0 36 36">' +
      '<circle class="tm-bg" cx="18" cy="18" r="15"></circle>' +
      '<circle class="tm-fg" cx="18" cy="18" r="15" stroke-dasharray="94.2" stroke-dashoffset="0"></circle>' +
      '</svg><div class="tm-num"></div>';
    return wrap;
  }

  function renderMe() {
    const v = T.view;
    const S = v.seats[v.mySeat];
    const box = $('#meSeat');
    clear(box);
    box.classList.toggle('turn', v.turn === v.mySeat && !v.finished);
    box.appendChild(el('div', { class: 'ms-top' }, [
      el('div', { class: 'ms-av', style: { background: w.U.avatarStyle(S.id, S.color) }, text: w.U.initials(S.name) }),
      el('div', {}, [
        el('div', { class: 'ms-name', text: S.name }),
        el('div', { class: 'ms-score', html: `Puan <b>${S.score}</b>` }),
      ]),
    ]));
    box.appendChild(el('div', { class: 'ms-bottom' }, [
      el('div', { class: 'ms-score', text: S.opened ? (S.openType === 'pairs' ? 'Çiftten açık' : 'Açık') : 'Açmadı' }),
      timerRing(v.mySeat, 'me-timer'),
    ]));
  }

  function renderCenter() {
    const v = T.view;
    const pile = $('#drawPile');
    $('#pileCount').textContent = String(v.pileLeft);
    pile.classList.toggle('empty', v.pileLeft === 0);
    pile.classList.toggle('can-draw', canDrawNow() && v.pileLeft > 0 && !v.lastChance);

    $('#actPass').hidden = !(isMyTurn() && v.lastChance && v.phase === 'draw');
  }

  function renderDiscards() {
    const v = T.view;
    const leftSeat = (v.mySeat + 3) % 4;
    for (let seat = 0; seat < 4; seat++) {
      const vs = seatView(seat);
      const zone = $(`.dz-${vs}`);
      if (!zone) continue;
      const S = v.seats[seat];
      const inner = zone.querySelector('.dz-inner');
      /* sadece son taşı göster */
      Array.from(zone.querySelectorAll('.tile')).forEach((n) => n.remove());
      if (S.discards.length) {
        const node = tileNode(S.discards[S.discards.length - 1]);
        zone.appendChild(node);
      }
      zone.classList.toggle('takeable', seat === leftSeat && canDrawNow() && S.discards.length > 0);
      zone.classList.remove('hot');
      zone.title = seat === leftSeat ? 'Soldakinin attığı taş' : '';
    }
  }

  function renderMelds() {
    const v = T.view;
    const body = $('#meldsBody');
    clear(body);

    const me = v.seats[v.mySeat];
    const canProcess = isMyTurn() && v.phase === 'act' && me.opened && T.selected !== null;

    let any = false;
    for (let seat = 0; seat < 4; seat++) {
      const S = v.seats[seat];
      if (!S.melds.length) continue;
      any = true;
      const grp = el('div', { class: 'md-group' });
      grp.appendChild(el('div', { class: 'md-owner' }, [
        el('i', { style: { background: w.U.avatarStyle(S.id, S.color) } }),
        el('span', { text: seat === v.mySeat ? 'SEN' : w.U.upper(S.name) }),
      ]));
      for (const m of S.melds) {
        const canAdd = canProcess && E.canAddToMeld(m, T.selected, T.ctx).ok;
        const node = el('div', {
          class: 'md-meld' + (canAdd ? ' target' : ''),
          dataset: { mid: String(m.mid) },
          onclick: canAdd ? () => {
            T.onAction({ t: 'add', mid: m.mid, tile: T.selected });
            T.selected = null;
          } : null,
        });
        for (const id of m.tiles) {
          const tn = tileNode(id);
          tn.style.setProperty('--tw', '26px');
          tn.style.setProperty('--th', '36px');
          node.appendChild(tn);
        }
        grp.appendChild(node);
      }
      body.appendChild(grp);
    }
    if (!any) body.appendChild(el('div', { class: 'md-empty', text: 'Henüz kimse el açmadı' }));
  }

  function updateOpenButton() {
    if (!T.view) return;
    const v = T.view;
    const me = v.seats[v.mySeat];
    const openBtn = $('#actOpen');
    const layBtn = $('#actLay');

    if (me.opened) {
      openBtn.hidden = true;
      layBtn.hidden = false;
      layBtn.disabled = !canDiscardNow();
      return;
    }
    openBtn.hidden = false;
    layBtn.hidden = true;

    const plan = readOpenPlan();
    $('#openPts').textContent = plan.sets.length === 0 && plan.pairs.length
      ? `${plan.pairs.length} ÇİFT` : String(plan.setPoints);
    openBtn.disabled = !canDiscardNow();
    openBtn.classList.toggle('ready', plan.canSets || plan.canPairs);
  }

  /* ------------------------------------------------------------ süre --- */
  function startTimer() {
    cancelAnimationFrame(T.timerRaf);
    const v = T.view;
    if (!v || v.finished || !v.turnSeconds || !v.turnEndsAt) return;

    const tick = () => {
      if (!T.view || T.view.finished) return;
      const left = Math.max(0, T.view.turnEndsAt - Date.now());
      const secs = Math.ceil(left / 1000);
      const total = T.view.turnSeconds * 1000;
      const frac = Math.max(0, Math.min(1, left / total));

      $$('.op-timer, .me-timer').forEach((wrap) => {
        const fg = wrap.querySelector('.tm-fg');
        const num = wrap.querySelector('.tm-num');
        if (!fg) return;
        fg.style.strokeDashoffset = String(94.2 * (1 - frac));
        wrap.classList.toggle('tm-low', frac < 0.28);
        if (num) num.textContent = String(secs);
      });
      T.timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  /* ================================================== ANİMASYONLAR ===== */
  function dealAnimation() {
    /* ıstakadaki taşlar sırayla düşsün */
    requestAnimationFrame(() => {
      const tiles = $$('#rack .slot .tile');
      tiles.forEach((t, i) => {
        t.classList.add('dealt');
        t.style.animationDelay = (i * 26) + 'ms';
        setTimeout(() => { t.classList.remove('dealt'); t.style.animationDelay = ''; }, 520 + i * 26);
      });
      for (let i = 0; i < Math.min(8, tiles.length); i++) w.SFX.play('deal', i);
    });
  }

  /** Bir düğümden diğerine uçan taş kopyası. */
  function flyTile(fromEl, toEl, tileId) {
    if (!fromEl || !toEl) return;
    const layer = $('#flyLayer');
    if (!layer) return;
    const stage = $('#okeyStage').getBoundingClientRect();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();

    const node = tileId !== null && tileId !== undefined ? tileNode(tileId) : backNode();
    node.classList.add('fly-tile');
    node.style.left = (a.left - stage.left + a.width / 2 - 23) + 'px';
    node.style.top = (a.top - stage.top + a.height / 2 - 32) + 'px';
    layer.appendChild(node);

    requestAnimationFrame(() => {
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      node.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random() * 24 - 12)}deg) scale(.9)`;
      node.style.opacity = '0.25';
    });
    setTimeout(() => node.remove(), 560);
  }

  /** Sunucudan gelen olayları görsel efekte çevir. */
  function playEvent(ev) {
    if (!T.view) return;
    const v = T.view;
    const vs = seatView(ev.seat);
    const seatEl = vs === 0 ? $('#meSeat') : $(`.opp-${vs}`);

    switch (ev.t) {
      case 'draw': {
        const from = ev.from === 'pile' ? $('#drawPile') : $(`.dz-${seatView((ev.seat + 3) % 4)}`);
        if (ev.seat !== v.mySeat) flyTile(from, seatEl, ev.from === 'discard' ? ev.tile : null);
        w.SFX.play('draw');
        break;
      }
      case 'discard': {
        const to = $(`.dz-${vs}`);
        if (ev.seat !== v.mySeat) flyTile(seatEl, to, ev.tile);
        w.SFX.play('tile');
        break;
      }
      case 'open':
        w.SFX.play('open');
        banner(`${ev.name} EL AÇTI`, ev.mode === 'pairs' ? `${ev.count} ÇİFT` : `${ev.points} PUAN`);
        break;
      case 'lay':
      case 'add':
        w.SFX.play('meld');
        break;
      case 'turn':
        if (ev.seat === v.mySeat) { w.SFX.play('turn'); banner('SIRA SENDE', ''); }
        break;
      default: break;
    }
  }

  function banner(main, sub) {
    const b = $('#turnBanner');
    b.innerHTML = w.U.escapeHtml(main) + (sub ? `<span class="sub">${w.U.escapeHtml(sub)}</span>` : '');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  /* ================================================== MODALLAR ========= */
  function showScores() {
    const v = T.view;
    if (!v) return;
    const rows = v.seats.slice().sort((a, b) => a.score - b.score);
    const table = el('table', { class: 'score-table' });
    table.innerHTML =
      '<thead><tr><th>Oyuncu</th><th>Durum</th><th style="text-align:right">Puan</th></tr></thead>';
    const tb = el('tbody');
    for (const S of rows) {
      const tr = el('tr', { class: S.seat === v.mySeat ? 'me-row' : '' });
      tr.appendChild(el('td', { text: S.name + (S.isBot ? ' (bot)' : '') }));
      tr.appendChild(el('td', { text: S.opened ? (S.openType === 'pairs' ? 'Çiftten açık' : 'Açık') : 'Açmadı' }));
      tr.appendChild(el('td', { class: 'num', text: String(S.score) }));
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    const deals = (v.rules && v.rules.deals) || 11;
    w.UI.modal({
      title: 'PUAN TABLOSU',
      sub: `${v.roundNo}. el / ${deals}. En düşük puanlı oyuncu maçı kazanır.`,
      body: table,
      actions: [{ label: 'KAPAT', kind: 'btn-primary' }],
    });
  }

  function showResult(result, seats, onNext, isHost) {
    const winner = result.winnerSeat !== null && result.winnerSeat !== undefined ? seats[result.winnerSeat] : null;
    const iWon = winner && result.winnerSeat === T.view.mySeat;

    const head = el('div', { class: 'result-head' }, [
      el('div', { class: 'result-crown', text: result.noWinner ? '🁢' : (iWon ? '👑' : '🏁') }),
      el('div', { class: 'result-title', text: result.noWinner ? 'DESTE BİTTİ' : (iWon ? 'KAZANDIN!' : `${winner.name} BİTİRDİ`) }),
      result.noWinner ? null : el('div', {
        class: 'result-why',
        text: [
          result.straightOut ? 'ELDEN BİTİRME' : (result.winType === 'pairs' ? 'ÇİFTTEN BİTİRME' : 'NORMAL BİTİŞ'),
          result.discardedOkey ? 'OKEY ATARAK (x2)' : null,
        ].filter(Boolean).join(' · '),
      }),
    ]);

    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>Oyuncu</th><th>Açıklama</th><th style="text-align:right">Değişim</th><th style="text-align:right">Toplam</th></tr></thead>';
    const tb = el('tbody');
    for (const row of result.rows) {
      const S = seats[row.seat];
      const tr = el('tr', { class: (row.winner ? 'win-row ' : '') + (row.seat === T.view.mySeat ? 'me-row' : '') });
      tr.appendChild(el('td', { text: S.name }));
      tr.appendChild(el('td', { text: row.reason + (row.hand ? ` (${row.hand})` : '') }));
      tr.appendChild(el('td', { class: 'num ' + (row.delta < 0 ? 'delta-neg' : 'delta-pos'), text: (row.delta > 0 ? '+' : '') + row.delta }));
      tr.appendChild(el('td', { class: 'num', text: String(S.score) }));
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

  function showMatchOver(match, mySeat) {
    const winner = match.players[match.winner];
    const iWon = match.winner === mySeat;
    const list = el('div', {});
    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>#</th><th>Oyuncu</th><th style="text-align:right">Puan</th><th style="text-align:right">El</th></tr></thead>';
    const tb = el('tbody');
    match.players.slice().sort((a, b) => a.score - b.score).forEach((p, i) => {
      const tr = el('tr', { class: (i === 0 ? 'win-row ' : '') + (p.seat === mySeat ? 'me-row' : '') });
      tr.appendChild(el('td', { text: String(i + 1) }));
      tr.appendChild(el('td', { text: p.name }));
      tr.appendChild(el('td', { class: 'num', text: String(p.score) }));
      tr.appendChild(el('td', { class: 'num', text: String(p.roundsWon) }));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    list.appendChild(el('div', { class: 'result-head' }, [
      el('div', { class: 'result-crown', text: iWon ? '🏆' : '🎬' }),
      el('div', { class: 'result-title', text: iWon ? 'MAÇI KAZANDIN!' : `${winner.name} KAZANDI` }),
    ]));
    list.appendChild(table);

    w.SFX.play(iWon ? 'win' : 'lose');
    w.UI.modal({
      title: '', closable: false, wide: true, body: list,
      actions: [{ label: 'LOBİYE DÖN', kind: 'btn-primary', onClick: () => T.onLeave(true) }],
    });
  }

  /* ================================================== KURULUM ========== */
  function mount() {
    if (T.mounted) return;
    T.mounted = true;
    buildRack();

    $('#rack').addEventListener('pointerdown', onRackPointerDown);
    $('#rack').addEventListener('dblclick', (e) => {
      const tile = e.target.closest('.tile');
      if (tile && canDiscardNow()) tryDiscard(parseInt(tile.dataset.id, 10));
    });

    $('#drawPile').addEventListener('click', () => {
      if (canDrawNow() && T.view.pileLeft > 0 && !T.view.lastChance) T.onAction({ t: 'drawPile' });
      else if (T.view && T.view.lastChance) w.UI.toast('Deste bitti, yerdeki taşı alabilirsin', 'warn');
    });

    for (let vs = 0; vs < 4; vs++) {
      const zone = $(`.dz-${vs}`);
      if (!zone) continue;
      zone.addEventListener('click', () => {
        if (!T.view) return;
        const leftVs = seatView((T.view.mySeat + 3) % 4);
        if (vs === leftVs && canDrawNow()) T.onAction({ t: 'drawDiscard' });
      });
    }

    $('#actSortColor').onclick = () => sortRack('run');
    $('#actSortNum').onclick = () => sortRack('group');
    $('#actAuto').onclick = autoArrange;
    $('#actOpen').onclick = doOpen;
    $('#actLay').onclick = doLay;
    $('#actPass').onclick = () => T.onAction({ t: 'pass' });
    $('#okeyScores').onclick = showScores;
    $('#okeyRules').onclick = () => w.Rules.show();
    $('#okeyLeave').onclick = () => T.onLeave(false);

    document.addEventListener('keydown', (e) => {
      if (!T.view || document.querySelector('#modalHost:not([hidden])')) return;
      const inGame = document.querySelector('.view[data-view="okey"]').classList.contains('active');
      if (!inGame) return;
      if (e.key === 's' || e.key === 'S') sortRack('group');
      else if (e.key === 'd' || e.key === 'D') sortRack('run');
      else if (e.key === 'a' || e.key === 'A') autoArrange();
      else if (e.key === 'Enter' && !$('#actOpen').disabled && !$('#actOpen').hidden) doOpen();
      else if (e.key === ' ' && canDrawNow() && T.view.pileLeft > 0) { e.preventDefault(); T.onAction({ t: 'drawPile' }); }
    });
  }

  function reset() {
    T.view = null; T.lastRoundNo = -1; T.selected = null;
    T.rack.fill(null);
    cancelAnimationFrame(T.timerRaf);
  }

  w.OkeyTable = {
    mount, render, reset, playEvent, banner,
    showResult, showMatchOver, showScores,
    set onAction(fn) { T.onAction = fn; },
    set onLeave(fn) { T.onLeave = fn; },
  };
})(window);
