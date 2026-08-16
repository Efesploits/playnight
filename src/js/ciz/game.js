/* =============================================================================
 *  PLAY NIGHT — ÇİZ BABACIM ARAYÜZÜ
 *  Sunucu (oda kurucu) otoritedir; burada yalnızca görünüm ve girdi vardır.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, el, clear } = w.U;
  const D = w.CizDraw;

  const G = {
    view: null,
    painter: null,
    timerRaf: 0,
    lastKey: '',
    replayStop: null,
    onAction: () => {},
    onLeave: () => {},
    mounted: false,
  };

  /* =============================================================== ÜST === */
  function renderTop() {
    const v = G.view;
    const roundEl = $('#ctRound');
    const phaseEl = $('#ctPhase');

    if (v.phase === 'play') {
      roundEl.textContent = `${v.round + 1} / ${v.rounds}`;
      const t = v.task;
      phaseEl.textContent = !t ? 'BEKLENİYOR'
        : t.kind === 'seed' ? 'CÜMLE YAZ'
        : t.kind === 'draw' ? 'ÇİZ'
        : 'TAHMİN ET';
    } else if (v.phase === 'present') {
      roundEl.textContent = `${(v.present ? v.present.bookIndex + 1 : 1)} / ${(v.present ? v.present.bookCount : 1)}`;
      phaseEl.textContent = 'ALBÜM';
    } else {
      roundEl.textContent = '—';
      phaseEl.textContent = 'BİTTİ';
    }
  }

  function renderTimer() {
    cancelAnimationFrame(G.timerRaf);
    const box = $('#ctTimer');
    const v = G.view;
    if (!v || v.phase !== 'play' || !v.deadline) { clear(box); return; }

    if (!box.firstChild) {
      box.innerHTML =
        '<svg viewBox="0 0 44 44"><circle class="tm-bg" cx="22" cy="22" r="19"></circle>' +
        '<circle class="tm-fg" cx="22" cy="22" r="19" stroke-dasharray="119.4" stroke-dashoffset="0"></circle></svg>' +
        '<div class="tm-num"></div>';
    }
    const total = (v.task && v.task.seconds ? v.task.seconds : 45) * 1000;
    const fg = box.querySelector('.tm-fg');
    const num = box.querySelector('.tm-num');

    const tick = () => {
      if (!G.view || G.view.phase !== 'play' || !G.view.deadline) return;
      const left = Math.max(0, G.view.deadline - Date.now());
      const frac = Math.max(0, Math.min(1, left / total));
      fg.style.strokeDashoffset = String(119.4 * (1 - frac));
      num.textContent = String(Math.ceil(left / 1000));
      box.classList.toggle('tm-low', frac < 0.25);
      G.timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function renderPlayers() {
    const box = $('#cizPlayers');
    clear(box);
    const v = G.view;
    if (!v || v.phase !== 'play') return;
    for (const p of v.players) {
      box.appendChild(el('div', { class: 'cp' + (p.done ? ' done' : '') + (p.seat === v.mySeat ? ' me' : '') }, [
        el('div', { class: 'cp-av', style: { background: w.U.avatarStyle(p.id, p.color) }, text: w.U.initials(p.name) },
        ),
        el('div', { class: 'cp-name', text: p.name }),
        el('div', { class: 'cp-st', text: p.done ? '✓' : '…' }),
      ]));
    }
  }

  /* ============================================================ GÖREV === */
  function renderTask() {
    const body = $('#cizBody');
    const v = G.view;
    const t = v.task;

    /* aynı görev tekrar çizilmesin (yazdığın metin uçmasın) */
    const key = `${v.phase}|${v.round}|${t ? t.kind : ''}|${t ? t.done : ''}`;
    if (key === G.lastKey) { return; }
    G.lastKey = key;

    disposePainter();
    clear(body);

    if (!t) { body.appendChild(waitCard('Sıradaki tur hazırlanıyor…')); return; }
    if (t.done) { body.appendChild(doneCard()); return; }

    if (t.kind === 'seed') body.appendChild(seedCard(t));
    else if (t.kind === 'draw') body.appendChild(drawCard(t));
    else body.appendChild(guessCard(t));
  }

  const bigHead = (title, sub) => el('div', { class: 'ciz-head' }, [
    el('h2', { text: title }),
    sub ? el('p', { text: sub }) : null,
  ]);

  function waitCard(msg) {
    return el('div', { class: 'ciz-card center' }, [
      el('div', { class: 'spinner big' }),
      el('p', { class: 'ciz-wait', text: msg }),
    ]);
  }

  function doneCard() {
    const v = G.view;
    const left = v.players.filter((p) => !p.done).map((p) => p.name);
    return el('div', { class: 'ciz-card center' }, [
      el('div', { class: 'ciz-tick', text: '✓' }),
      el('h3', { text: 'GÖNDERİLDİ' }),
      el('p', { class: 'ciz-wait', text: left.length ? 'Bekleniyor: ' + left.join(', ') : 'Herkes tamam, tur değişiyor…' }),
    ]);
  }

  /* --- 1. tur: serbest cümle --- */
  function seedCard(t) {
    const input = el('input', {
      class: 'input ciz-input', maxlength: '90', placeholder: 'Örn: kaykay süren kedi',
      onkeydown: (e) => { if (e.key === 'Enter') send(); },
    });
    const btn = el('button', { class: 'btn btn-primary btn-xl', text: 'GÖNDER', onclick: () => send() });
    function send() {
      const val = input.value.trim();
      if (!val) { w.UI.toast('Önce bir şeyler yaz', 'warn'); input.focus(); return; }
      G.onAction({ t: 'submit', round: t.round, value: val });
      w.SFX.play('ok');
    }
    setTimeout(() => input.focus(), 120);
    return el('div', { class: 'ciz-card' }, [
      bigHead('AKLINA GELEN İLK ŞEYİ YAZ', 'Ne kadar saçmaysa o kadar iyi — birazdan biri bunu çizmeye çalışacak.'),
      input,
      el('div', { class: 'ciz-actions' }, [btn]),
    ]);
  }

  /* --- çizim turu --- */
  function drawCard(t) {
    const src = t.source && t.source.value ? String(t.source.value) : '(bir şey yazılmamış)';
    G.painter = D.createPainter({});
    const btn = el('button', {
      class: 'btn btn-primary btn-xl', text: 'GÖNDER',
      onclick: () => {
        if (G.painter.isEmpty()) { w.UI.toast('Boş tuval gönderiyorsun, en azından bir çizgi çek', 'warn'); return; }
        G.onAction({ t: 'submit', round: t.round, value: G.painter.getData() });
        w.SFX.play('ok');
      },
    });
    return el('div', { class: 'ciz-card wide' }, [
      el('div', { class: 'ciz-prompt' }, [
        el('span', { class: 'cp-label', text: `${t.sourceBy || '?'} yazdı` }),
        el('strong', { text: src }),
      ]),
      G.painter.root,
      el('div', { class: 'ciz-actions' }, [btn]),
    ]);
  }

  /* --- tahmin turu --- */
  function guessCard(t) {
    const cv = el('canvas', { class: 'ciz-view-canvas' });
    const input = el('input', {
      class: 'input ciz-input', maxlength: '90', placeholder: 'Sence bu ne?',
      onkeydown: (e) => { if (e.key === 'Enter') send(); },
    });
    const btn = el('button', { class: 'btn btn-primary btn-xl', text: 'GÖNDER', onclick: () => send() });
    function send() {
      const val = input.value.trim();
      if (!val) { w.UI.toast('Bir tahmin yaz', 'warn'); input.focus(); return; }
      G.onAction({ t: 'submit', round: t.round, value: val });
      w.SFX.play('ok');
    }
    const card = el('div', { class: 'ciz-card wide' }, [
      bigHead('BU NE?', `${t.sourceBy || 'Biri'} çizdi. Ne olduğunu tahmin et.`),
      el('div', { class: 'ciz-canvas-wrap show' }, [cv]),
      input,
      el('div', { class: 'ciz-actions' }, [btn]),
    ]);
    setTimeout(() => {
      D.replay(cv, (t.source && t.source.value) || { strokes: [] }, 900);
      input.focus();
    }, 90);
    return card;
  }

  /* ============================================================ SUNUM === */
  function renderPresent() {
    const body = $('#cizBody');
    const v = G.view;
    const p = v.present;
    if (!p) return;

    const key = `present|${p.bookIndex}|${p.step}|${v.phase}`;
    if (key === G.lastKey) return;
    const newBook = G.lastKey.indexOf(`present|${p.bookIndex}|`) !== 0;
    G.lastKey = key;

    disposePainter();
    if (newBook) clear(body);

    let album = body.querySelector('.ciz-album');
    if (!album) {
      clear(body);
      album = el('div', { class: 'ciz-album' });
      body.appendChild(el('div', { class: 'ciz-album-head' }, [
        el('span', { class: 'ab-count', text: `DEFTER ${p.bookIndex + 1} / ${p.bookCount}` }),
        el('h2', { text: `${p.ownerName} İLE BAŞLADI` }),
      ]));
      body.appendChild(album);
    }

    /* yalnızca yeni açılan adımı ekle */
    const have = album.children.length;
    for (let i = have; i < p.steps.length; i++) {
      album.appendChild(stepNode(p.steps[i], i));
    }
    album.scrollTop = album.scrollHeight;

    const isHost = w.Room.isHost;
    let bar = body.querySelector('.ciz-present-bar');
    if (!bar) {
      bar = el('div', { class: 'ciz-present-bar' });
      body.appendChild(bar);
    }
    clear(bar);
    if (v.phase === 'done') {
      bar.appendChild(el('div', { class: 'ciz-done-msg', text: 'Albüm bitti!' }));
      bar.appendChild(el('button', {
        class: 'btn btn-primary btn-xl', text: 'LOBİYE DÖN', onclick: () => G.onLeave(true),
      }));
    } else if (isHost) {
      bar.appendChild(el('button', {
        class: 'btn btn-primary btn-xl',
        text: p.isLastStep && p.isLastBook ? 'ALBÜMÜ BİTİR' : (p.isLastStep ? 'SONRAKİ DEFTER →' : 'DEVAM →'),
        onclick: () => { w.SFX.play('click'); G.onAction({ t: 'presentNext' }); },
      }));
    } else {
      bar.appendChild(el('div', { class: 'ciz-done-msg', text: 'Oda kurucusu ilerletiyor…' }));
    }
  }

  function stepNode(s, i) {
    const node = el('div', { class: 'ciz-step ' + (i % 2 ? 'right' : 'left') });
    node.appendChild(el('div', { class: 'cs-by' }, [
      el('span', { class: 'cs-dot' }),
      el('span', { text: `${s.byName} ${s.type === 'draw' ? 'çizdi' : (i === 0 ? 'yazdı' : 'tahmin etti')}` }),
    ]));

    if (s.type === 'text') {
      node.appendChild(el('div', { class: 'cs-text' + (s.empty ? ' empty' : ''), text: s.value }));
      w.SFX.play('chat');
    } else {
      const cv = el('canvas', { class: 'cs-canvas' });
      node.appendChild(el('div', { class: 'cs-draw' }, [cv]));
      setTimeout(() => {
        if (G.replayStop) G.replayStop();
        G.replayStop = D.replay(cv, s.value || { strokes: [] }, 1500);
      }, 60);
      w.SFX.play('meld');
    }
    return node;
  }

  /* ============================================================ ORTAK === */
  function disposePainter() {
    if (G.painter) { try { G.painter.destroy(); } catch {} G.painter = null; }
    if (G.replayStop) { try { G.replayStop(); } catch {} G.replayStop = null; }
  }

  function render(view) {
    G.view = view;
    renderTop();
    renderPlayers();
    if (view.phase === 'play') { renderTask(); renderTimer(); }
    else { cancelAnimationFrame(G.timerRaf); clear($('#ctTimer')); renderPresent(); }
  }

  function banner(main, sub) {
    const b = $('#cizBanner');
    if (!b) return;
    b.innerHTML = w.U.escapeHtml(main) + (sub ? `<span class="sub">${w.U.escapeHtml(sub)}</span>` : '');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  function mount() {
    if (G.mounted) return;
    G.mounted = true;
    $('#cizLeave').onclick = () => G.onLeave(false);
    $('#cizRules').onclick = () => w.UI.modal({
      title: 'ÇİZ BABACIM NASIL OYNANIR?',
      wide: true,
      body: `<div class="rules-doc">
        <h4>FİKİR</h4>
        <ul>
          <li>Herkesin bir <b>defteri</b> vardır. İlk turda kendi defterine bir cümle yazarsın.</li>
          <li>Defterler el değiştirir: sana gelen cümleyi <b>çizersin</b>.</li>
          <li>Sonraki oyuncu sadece <b>çizimi</b> görür ve ne olduğunu <b>tahmin eder</b>.</li>
          <li>Bu tahmin bir sonrakine çizdirilir… ve böyle devam eder.</li>
          <li>Sonunda her defter baştan sona açılır — cümlenin ne hale geldiğini birlikte görürsünüz.</li>
        </ul>
        <h4>İPUÇLARI</h4>
        <ul>
          <li>Çizim yeteneği önemli değil, <b>kötü çizim daha komik</b>.</li>
          <li>Süre dolarsa elindeki hâliyle gönderilir, boş kalmaz.</li>
          <li>2–8 kişi oynanır. Boş koltuklar bot olur (botlar karalar ve saçmalar).</li>
        </ul>
        <h4>KONTROLLER</h4>
        <ul>
          <li>Renk ve kalınlık seç, <b>SİLGİ</b> ile düzelt, <b>GERİ AL</b> ile son çizgiyi kaldır.</li>
          <li>Yazarken <b>Enter</b> göndermeye yarar.</li>
        </ul>
      </div>`,
      actions: [{ label: 'ANLADIM', kind: 'btn-primary' }],
    });
  }

  function reset() {
    disposePainter();
    cancelAnimationFrame(G.timerRaf);
    G.view = null; G.lastKey = '';
    const b = $('#cizBody'); if (b) clear(b);
    const p = $('#cizPlayers'); if (p) clear(p);
  }

  w.CizGame = {
    mount, render, reset, banner,
    set onAction(fn) { G.onAction = fn; },
    set onLeave(fn) { G.onLeave = fn; },
  };
})(window);
