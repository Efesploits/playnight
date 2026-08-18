/* =============================================================================
 *  PLAY NIGHT — SATRANÇ MASA ARAYÜZÜ
 *  Host otoritedir; burada yalnızca görünüm ve girdi vardır.
 *
 *  - Tıkla ya da sürükle: hamle
 *  - 2v2'de FİKİR VER: bir kareye bas, oraya gidebilecek taşlarından birini seç;
 *    takım arkadaşın oku görür ve tek tıkla oynayabilir. Rakip HİÇBİR ŞEY görmez.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, el, clear } = w.U;
  const S = w.Satranc;

  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const REASON_TR = {
    'mat': 'ŞAH MAT', 'pat': 'PAT — BERABERE', 'süre': 'SÜRE DOLDU',
    'süre + yetersiz materyal': 'SÜRE DOLDU — BERABERE', 'terk': 'TESLİM OLDU',
    'anlaşma': 'ANLAŞMALI BERABERE', '50 hamle': '50 HAMLE KURALI',
    'üç tekrar': 'ÜÇ TEKRAR', 'yetersiz materyal': 'YETERSİZ MATERYAL',
  };

  const T = {
    view: null,
    sel: null,            // seçili kare (0..63)
    byFrom: new Map(),    // yasal hamleler: from -> [{to, promo}]
    suggestMode: false,
    promoOpen: false,
    clockRaf: 0,
    lastSan: 0,           // animasyon: kaç hamle işlendi
    warned: false,        // düşük süre uyarısı bir kez
    drag: null,
    mounted: false,
    onAction: () => {},
    onLeave: () => {},
  };

  const flipped = () => T.view && T.view.mySide === 'b';

  /* tahta indeksi <-> ekran hücresi */
  function visOf(i) {
    const f = i & 7, r = i >> 3;
    return { x: flipped() ? 7 - f : f, y: flipped() ? r : 7 - r };
  }
  function idxAt(x, y) {
    const f = flipped() ? 7 - x : x;
    const r = flipped() ? y : 7 - y;
    return r * 8 + f;
  }

  /* ============================================================ TAHTA === */
  function buildBoard() {
    const board = $('#satBoard');
    clear(board);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = idxAt(x, y);
        const sq = el('div', {
          class: 'sq ' + (((x + y) & 1) ? 'dark' : 'light'),
          dataset: { i: String(i) },
        });
        sq.addEventListener('pointerdown', (e) => onSquareDown(i, e));
        board.appendChild(sq);
      }
    }
    /* koordinatlar */
    const files = $('#satFiles'), ranks = $('#satRanks');
    clear(files); clear(ranks);
    for (let x = 0; x < 8; x++) files.appendChild(el('span', { text: 'abcdefgh'[flipped() ? 7 - x : x] }));
    for (let y = 0; y < 8; y++) ranks.appendChild(el('span', { text: String(flipped() ? y + 1 : 8 - y) }));
  }

  const sqNode = (i) => $('#satBoard').querySelector(`.sq[data-i="${i}"]`);

  function renderBoard(animMove) {
    const v = T.view;
    const legalTargets = T.sel !== null && T.byFrom.has(T.sel)
      ? new Set(T.byFrom.get(T.sel).map((m) => m.to)) : new Set();

    for (let i = 0; i < 64; i++) {
      const node = sqNode(i);
      if (!node) continue;
      clear(node);
      node.classList.toggle('sel', T.sel === i);
      node.classList.toggle('last', !!v.lastMove && (v.lastMove.from === i || v.lastMove.to === i));
      node.classList.toggle('check', v.check === i);
      node.classList.toggle('can', legalTargets.has(i));

      const pc = v.board[i];
      if (pc) {
        const piece = el('span', {
          class: 'pc ' + (pc > 0 ? 'pw' : 'pb'),
          text: GLYPH[Math.abs(pc)],
        });
        node.appendChild(piece);
      }
      if (legalTargets.has(i)) {
        node.appendChild(el('i', { class: v.board[i] ? 'cap-ring' : 'dot' }));
      }
    }

    /* hamle animasyonu: taş eski karesinden süzülür */
    if (animMove) {
      const toN = sqNode(animMove.to), fromN = sqNode(animMove.from);
      const pieceN = toN && toN.querySelector('.pc');
      if (pieceN && fromN) {
        const a = fromN.getBoundingClientRect(), b = toN.getBoundingClientRect();
        pieceN.style.transition = 'none';
        pieceN.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        requestAnimationFrame(() => {
          pieceN.style.transition = 'transform .26s var(--ease-out)';
          pieceN.style.transform = 'none';
        });
        toN.classList.remove('landed'); void toN.offsetWidth; toN.classList.add('landed');
      }
    }
    renderArrows();
  }

  /* ---------------------------------------------------------- oklar ---- */
  function renderArrows() {
    const svg = $('#satArrows');
    clear(svg);
    const v = T.view;
    if (!v || v.mode !== '2v2' || v.finished) return;
    for (const sg of v.suggests) {
      const mine = sg.seat === v.mySeat;
      const f = visOf(sg.from), t = visOf(sg.to);
      const x1 = f.x + 0.5, y1 = f.y + 0.5, x2 = t.x + 0.5, y2 = t.y + 0.5;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const ex = x2 - ux * 0.34, ey = y2 - uy * 0.34;   // ok başına yer bırak
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'sarrow ' + (mine ? 'mine' : 'mate'));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      g.appendChild(line);
      const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const px = -uy, py = ux;
      head.setAttribute('points',
        `${x2 - ux * 0.04},${y2 - uy * 0.04} `
        + `${ex + px * 0.17},${ey + py * 0.17} `
        + `${ex - px * 0.17},${ey - py * 0.17}`);
      g.appendChild(head);
      svg.appendChild(g);
    }
  }

  /* ========================================================== GİRDİ ==== */
  function onSquareDown(i, e) {
    const v = T.view;
    if (!v || v.finished) return;

    if (T.suggestMode) { openSuggestPicker(i); return; }

    const pc = v.board[i];
    const myPiece = pc && ((pc > 0 ? 'w' : 'b') === v.mySide);

    /* hedefe tıkla: seçiliyken yasal kareye hamle */
    if (T.sel !== null && T.byFrom.has(T.sel)) {
      const moves = T.byFrom.get(T.sel).filter((m) => m.to === i);
      if (moves.length) { commitMove(T.sel, i, moves); return; }
    }

    if (myPiece && v.myTurn && T.byFrom.has(i)) {
      T.sel = i;
      w.SFX.play('pick');
      renderBoard();
      startDrag(i, e);
    } else if (T.sel !== null) {
      T.sel = null;
      renderBoard();
    }
  }

  function commitMove(from, to, moves) {
    T.sel = null;
    if (moves.some((m) => m.promo)) { openPromoPicker(from, to); return; }
    T.onAction({ t: 'move', from, to });
    renderBoard();
  }

  /* ------------------------------------------------------- sürükleme --- */
  function startDrag(from, e) {
    const board = $('#satBoard');
    const src = sqNode(from);
    const pieceN = src && src.querySelector('.pc');
    if (!pieceN) return;

    let ghost = null;
    const start = { x: e.clientX, y: e.clientY };

    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
        ghost = pieceN.cloneNode(true);
        ghost.className += ' drag-ghost';
        document.body.appendChild(ghost);
        pieceN.classList.add('dragging');
      }
      if (ghost) {
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
        const t = targetSquare(board, ev);
        board.querySelectorAll('.sq.hover').forEach((n) => n.classList.remove('hover'));
        if (t !== null) { const n = sqNode(t); if (n) n.classList.add('hover'); }
      }
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      board.querySelectorAll('.sq.hover').forEach((n) => n.classList.remove('hover'));
      pieceN.classList.remove('dragging');
      if (!ghost) return;              // sürüklenmedi: tık davranışı sürsün
      ghost.remove();
      const to = targetSquare(board, ev);
      if (to !== null && to !== from && T.byFrom.has(from)) {
        const moves = T.byFrom.get(from).filter((m) => m.to === to);
        if (moves.length) { commitMove(from, to, moves); return; }
      }
      renderBoard();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  function targetSquare(board, ev) {
    const r = board.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) / r.width) * 8);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return idxAt(x, y);
  }

  /* ---------------------------------------------------------- terfi ---- */
  function openPromoPicker(from, to) {
    if (T.promoOpen) return;
    T.promoOpen = true;
    const grid = el('div', { class: 'promo-pick' });
    for (const pr of [S.Q, S.R, S.B, S.N]) {
      grid.appendChild(el('button', {
        class: 'promo-btn ' + (T.view.mySide === 'w' ? 'pw' : 'pb'),
        text: GLYPH[pr],
        title: S.PIECE_NAME[pr],
        onclick: () => {
          T.promoOpen = false;
          w.UI.closeModal();
          w.SFX.play('ok');
          T.onAction({ t: 'move', from, to, promo: pr });
        },
      }));
    }
    w.UI.modal({ title: 'TERFİ', sub: 'Piyonun hangi taşa dönüşsün?', body: grid, closable: false });
  }

  /* ------------------------------------------------------- fikir ver --- */
  function setSuggestMode(on) {
    T.suggestMode = on;
    T.sel = null;
    $('#satRoot').classList.toggle('suggesting', on);
    const btn = $('#satSuggestBtn');
    if (btn) btn.classList.toggle('on', on);
    renderBoard();
  }

  function openSuggestPicker(target) {
    const v = T.view;
    const cands = S.candidatesTo(v, target);
    if (!cands.length) {
      w.UI.toast(`${S.alg(target)} karesine gidebilecek taşın yok`, 'warn');
      return;
    }
    const grid = el('div', { class: 'promo-pick' });
    for (const c of cands) {
      grid.appendChild(el('button', {
        class: 'promo-btn ' + (v.mySide === 'w' ? 'pw' : 'pb'),
        html: `${GLYPH[c.piece]}<small>${S.alg(c.from)}</small>`,
        title: `${S.PIECE_NAME[c.piece]} ${S.alg(c.from)} → ${S.alg(target)}`,
        onclick: () => {
          w.UI.closeModal();
          w.SFX.play('chat');
          T.onAction({ t: 'suggest', from: c.from, to: target });
          setSuggestMode(false);
        },
      }));
    }
    w.UI.modal({
      title: 'FİKİR VER',
      sub: `${S.alg(target)} karesine hangi taşı koyalım? Bunu yalnızca takımın görür.`,
      body: grid,
      actions: [{ label: 'VAZGEÇ', kind: 'btn-ghost' }],
    });
  }

  /* ========================================================= PANELLER == */
  function sideSeats(v, side) {
    return v.players.filter((p) => p.side === side);
  }

  function renderClocks() {
    const v = T.view;
    const mySide = v.mySide;
    const oppSide = mySide === 'w' ? 'b' : 'w';
    paintClock($('#clockTop'), oppSide);
    paintClock($('#clockBottom'), mySide);
    tickClocks();
  }

  function paintClock(box, side) {
    const v = T.view;
    clear(box);
    box.dataset.side = side;
    const players = sideSeats(v, side);
    const chips = el('div', { class: 'sc-players' });
    for (const p of players) {
      const chip = el('div', { class: 'sc-chip' + (p.connected === false ? ' off' : '') }, [
        el('span', { class: 'sc-av', style: { background: w.U.avatarStyle(p.id, p.color) }, text: w.U.initials(p.name) }),
        el('span', { class: 'sc-name', text: p.name }),
      ]);
      if (p.isBot) chip.appendChild(el('i', { class: 'bot-tag', text: 'BOT' }));
      if (p.seat === v.mySeat) chip.appendChild(el('i', { class: 'chip', text: 'SEN' }));
      chips.appendChild(chip);
    }
    box.appendChild(chips);
    box.appendChild(el('div', {
      class: 'sc-time',
      dataset: { side },
      text: v.clocks[side] === null ? '∞' : fmtClock(v.clocks[side]),
    }));
    box.classList.toggle('active', v.turn === side && !v.finished);
  }

  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function tickClocks() {
    cancelAnimationFrame(T.clockRaf);
    const step = () => {
      const v = T.view;
      if (!v) return;
      for (const side of ['w', 'b']) {
        const node = document.querySelector(`.sc-time[data-side="${side}"]`);
        if (!node || v.clocks[side] === null) continue;
        let left = v.clocks[side];
        if (v.turn === side && !v.finished) left -= Date.now() - v.lastMoveAt;
        node.textContent = fmtClock(left);
        node.classList.toggle('low', left < 30000);
        if (side === v.mySide && v.turn === side && !v.finished && left < 15000 && !T.warned) {
          T.warned = true;
          w.SFX.play('warn');
        }
      }
      if (!v.finished) T.clockRaf = requestAnimationFrame(step);
    };
    step();
  }

  function renderMoves() {
    const v = T.view;
    const box = $('#satMoves');
    clear(box);
    for (let i = 0; i < v.sanHistory.length; i += 2) {
      const row = el('div', { class: 'mv-row' }, [
        el('span', { class: 'mv-no', text: (i / 2 + 1) + '.' }),
        el('span', { class: 'mv' + (i === v.sanHistory.length - 1 ? ' fresh' : ''), text: v.sanHistory[i] }),
        el('span', { class: 'mv' + (i + 1 === v.sanHistory.length - 1 ? ' fresh' : ''), text: v.sanHistory[i + 1] || '' }),
      ]);
      box.appendChild(row);
    }
    box.scrollTop = box.scrollHeight;
  }

  function renderCaptured() {
    const v = T.view;
    const val = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
    const sum = (a) => a.reduce((s, t) => s + (val[t] || 0), 0);
    const mySide = v.mySide, oppSide = mySide === 'w' ? 'b' : 'w';
    const diff = sum(v.captured[mySide]) - sum(v.captured[oppSide]);
    paintCaptured($('#captTop'), v.captured[oppSide], oppSide, diff < 0 ? -diff : 0);
    paintCaptured($('#captBottom'), v.captured[mySide], mySide, diff > 0 ? diff : 0);
  }

  function paintCaptured(box, list, side, plus) {
    clear(box);
    const sorted = list.slice().sort((a, b) => b - a);
    for (const t of sorted) {
      box.appendChild(el('span', { class: 'cap-pc ' + (side === 'w' ? 'pb' : 'pw'), text: GLYPH[t] }));
    }
    if (plus) box.appendChild(el('b', { class: 'cap-plus', text: '+' + plus }));
  }

  /* ------------------------------------------------ fikir/teklif kartı - */
  function renderCards() {
    const v = T.view;
    const box = $('#satSuggest');
    clear(box);
    box.hidden = true;

    /* beraberlik teklifi (rakipten) */
    if (v.drawOffer && v.drawOffer.team !== v.myTeam && !v.finished) {
      box.hidden = false;
      box.appendChild(el('div', { class: 'sg-card offer' }, [
        el('div', { class: 'sg-txt', html: '<b>Rakip beraberlik teklif ediyor.</b>' }),
        el('div', { class: 'sg-acts' }, [
          el('button', { class: 'btn btn-primary btn-sm', text: 'KABUL', onclick: () => T.onAction({ t: 'draw', accept: true }) }),
          el('button', { class: 'btn btn-ghost btn-sm', text: 'RED', onclick: () => T.onAction({ t: 'draw', accept: false }) }),
        ]),
      ]));
    } else if (v.drawOffer && v.drawOffer.team === v.myTeam && !v.finished) {
      box.hidden = false;
      box.appendChild(el('div', { class: 'sg-card' }, [
        el('div', { class: 'sg-txt muted', text: 'Beraberlik teklifin iletildi…' }),
      ]));
    }

    if (v.mode !== '2v2' || v.finished) return;

    /* takım arkadaşının fikri */
    for (const sg of v.suggests) {
      if (sg.seat === v.mySeat) continue;
      const mate = v.players[sg.seat];
      const pc = v.board[sg.from];
      const glyph = pc ? GLYPH[Math.abs(pc)] : '?';
      const canPlay = v.myTurn && T.byFrom.has(sg.from)
        && T.byFrom.get(sg.from).some((m) => m.to === sg.to);
      box.hidden = false;
      const card = el('div', { class: 'sg-card mate' }, [
        el('div', { class: 'sg-txt', html:
          `<b>${w.U.escapeHtml(mate ? mate.name : '?')}</b> şunu öneriyor: `
          + `<span class="sg-pc">${glyph}</span> ${S.alg(sg.from)} → <b>${S.alg(sg.to)}</b>` }),
      ]);
      if (canPlay) {
        const moves = T.byFrom.get(sg.from).filter((m) => m.to === sg.to);
        card.appendChild(el('div', { class: 'sg-acts' }, [
          el('button', { class: 'btn btn-gold btn-sm', text: 'OYNA', onclick: () => commitMove(sg.from, sg.to, moves) }),
        ]));
      }
      box.appendChild(card);
    }

    /* kendi fikrim */
    const mine = v.suggests.find((sg) => sg.seat === v.mySeat);
    if (mine) {
      const pc = v.board[mine.from];
      box.hidden = false;
      box.appendChild(el('div', { class: 'sg-card' }, [
        el('div', { class: 'sg-txt', html:
          `Fikrin: <span class="sg-pc">${pc ? GLYPH[Math.abs(pc)] : '?'}</span> `
          + `${S.alg(mine.from)} → <b>${S.alg(mine.to)}</b>` }),
        el('div', { class: 'sg-acts' }, [
          el('button', { class: 'btn btn-ghost btn-sm', text: 'GERİ AL', onclick: () => T.onAction({ t: 'unsuggest' }) }),
        ]),
      ]));
    }
  }

  function renderTop() {
    const v = T.view;
    $('#stRound').textContent = `${v.roundNo} / ${v.rounds}`;
    const t0 = v.score[0], t1 = v.score[1];
    const fmtHalf = (x) => (x % 1 === 0 ? String(x) : (x === 0.5 ? '½' : Math.floor(x) + '½'));
    /* skoru "benim takım - rakip" olarak göster */
    const meFirst = v.myTeam === 0 ? [t0, t1] : [t1, t0];
    $('#stScore').textContent = `${fmtHalf(meFirst[0])} - ${fmtHalf(meFirst[1])}`;
    $('#stMode').textContent = v.mode === '2v2' ? '2v2 DANIŞMA' : '1v1';

    const sbtn = $('#satSuggestBtn');
    sbtn.hidden = v.mode !== '2v2' || v.finished;
    const dbtn = $('#satDrawBtn');
    dbtn.disabled = !!v.drawOffer || v.finished;
    $('#satResignBtn').disabled = v.finished;
  }

  /* =========================================================== ÇİZİM === */
  function render(view) {
    const prev = T.view;
    T.view = view;

    /* yasal hamle haritası */
    T.byFrom = new Map();
    for (const m of view.legal) {
      if (!T.byFrom.has(m.from)) T.byFrom.set(m.from, []);
      T.byFrom.get(m.from).push(m);
    }
    if (T.sel !== null && !T.byFrom.has(T.sel)) T.sel = null;

    /* yeni el ya da taraf değişimi: tahtayı yeniden kur */
    const needRebuild = !prev || prev.roundNo !== view.roundNo
      || prev.mySide !== view.mySide || !$('#satBoard').firstChild;
    if (needRebuild) { T.sel = null; T.lastSan = 0; T.warned = false; buildBoard(); }

    const newMove = view.sanHistory.length > T.lastSan && view.lastMove ? view.lastMove : null;
    T.lastSan = view.sanHistory.length;

    renderBoard(newMove && !needRebuild ? newMove : null);
    renderTop();
    renderClocks();
    renderMoves();
    renderCaptured();
    renderCards();

    /* sıra bana geldi */
    if (prev && !prev.myTurn && view.myTurn && !view.finished) w.SFX.play('turn');
  }

  /* ============================================================ OLAY === */
  function playEvent(ev) {
    switch (ev.t) {
      case 'move':
        w.SFX.play(ev.capt ? 'meld' : 'tile');
        if (ev.mate) { banner('ŞAH MAT', ev.san, true); w.SFX.play('win'); }
        else if (ev.check) { banner('ŞAH!', ev.san); w.SFX.play('warn'); }
        break;
      case 'suggest':
        w.SFX.play('chat');
        break;
      case 'end': {
        const label = REASON_TR[ev.reason] || ev.reason;
        banner(label, ev.winnerName ? ev.winnerName + ' kazandı' : 'BERABERE', !!ev.winnerName);
        break;
      }
      default: break;
    }
  }

  function banner(main, sub, gold) {
    const b = $('#satBanner');
    if (!b) return;
    b.classList.toggle('gold', !!gold);
    b.innerHTML = w.U.escapeHtml(main) + (sub ? `<span class="sub">${w.U.escapeHtml(sub)}</span>` : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  /* ========================================================= SONUÇLAR == */
  function teamLabel(players, team) {
    return players.filter((p) => p.team === team).map((p) => p.name).join(' & ');
  }

  function showResult(result, players, onNext, isHost) {
    const v = T.view;
    const myTeam = v ? v.myTeam : 0;
    const iWon = result.winnerTeam === myTeam;
    const draw = result.winnerTeam === null || result.winnerTeam === undefined;
    const reason = REASON_TR[result.reason] || result.reason;

    const head = el('div', { class: 'result-head' }, [
      el('div', { class: 'result-crown', text: draw ? '🤝' : iWon ? '👑' : '🏁' }),
      el('div', { class: 'result-title', text: draw ? 'BERABERE'
        : iWon ? 'OYUNU KAZANDIN!' : `${teamLabel(players, result.winnerTeam)} KAZANDI` }),
      el('div', { class: 'result-why', text: reason + (result.sanCount ? ` · ${Math.ceil(result.sanCount / 2)} hamle` : '') }),
    ]);

    w.SFX.play(draw ? 'ok' : iWon ? 'win' : 'lose');
    w.UI.modal({
      title: '', closable: false, wide: true,
      body: el('div', {}, [head]),
      actions: isHost
        ? [{ label: 'SONRAKİ OYUN', kind: 'btn-primary', onClick: onNext }]
        : [{ label: 'BEKLENİYOR…', kind: 'btn-ghost', close: false }],
    });
  }

  function showMatchOver(payload, mySeat) {
    const me = payload.players.find((p) => p.seat === mySeat);
    const myTeam = me ? me.team : 0;
    const draw = payload.winner === null || payload.winner === undefined;
    const iWon = !draw && payload.winner === myTeam;

    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>Takım</th><th style="text-align:right">Puan</th></tr></thead>';
    const tb = el('tbody');
    [0, 1].forEach((team) => {
      const winRow = !draw && payload.winner === team;
      const tr = el('tr', { class: (winRow ? 'win-row ' : '') + (team === myTeam ? 'me-row' : '') });
      tr.appendChild(el('td', { text: teamLabel(payload.players, team) }));
      tr.appendChild(el('td', { class: 'num', text: String(payload.score[team]).replace('.5', '½') }));
      tb.appendChild(tr);
    });
    table.appendChild(tb);

    w.SFX.play(draw ? 'ok' : iWon ? 'win' : 'lose');
    w.UI.modal({
      title: '', closable: false, wide: true,
      body: el('div', {}, [
        el('div', { class: 'result-head' }, [
          el('div', { class: 'result-crown', text: draw ? '🤝' : iWon ? '🏆' : '🎬' }),
          el('div', { class: 'result-title', text: draw ? 'MAÇ BERABERE'
            : iWon ? 'MAÇI KAZANDIN!' : `${teamLabel(payload.players, payload.winner)} KAZANDI` }),
        ]),
        table,
      ]),
      actions: [{ label: 'LOBİYE DÖN', kind: 'btn-primary', onClick: () => T.onLeave(true) }],
    });
  }

  /* ========================================================== KURULUM == */
  function mount() {
    if (T.mounted) return;
    T.mounted = true;

    $('#satLeave').onclick = () => T.onLeave(false);
    $('#satRules').onclick = () => w.SatrancRules.show();
    $('#satSuggestBtn').onclick = () => { w.SFX.play('click'); setSuggestMode(!T.suggestMode); };

    $('#satDrawBtn').onclick = async () => {
      const yes = await w.UI.confirm({
        title: 'BERABERLİK TEKLİF ET', sub: 'Rakibe yarım puanlık anlaşma öner.',
        confirm: 'TEKLİF ET',
      });
      if (yes) T.onAction({ t: 'draw', offer: true });
    };
    $('#satResignBtn').onclick = async () => {
      const yes = await w.UI.confirm({
        title: 'TESLİM OL', sub: T.view && T.view.mode === '2v2'
          ? 'Takımın adına teslim olacaksın. Emin misin?' : 'Bu oyunu kaybetmiş sayılacaksın.',
        confirm: 'TESLİM OL', danger: true,
      });
      if (yes) T.onAction({ t: 'resign' });
    };

    document.addEventListener('keydown', (e) => {
      if (!T.view || !document.querySelector('.view[data-view="satranc"]').classList.contains('active')) return;
      if (!document.getElementById('modalHost').hidden) return;
      if (e.key === 'Escape') { T.sel = null; setSuggestMode(false); }
      else if ((e.key === 'f' || e.key === 'F') && T.view.mode === '2v2') setSuggestMode(!T.suggestMode);
    });
  }

  function reset() {
    T.view = null; T.sel = null; T.byFrom = new Map();
    T.suggestMode = false; T.promoOpen = false; T.lastSan = 0; T.warned = false;
    cancelAnimationFrame(T.clockRaf);
    const b = $('#satBoard'); if (b) clear(b);
    const m = $('#satMoves'); if (m) clear(m);
  }

  w.SatrancTable = {
    mount, render, reset, playEvent, banner,
    showResult, showMatchOver,
    set onAction(fn) { T.onAction = fn; },
    set onLeave(fn) { T.onLeave = fn; },
  };
})(window);
