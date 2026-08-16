/* =============================================================================
 *  PLAY NIGHT — PAPAZ KAÇTI MASASI
 *  Ekran değil masa hissi: yelpaze eller, kartı yavaşça çekip çevirme,
 *  papaz sürprizi, botların tepki balonları.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, $$, el, clear } = w.U;
  const P = w.Papaz;

  const T = {
    view: null,
    prev: null,
    timerRaf: 0,
    labelRaf: 0,
    picking: false,        // kart seçme animasyonu sürüyor
    lastDrawKey: '',
    lastRound: -1,
    bubbles: new Map(),    // seat -> {node, timeout}
    labels: new Map(),     // seat -> node
    scene: null,           // 3B sahne (yoksa null)
    seatKey: '',
    mounted: false,
    onAction: () => {},
    onLeave: () => {},
  };

  /* ============================================================ KART === */
  function cardNode(cardId, opts) {
    const o = opts || {};
    if (cardId === null || cardId === undefined || o.back) {
      return el('div', { class: 'pcard back' });
    }
    const c = P.cardById(cardId);
    const red = c.s === 1 || c.s === 2;
    const sym = P.SUIT_SYM[c.s];
    const rank = P.RANK_LABEL[c.r] || String(c.r);
    const isFace = c.r >= 11 || c.r === 1;

    const cls = ['pcard'];
    if (red) cls.push('red');
    if (isFace) cls.push('face');
    if (P.isPapaz(cardId)) cls.push('papaz');

    const n = el('div', { class: cls.join(' '), dataset: { id: String(cardId) } });
    const mid = P.isPapaz(cardId) ? '♚' : (isFace ? rank : sym);
    n.innerHTML =
      `<span class="pc-tl">${rank}<i>${sym}</i></span>` +
      `<span class="pc-mid">${mid}</span>` +
      `<span class="pc-br">${rank}<i>${sym}</i></span>`;
    n.title = P.cardLabel(c);
    return n;
  }

  /** Yelpaze düzeni: kartları yay boyunca döndürüp kaldırır. */
  function fanLayout(nodes, spread, lift) {
    const n = nodes.length;
    if (!n) return;
    const step = n === 1 ? 0 : Math.min(spread / (n - 1), 9);
    const total = step * (n - 1);
    nodes.forEach((node, i) => {
      const rot = -total / 2 + step * i;
      const mid = (n - 1) / 2;
      const dy = Math.abs(i - mid) * (lift || 1.6);
      node.style.setProperty('--rot', rot.toFixed(2) + 'deg');
      node.style.setProperty('--ty', dy.toFixed(1) + 'px');
      node.style.zIndex = String(i);
      /* yatay dağılım: yayın genişliği */
      const spreadPx = Math.min(46, Math.max(16, 520 / Math.max(n, 1)));
      node.style.left = `calc(50% + ${((i - mid) * spreadPx).toFixed(1)}px - var(--pw) / 2)`;
    });
  }

  /* ============================================================= ÜST === */
  function renderTop() {
    const v = T.view;
    $('#ptRound').textContent = `${v.roundNo} / ${v.rounds}`;
    const left = v.players.filter((p) => !p.out).length;
    $('#ptLeft').textContent = String(left);
    const me = v.players[v.mySeat];
    $('#ptLoss').textContent = String(me.losses);
  }

  function renderTimer() {
    cancelAnimationFrame(T.timerRaf);
    const box = $('#ptTimer');
    const v = T.view;
    if (!v || v.finished || !v.turnEndsAt) { clear(box); return; }
    if (!box.firstChild) {
      box.innerHTML =
        '<svg viewBox="0 0 40 40"><circle class="tm-bg" cx="20" cy="20" r="17"></circle>' +
        '<circle class="tm-fg" cx="20" cy="20" r="17" stroke-dasharray="106.8" stroke-dashoffset="0"></circle></svg>' +
        '<div class="tm-num"></div>';
    }
    const total = (v.rules.turnSeconds || 25) * 1000;
    const fg = box.querySelector('.tm-fg'), num = box.querySelector('.tm-num');
    const tick = () => {
      if (!T.view || !T.view.turnEndsAt) return;
      const leftMs = Math.max(0, T.view.turnEndsAt - Date.now());
      const frac = Math.max(0, Math.min(1, leftMs / total));
      fg.style.strokeDashoffset = String(106.8 * (1 - frac));
      num.textContent = String(Math.ceil(leftMs / 1000));
      box.classList.toggle('tm-low', frac < 0.3);
      T.timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  /* ================================================= 3B SAHNE + İSİM == */
  function ensureScene() {
    if (T.scene || !w.Papaz3D || !w.Papaz3D.HAS3D) return T.scene;
    const canvas = $('#papaz3d');
    if (!canvas) return null;
    try {
      T.scene = w.Papaz3D.createScene(canvas);
      if (T.scene) T.scene.start();
    } catch (err) {
      console.warn('[papaz] 3B sahne kurulamadı:', err);
      T.scene = null;
    }
    if (!T.scene) $('#papazRoot').classList.add('no3d');
    return T.scene;
  }

  /** Oyuncular değiştiyse 3B karakterleri yeniden diz. */
  function syncScene() {
    const v = T.view;
    const sc = ensureScene();
    if (!sc) return;

    const key = v.players.map((p) => `${p.seat}:${p.color}:${accKey(p.acc)}`).join('|') + '@' + v.mySeat;
    if (key !== T.seatKey) {
      T.seatKey = key;
      sc.setPlayers(v.players.map((p) => ({ seat: p.seat, color: p.color, acc: p.acc })), v.mySeat);
      buildLabels();
    }
    sc.setCards(v.players.map((p) => p.cards));
    sc.setTurn(v.finished ? -1 : v.turn);
    v.players.forEach((p) => sc.setOut(p.seat, !!p.out));
  }

  const accKey = (a) => (a ? `${a.hat || ''}-${a.face || ''}-${a.hair || ''}` : '');

  /** Her kafanın üstünde duran isim etiketlerini oluştur. */
  function buildLabels() {
    const v = T.view;
    const layer = $('#papazNames');
    clear(layer);
    T.labels.clear();
    for (const p of v.players) {
      const node = el('div', { class: 'pname' }, [
        el('div', { class: 'pn-top' }, [
          el('span', { class: 'pn-name', text: p.name }),
          p.isBot ? el('span', { class: 'pn-bot', text: 'BOT' }) : null,
        ]),
        el('div', { class: 'pn-sub' }),
      ]);
      layer.appendChild(node);
      T.labels.set(p.seat, node);
    }
    startLabelLoop();
  }

  /** Etiketleri her karede 3B kafaların üstüne yansıt. */
  function startLabelLoop() {
    cancelAnimationFrame(T.labelRaf);
    const tick = () => {
      const v = T.view, sc = T.scene;
      if (!v || !sc) { T.labelRaf = requestAnimationFrame(tick); return; }
      const stage = $('#papazStage');
      if (!stage) return;
      const box = stage.getBoundingClientRect();
      for (const [seat, node] of T.labels) {
        const pos = sc.projectSeat(seat);
        const p = v.players[seat];
        if (!pos || !p) { node.classList.add('hidden'); continue; }
        node.classList.toggle('hidden', !pos.visible);
        node.style.left = (pos.x - box.left) + 'px';
        node.style.top = (pos.y - box.top) + 'px';
        node.classList.toggle('turn', v.turn === seat && !v.finished);
        node.classList.toggle('source', v.drawFrom === seat);
        node.classList.toggle('out', !!p.out);

        const sub = node.querySelector('.pn-sub');
        const want = p.out
          ? '<span class="pn-out">KURTULDU</span>'
          : `<span class="pcount">${p.cards} kart</span><span>${p.pairs} çift</span>`
            + (p.losses ? `<span class="ps-loss">♚${p.losses}</span>` : '');
        if (sub.dataset.k !== want) { sub.dataset.k = want; sub.innerHTML = want; }
      }
      /* balonlar da kafaları takip etsin */
      for (const [seat, b] of T.bubbles) placeBubble(seat, b.node);
      T.labelRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function renderMe() {
    const v = T.view;
    const p = v.players[v.mySeat];
    const box = $('#papazMe');
    clear(box);
    box.classList.toggle('turn', v.turn === v.mySeat && !v.finished);
    box.appendChild(el('div', { class: 'pme-av', style: { background: w.U.avatarStyle(p.id, p.color) }, text: w.U.initials(p.name) }));
    box.appendChild(el('div', {}, [
      el('div', { class: 'pme-name', text: p.name }),
      el('div', { class: 'pme-sub', html: `<b>${p.cards}</b> kart · <b>${p.pairs}</b> çift · ♚ ${p.losses}` }),
    ]));
  }

  /* ============================================== ÇEKME SAHNESİ ======= */
  function renderStage() {
    const v = T.view;
    const stage = $('#drawStage');

    if (v.finished) { clear(stage); return; }

    const myTurn = v.turn === v.mySeat;
    const key = myTurn ? `me:${v.drawFrom}:${v.drawCount}` : `watch:${v.turn}`;
    if (stage.dataset.key === key && myTurn === (stage.dataset.mode === 'me')) return;
    stage.dataset.key = key;
    stage.dataset.mode = myTurn ? 'me' : 'watch';
    clear(stage);

    if (myTurn) {
      const src = v.players[v.drawFrom];
      if (!src) return;
      stage.appendChild(el('div', { class: 'ds-title', html: `<b>${w.U.escapeHtml(src.name)}</b> — BİR KART SEÇ` }));
      stage.appendChild(el('div', { class: 'ds-hint', text: 'Kartlar kapalı. İyi düşün, papaz orada olabilir…' }));

      const fan = el('div', { class: 'target-fan', id: 'targetFan' });
      const nodes = [];
      for (let i = 0; i < v.drawCount; i++) {
        const holder = el('div', { class: 'fan-card' + (v.tell === i ? ' tell' : ''), dataset: { idx: String(i) } });
        holder.appendChild(cardNode(null, { back: true }));
        holder.onclick = () => pick(i, holder);
        fan.appendChild(holder);
        nodes.push(holder);
      }
      fanLayout(nodes, 46, 2.4);
      stage.appendChild(fan);
      w.SFX.play('turn');
    } else {
      const cur = v.players[v.turn];
      const from = v.players[(v.turn - 1 + v.players.length) % v.players.length];
      const box = el('div', { class: 'watch-box' }, [
        el('div', { class: 'watch-line', html: `<em>${w.U.escapeHtml(cur ? cur.name : '')}</em> kart seçiyor…` }),
        el('div', { class: 'watch-fan' }),
        el('div', { class: 'watch-dots' }, [el('i'), el('i'), el('i')]),
      ]);
      const wf = box.querySelector('.watch-fan');
      const cnt = Math.min(8, from ? from.cards : 5);
      for (let i = 0; i < cnt; i++) wf.appendChild(cardNode(null, { back: true }));
      stage.appendChild(box);
    }
  }

  /** Oyuncu bir kart seçti: kaldır, ortaya uçur, sonra sunucuya bildir. */
  function pick(index, holder) {
    if (T.picking) return;
    const v = T.view;
    if (!v || v.turn !== v.mySeat || v.finished) return;
    T.picking = true;

    const fan = $('#targetFan');
    if (fan) fan.classList.add('locked');
    w.SFX.play('pick');

    /* seçilen kartı ortadaki "çevirme" noktasına uçur */
    const from = holder.getBoundingClientRect();
    holder.classList.add('taken');
    flyToReveal(from);

    setTimeout(() => T.onAction({ t: 'draw', index }), 420);

    /* Hamle reddedilirse arayüz kilitli kalmasın: kısa bir kurtarma süresi. */
    clearTimeout(T.pickGuard);
    T.pickGuard = setTimeout(() => {
      if (!T.picking) return;
      T.picking = false;
      const r = $('#revealCard');
      if (r) r.style.opacity = '0';
      const st = $('#drawStage');
      if (st) { delete st.dataset.key; }
      if (T.view) renderStage();
    }, 3500);
  }

  /* --------------------------------------------------- çevirme sahnesi */
  function revealNode() {
    let r = $('#revealCard');
    if (!r) {
      r = el('div', { class: 'reveal-card', id: 'revealCard' }, [
        el('div', { class: 'face-wrap' }, [cardNode(null, { back: true }), el('div', { class: 'pcard front' })]),
      ]);
      $('#revealLayer').appendChild(r);
    }
    return r;
  }

  function flyToReveal(fromRect) {
    const layer = $('#revealLayer');
    const stage = $('#papazStage').getBoundingClientRect();
    const r = revealNode();
    r.style.opacity = '1';
    r.classList.remove('flipped', 'pop');
    /* önce kaynak konumdan başlat, sonra merkeze getir */
    const dx = (fromRect.left + fromRect.width / 2) - (stage.left + stage.width / 2);
    const dy = (fromRect.top + fromRect.height / 2) - (stage.top + stage.height * 0.42);
    r.style.transition = 'none';
    r.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.55)`;
    void r.offsetWidth;
    r.style.transition = '';
    r.style.transform = 'translate(-50%, -50%) scale(1)';
    w.SFX.play('draw');
  }

  /** Sunucudan sonuç geldi: kartı çevir ve sonucu göster. */
  function revealResult(draw) {
    clearTimeout(T.pickGuard);
    const r = revealNode();
    const front = r.querySelector('.pcard.front');
    const real = cardNode(draw.cardId);
    front.className = real.className + ' front';
    front.innerHTML = real.innerHTML;

    r.style.opacity = '1';
    setTimeout(() => {
      r.classList.add('flipped');
      w.SFX.play('tile');

      setTimeout(() => {
        if (draw.papaz) {
          $('#papazFlash').classList.add('on');
          r.classList.add('pop');
          tag('PAPAZ SANA GELDİ!', 'bad');
          w.SFX.play('lose');
          if (T.scene) T.scene.jolt();          // ampul patlar, masa sarsılır
          setTimeout(() => $('#papazFlash').classList.remove('on'), 1100);
        } else if (draw.matched) {
          tag('ÇİFT! 🎉', 'good');
          w.SFX.play('meld');
        } else {
          tag(P.cardLabel(P.cardById(draw.cardId)), 'meh');
          w.SFX.play('chat');
        }
        setTimeout(() => {
          r.style.opacity = '0';
          T.picking = false;
        }, draw.papaz ? 1500 : 900);
      }, 380);
    }, 260);
  }

  function tag(text, kind) {
    const t = $('#revealTag');
    t.className = 'reveal-tag ' + kind;
    t.textContent = text;
    void t.offsetWidth;
    t.classList.add('show');
  }

  /* --------------------------------------- rakiplerin çekişi (izleyici) */
  function watchDraw(draw) {
    const a = seatRect(draw.from);
    const b = seatRect(draw.by);
    if (!a || !b) return;

    const layer = $('#pflyLayer');
    const stage = $('#papazStage').getBoundingClientRect();

    /* eşleşen kart herkese açık, eşleşmeyen kapalı uçar */
    const node = draw.matched && draw.cardId !== null ? cardNode(draw.cardId) : cardNode(null, { back: true });
    node.classList.add('pfly');
    node.style.left = (a.left - stage.left + a.width / 2 - 30) + 'px';
    node.style.top = (a.top - stage.top + a.height / 2 - 42) + 'px';
    layer.appendChild(node);
    w.SFX.play('draw');

    requestAnimationFrame(() => {
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      node.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 30 - 15}deg) scale(.75)`;
      node.style.opacity = '0.15';
    });
    setTimeout(() => node.remove(), 560);
    if (draw.matched) setTimeout(() => w.SFX.play('meld'), 380);
  }

  /* ------------------------------------------- eli yeniden dizme ------ */
  /**
   * Kendi kartlarını sürükleyerek istediğin sıraya koy.
   * Bu sadece görsel değil: rakip senin elinden KONUMA göre kart çekiyor,
   * yani papazı saklamanın gerçek yolu bu.
   */
  function onHandPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const v = T.view;
    if (!v || v.finished) return;

    const holder = e.target.closest('.hand-card');
    const box = $('#papazHand');
    if (!holder || !box) return;

    if (!v.canReorder) {
      w.UI.toast('Sıradaki oyuncu senden kart çekiyor, şimdi karıştıramazsın', 'warn');
      return;
    }

    const order = [...box.children].map((n) => parseInt(n.dataset.id, 10));
    const fromIdx = order.indexOf(parseInt(holder.dataset.id, 10));
    if (fromIdx === -1) return;

    const startX = e.clientX, startY = e.clientY;
    const rect = holder.getBoundingClientRect();
    let moved = false;
    let curIdx = fromIdx;

    const onMove = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        moved = true;
        T.drag = { id: order[fromIdx] };
        holder.classList.add('dragging');
        box.classList.add('reordering');
        T.dragGhost = cardNode(order[fromIdx]);
        T.dragGhost.classList.add('hand-ghost');
        T.dragGhost.style.width = rect.width + 'px';
        T.dragGhost.style.height = rect.height + 'px';
        document.body.appendChild(T.dragGhost);
        w.SFX.play('pick');
      }
      T.dragGhost.style.left = ev.clientX + 'px';
      T.dragGhost.style.top = ev.clientY + 'px';

      /* imlecin hangi karta en yakın olduğuna göre araya sok */
      const kids = [...box.children];
      let target = kids.length - 1;
      for (let i = 0; i < kids.length; i++) {
        const r = kids[i].getBoundingClientRect();
        if (ev.clientX < r.left + r.width / 2) { target = i; break; }
      }
      if (target !== curIdx) {
        const node = kids[curIdx];
        box.removeChild(node);
        box.insertBefore(node, box.children[target] || null);
        curIdx = target;
        fanLayout([...box.children], 34, 1.4);
        w.SFX.play('hover');
      }
    };

    const onUp = () => {
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      if (T.dragGhost) { T.dragGhost.remove(); T.dragGhost = null; }
      holder.classList.remove('dragging');
      box.classList.remove('reordering');
      T.drag = null;

      if (!moved || curIdx === fromIdx) { fanLayout([...box.children], 34, 1.4); return; }

      const newOrder = [...box.children].map((n) => parseInt(n.dataset.id, 10));
      box.dataset.key = newOrder.join(',');     // sunucu yanıtı gelince yeniden çizilmesin
      w.SFX.play('tile');
      T.onAction({ t: 'reorder', order: newOrder });
    };

    w.addEventListener('pointermove', onMove);
    w.addEventListener('pointerup', onUp);
    e.preventDefault();
  }

  /** Elini rastgele karıştır — papazı saklamanın en hızlı yolu. */
  function shuffleHand() {
    const v = T.view;
    if (!v || v.finished) return;
    if (!v.canReorder) {
      w.UI.toast('Sıradaki oyuncu senden kart çekiyor, şimdi karıştıramazsın', 'warn');
      return;
    }
    if (v.myHand.length < 2) return;

    const order = v.myHand.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    w.SFX.play('meld');
    const box = $('#papazHand');
    if (box) box.classList.add('shuffled');
    setTimeout(() => { if (box) box.classList.remove('shuffled'); }, 450);
    T.onAction({ t: 'reorder', order });
  }

  /** Karıştırma düğmesi ve ipucu metnini güncelle. */
  function updateReorderUi() {
    const v = T.view;
    const btn = $('#papazShuffle');
    if (!btn) return;
    const can = !!(v && v.canReorder && !v.finished && v.myHand.length > 1);
    btn.disabled = !can;
    btn.title = can
      ? 'Kartlarını rastgele karıştır (rakip konuma göre çekiyor)'
      : 'Şu an karıştıramazsın';
    const box = $('#papazHand');
    if (box) box.classList.toggle('locked', !can);
  }

  /** Bir koltuğun ekrandaki konumu (uçan kart animasyonları için). */
  function seatRect(seat) {
    if (T.view && seat === T.view.mySeat) {
      const me = $('#papazMe');
      return me ? me.getBoundingClientRect() : null;
    }
    if (T.scene) {
      const pos = T.scene.projectSeat(seat);
      if (pos) return { left: pos.x - 24, top: pos.y - 20, width: 48, height: 40 };
    }
    const lbl = T.labels.get(seat);
    return lbl ? lbl.getBoundingClientRect() : null;
  }

  /** Balonu ilgili kafanın üstüne yerleştir. */
  function placeBubble(seat, node) {
    const stage = $('#papazStage');
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    let x = box.width / 2, y = box.height / 2;
    if (T.scene) {
      const pos = T.scene.projectSeat(seat);
      if (pos) { x = pos.x - box.left; y = pos.y - box.top - 34; }
    } else {
      const lbl = T.labels.get(seat);
      if (lbl) {
        const r = lbl.getBoundingClientRect();
        x = r.left + r.width / 2 - box.left;
        y = r.top - box.top - 8;
      }
    }
    node.style.left = x + 'px';
    node.style.top = y + 'px';
  }

  /* ---------------------------------------------------- konuşma balonu */
  function bubble(seat, text) {
    if (!text) return;
    const layer = $('#papazBubbles');
    if (!layer) return;
    const old = T.bubbles.get(seat);
    if (old) { clearTimeout(old.timeout); old.node.remove(); }

    const node = el('div', { class: 'ps-bubble', text });
    layer.appendChild(node);
    placeBubble(seat, node);          // ilk karede (0,0)'da parlamasın
    const rec = {
      node,
      timeout: setTimeout(() => {
        node.classList.add('out');
        setTimeout(() => node.remove(), 300);
        T.bubbles.delete(seat);
      }, 2600),
    };
    T.bubbles.set(seat, rec);
    if (T.scene) T.scene.bob(seat);
    w.SFX.play('chat');
  }

  /* =============================================================== EL == */
  function renderHand() {
    const v = T.view;
    const box = $('#papazHand');
    if (T.drag) return;                       // sürükleme sürerken karışmasın

    const key = v.myHand.join(',');
    const fresh = T.lastRound !== v.roundNo;
    if (box.dataset.key === key && !fresh) { updateReorderUi(); return; }
    const isDeal = fresh;
    box.dataset.key = key;
    T.lastRound = v.roundNo;

    clear(box);
    const nodes = [];
    v.myHand.forEach((id, i) => {
      const holder = el('div', {
        class: 'hand-card' + (isDeal ? ' dealt' : ''),
        dataset: { id: String(id) },
      });
      if (isDeal) holder.style.animationDelay = (i * 45) + 'ms';
      holder.appendChild(cardNode(id));
      box.appendChild(holder);
      nodes.push(holder);
    });
    fanLayout(nodes, 34, 1.4);
    if (isDeal) for (let i = 0; i < Math.min(6, nodes.length); i++) w.SFX.play('deal', i);
    updateReorderUi();

    /* yere açılan çiftler */
    const pb = $('#papazPairs');
    clear(pb);
    for (const pair of v.myPairs) {
      const pn = el('div', { class: 'mp-pair' });
      for (const id of pair) pn.appendChild(cardNode(id));
      pb.appendChild(pn);
    }
    $('#papazPairCount').textContent = String(v.myPairs.length);
  }

  /* ============================================================ ÇİZİM = */
  function render(view) {
    const prev = T.view;
    T.view = view;

    renderTop();
    syncScene();
    renderMe();
    renderHand();
    renderStage();
    renderTimer();

    /* yeni bir çekiş oldu mu? */
    const d = view.lastDraw;
    if (d) {
      const key = `${view.roundNo}:${d.by}:${d.from}:${d.cardId}:${d.matched}:${view.players.map((p) => p.cards).join('')}`;
      if (key !== T.lastDrawKey) {
        T.lastDrawKey = key;
        if (d.by === view.mySeat) {
          if (T.picking) revealResult(d);
        } else {
          watchDraw(d);
          reactTo(d);
        }
      }
    }

    /* kurtulanları duyur */
    if (prev) {
      view.players.forEach((p, i) => {
        if (p.out && !prev.players[i].out) {
          bubble(i, w.PapazBot.line('out'));
          if (i === view.mySeat) { banner('KURTULDUN!', 'ELİN BİTTİ'); w.SFX.play('win'); }
          else w.SFX.play('ok');
        }
      });
    }
  }

  /** Rakipler arası çekişe masa tepkisi ver. */
  function reactTo(d) {
    const v = T.view;
    if (d.matched && Math.random() < 0.4) bubble(d.by, w.PapazBot.line('paired'));
    else if (Math.random() < 0.25) bubble(d.from, w.PapazBot.line('gaveGood'));
  }

  function banner(main, sub, bad) {
    const b = $('#papazBanner');
    if (!b) return;
    b.classList.toggle('bad', !!bad);
    b.innerHTML = w.U.escapeHtml(main) + (sub ? `<span class="sub">${w.U.escapeHtml(sub)}</span>` : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  /* ============================================================ MODAL == */
  function showResult(result, players, onNext, isHost) {
    const loser = result.loserSeat !== null && result.loserSeat !== undefined ? players[result.loserSeat] : null;
    const iLost = loser && result.loserSeat === T.view.mySeat;

    const head = el('div', { class: 'papaz-result-card' }, [
      el('div', { class: 'prc-face' }, [cardNode(P.PAPAZ_ID)]),
      el('div', { class: 'result-title', text: iLost ? 'PAPAZ SENDE KALDI!' : `PAPAZ ${w.U.upper(loser ? loser.name : '?')}'DE KALDI` }),
      el('div', { class: 'result-why', text: iLost ? 'Bir dahakine daha hızlı kurtul!' : 'Sen kurtuldun 😌' }),
    ]);

    const table = el('table', { class: 'score-table' });
    table.innerHTML = '<thead><tr><th>#</th><th>Oyuncu</th><th>Çift</th><th style="text-align:right">Papaz</th></tr></thead>';
    const tb = el('tbody');
    const order = result.outOrder.concat(
      players.map((p) => p.seat).filter((s) => result.outOrder.indexOf(s) === -1));
    order.forEach((seat, i) => {
      const p = players[seat];
      if (!p) return;
      const isLoser = seat === result.loserSeat;
      const tr = el('tr', { class: (i === 0 ? 'win-row ' : '') + (seat === T.view.mySeat ? 'me-row' : '') });
      tr.appendChild(el('td', { text: isLoser ? '—' : String(i + 1) }));
      tr.appendChild(el('td', { text: p.name + (isLoser ? ' ♚' : '') }));
      tr.appendChild(el('td', { text: String(result.pairCounts ? result.pairCounts[seat] : 0) }));
      tr.appendChild(el('td', { class: 'num', text: String(p.losses) }));
      tb.appendChild(tr);
    });
    table.appendChild(tb);

    w.SFX.play(iLost ? 'lose' : 'win');
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
    table.innerHTML = '<thead><tr><th>#</th><th>Oyuncu</th><th>Kurtuluş</th><th style="text-align:right">Papaz</th></tr></thead>';
    const tb = el('tbody');
    payload.players.slice().sort((a, b) => a.losses - b.losses || b.saves - a.saves).forEach((p, i) => {
      const tr = el('tr', { class: (i === 0 ? 'win-row ' : '') + (p.seat === mySeat ? 'me-row' : '') });
      tr.appendChild(el('td', { text: String(i + 1) }));
      tr.appendChild(el('td', { text: p.name }));
      tr.appendChild(el('td', { text: String(p.saves) }));
      tr.appendChild(el('td', { class: 'num', text: String(p.losses) }));
      tb.appendChild(tr);
    });
    table.appendChild(tb);

    w.SFX.play(iWon ? 'win' : 'lose');
    w.UI.modal({
      title: '', closable: false, wide: true,
      body: el('div', {}, [
        el('div', { class: 'result-head' }, [
          el('div', { class: 'result-crown', text: iWon ? '🏆' : '🎬' }),
          el('div', { class: 'result-title', text: iWon ? 'PAPAZDAN KAÇTIN!' : `${winner.name} KAZANDI` }),
          el('div', { class: 'result-why', text: 'En az papaz kalan kazanır' }),
        ]),
        table,
      ]),
      actions: [{ label: 'LOBİYE DÖN', kind: 'btn-primary', onClick: () => T.onLeave(true) }],
    });
  }

  /* ============================================================= OLAY == */
  function playEvent(ev) {
    switch (ev.t) {
      case 'say': bubble(ev.seat, ev.text); break;
      case 'papaz':
        if (ev.seat !== (T.view && T.view.mySeat)) {
          bubble(ev.seat, w.PapazBot.line('gotPapaz'));
          bubble(ev.from, w.PapazBot.line('gavePapaz'));
        }
        break;
      case 'deal': w.SFX.play('deal', 0); break;
      default: break;
    }
  }

  /* ========================================================== KURULUM == */
  function mount() {
    if (T.mounted) {
      ensureScene();
      setActive(true);
      return;
    }
    T.mounted = true;
    $('#papazLeave').onclick = () => T.onLeave(false);
    $('#papazRules').onclick = () => w.PapazRules.show();
    $('#papazShuffle').onclick = shuffleHand;
    $('#papazHand').addEventListener('pointerdown', onHandPointerDown);
    document.addEventListener('keydown', (e) => {
      if (!T.view || !document.querySelector('.view[data-view="papaz"]').classList.contains('active')) return;
      if (!document.getElementById('modalHost').hidden) return;
      if (e.key === 'k' || e.key === 'K') shuffleHand();
    });
    ensureScene();
    w.addEventListener('resize', w.U.debounce(() => { if (T.scene) T.scene.resize(); }, 150));
  }

  function reset() {
    T.view = null; T.prev = null; T.lastDrawKey = ''; T.lastRound = -1; T.picking = false;
    T.seatKey = ''; T.drag = null;
    if (T.dragGhost) { T.dragGhost.remove(); T.dragGhost = null; }
    cancelAnimationFrame(T.timerRaf);
    cancelAnimationFrame(T.labelRaf);
    for (const [, b] of T.bubbles) { clearTimeout(b.timeout); b.node.remove(); }
    T.bubbles.clear();
    T.labels.clear();
    ['#papazNames', '#papazBubbles', '#papazHand', '#papazPairs', '#drawStage', '#revealLayer', '#pflyLayer']
      .forEach((s) => { const n = $(s); if (n) clear(n); });
    const st = $('#drawStage'); if (st) { delete st.dataset.key; delete st.dataset.mode; }
    const h = $('#papazHand'); if (h) delete h.dataset.key;
    if (T.scene) { T.scene.stop(); }
  }

  /** Görünüm açıldığında sahneyi uyandır, kapanınca uykuya al. */
  function setActive(on) {
    if (!T.scene) return;
    if (on) { T.scene.start(); T.scene.resize(); startLabelLoop(); }
    else { T.scene.stop(); cancelAnimationFrame(T.labelRaf); }
  }

  w.PapazTable = {
    mount, render, reset, playEvent, banner, cardNode, bubble, setActive,
    showResult, showMatchOver,
    set onAction(fn) { T.onAction = fn; },
    set onLeave(fn) { T.onLeave = fn; },
  };
})(window);
