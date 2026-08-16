/* =============================================================================
 *  PLAY NIGHT — ODA, LOBİ VE OYUN OTURUMLARI
 *  Oda kuran (host) otoritedir: motoru o çalıştırır, herkese görünüm yollar.
 *  Birden fazla oyunu taşır: 101 Okey ve Çiz Babacım.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, $$, el, clear } = w.U;
  const E = w.Okey101;
  const C = w.Ciz;
  const N = w.Uno;

  /* Oyun kataloğu. `fixed` = masa hep tam dolu olmalı (boşlar bota döner). */
  const GAMES = {
    okey101: { key: 'okey101', name: '101 OKEY', view: 'okey', min: 4, max: 4, fixed: true, botFill: 4 },
    ciz:     { key: 'ciz',     name: 'ÇİZ BABACIM', view: 'ciz', min: 2, max: 8, fixed: false, botFill: 4 },
    uno:     { key: 'uno',     name: 'UNO', view: 'uno', min: 2, max: 6, fixed: false, botFill: 4 },
  };

  const R = {
    mode: 'idle',        // idle | lobby | game
    game: 'okey101',
    isHost: false,
    local: false,        // ağ yok (botlarla tek başına)
    code: null,
    hostId: null,
    players: [],         // host otoritesi: [{id,name,color,isBot,connected}] (boşluk olabilir)
    mySeat: 0,
    rules: null,
    chat: [],
    match: null,         // okey
    ciz: null,           // çiz babacım
    uno: null,           // uno
    tickTimer: null,
    botTimer: null,
    cizBotTimers: [],
    unoTimers: [],
  };

  const spec = () => GAMES[R.game] || GAMES.okey101;
  const filled = () => R.players.filter(Boolean).length;
  const me = () => w.Store.profile();
  const pub = () => ({ id: me().id, name: me().name, color: me().color, isBot: false, connected: true });

  function defaultRules(game) {
    if (game === 'ciz') return Object.assign({}, C.DEFAULT_RULES);
    if (game === 'uno') return Object.assign({}, N.DEFAULT_RULES, { turnSeconds: w.Store.settings().turnSeconds || 30 });
    return Object.assign({}, E.DEFAULT_RULES, { turnSeconds: w.Store.settings().turnSeconds || 30 });
  }

  const BOT_NAMES = ['Cengiz', 'Yıldız', 'Kerem', 'Nazlı', 'Bora', 'Selin', 'Doruk', 'Ece', 'Tuna', 'Pınar'];
  function makeBot(seat) {
    const used = new Set(R.players.filter(Boolean).map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || ('Bot' + (seat + 1));
    return { id: 'bot-' + seat + '-' + w.U.makeCode(4), name, color: (3 + seat) % 10, isBot: true, connected: true };
  }

  /* ====================================================== LOBİ ÇİZİMİ === */
  function renderLobby() {
    const g = spec();
    $('#lobbyCode').textContent = R.code || 'YEREL';
    $('#seatCount').textContent = `${filled()}/${g.max}`;
    const gameLabel = $('.lobby-game');
    if (gameLabel) gameLabel.textContent = g.name;

    /* sabit masalarda tüm koltuklar, esnek masalarda dolu + 1 boş gösterilir */
    const visible = g.fixed ? g.max : Math.min(g.max, lastFilledIndex() + 2);

    const list = $('#seatList');
    clear(list);
    for (let i = 0; i < visible; i++) {
      const p = R.players[i];
      if (p) {
        const isHostSeat = p.id === R.hostId;
        list.appendChild(el('div', { class: 'seat filled' + (isHostSeat ? ' host-seat' : '') }, [
          el('div', { class: 'seat-av', style: { background: w.U.avatarStyle(p.id, p.color) }, text: w.U.initials(p.name) }),
          el('div', { class: 'seat-info' }, [
            el('div', { class: 'seat-name' }, [
              el('span', { text: p.name }),
              isHostSeat ? el('span', { class: 'crown', text: '♛' }) : null,
              p.id === me().id ? el('span', { class: 'chip', text: 'SEN' }) : null,
            ]),
            el('div', { class: 'seat-tag', text: p.isBot ? 'Bilgisayar oyuncusu' : (p.connected ? `ID ${p.id}` : 'Bağlantı koptu') }),
          ]),
          el('div', { class: 'seat-acts' }, [
            R.isHost && p.id !== me().id
              ? el('button', { class: 'btn btn-ghost btn-sm', text: 'ÇIKAR', onclick: () => kickSeat(i) })
              : null,
          ]),
        ]));
      } else {
        list.appendChild(el('div', { class: 'seat empty' }, [
          el('div', { class: 'seat-av ghost', text: '+' }),
          el('div', { class: 'seat-info' }, [
            el('div', { class: 'seat-name', text: 'Boş koltuk' }),
            el('div', { class: 'seat-tag', text: R.isHost ? 'Arkadaş davet et ya da bot ekle' : 'Bekleniyor…' }),
          ]),
          el('div', { class: 'seat-acts' }, [
            R.isHost ? el('button', { class: 'btn btn-ghost btn-sm', text: 'BOT EKLE', onclick: () => addBot(i) }) : null,
          ]),
        ]));
      }
    }

    const startBtn = $('#startGameBtn');
    startBtn.hidden = !R.isHost;
    const enough = filled() >= (g.fixed ? 1 : g.min);
    startBtn.disabled = !R.isHost || !enough;
    startBtn.textContent = !enough
      ? `EN AZ ${g.min} OYUNCU GEREK`
      : (g.fixed && filled() < g.max ? 'BAŞLAT (BOŞLAR BOT OLUR)' : 'OYUNU BAŞLAT');

    renderRulesPanel();
    renderInviteList();
    renderChat();
  }

  function lastFilledIndex() {
    let last = -1;
    for (let i = 0; i < R.players.length; i++) if (R.players[i]) last = i;
    return last;
  }

  function renderRulesPanel() {
    const box = $('#ruleRows');
    clear(box);
    const r = R.rules || defaultRules(R.game);

    const rows = R.game === 'uno' ? [
      ['Oyuncu', `${spec().min}–${spec().max} kişi`, '108 kartlık klasik deste'],
      ['Hedef puan', `${r.targetScore}`, 'Bu puana ulaşan maçı kazanır'],
      ['Başlangıç eli', `${r.handSize} kart`, 'Herkese dağıtılan kart sayısı'],
      ['Tur süresi', r.turnSeconds ? `${r.turnSeconds} sn` : 'Sınırsız', 'Süre dolarsa kart çekilir'],
      ['Joker+4 itirazı', r.challengeEnabled ? 'Açık' : 'Kapalı', 'Blöfse oynayan 4, haksızsa itiraz eden 6 çeker'],
      ['UNO cezası', `${r.unoPenalty} kart`, 'UNO demeyi unutup yakalanırsan'],
    ] : R.game === 'ciz' ? [
      ['Oyuncu', `${spec().min}–${spec().max} kişi`, 'Ne kadar kalabalık, o kadar komik'],
      ['Cümle süresi', `${r.writeSeconds} sn`, 'İlk turda yazma süresi'],
      ['Çizim süresi', `${r.drawSeconds} sn`, 'Çizim turlarında verilen süre'],
      ['Tahmin süresi', `${r.guessSeconds} sn`, 'Çizimi tahmin etme süresi'],
      ['Tur sayısı', r.rounds ? `${r.rounds}` : 'Oyuncu sayısı kadar', 'Her defterin kaç elden geçtiği'],
    ] : [
      ['El açma eşiği', `${r.openPoints} puan`, 'Tek hamlede yere serilmesi gereken en az per puanı'],
      ['Çiftten açma', `${r.openPairs} çift`, 'Seri yerine çiftle açmak için gereken çift sayısı'],
      ['Maç uzunluğu', `${r.deals} el`, 'El sayısı dolunca en düşük puanlı kazanır'],
      ['Süre', r.turnSeconds ? `${r.turnSeconds} sn` : 'Sınırsız', 'Tur başına düşünme süresi'],
      ['12-13-1 serisi', r.aceHighAllowed ? 'Açık' : 'Kapalı', '1 taşı serinin sonunda da kullanılabilir'],
      ['Elde kalan okey', r.okeyInHandPenalty ? `+${r.okeyInHandPenalty}` : 'Sayı değeri', 'El bitince elde okey kalırsa ceza'],
    ];
    for (const [k, v, sub] of rows) {
      box.appendChild(el('div', { class: 'rule-row' }, [
        el('div', { class: 'rr-l' }, [el('span', { text: k }), el('small', { text: sub })]),
        el('div', { class: 'rr-v', text: v }),
      ]));
    }

    if (!R.isHost) return;
    if (R.game === 'uno') {
      box.appendChild(hostSelect('Hedef puan', [100, 200, 300, 500], r.targetScore,
        (v) => `${v} puan`, (v) => { R.rules.targetScore = v; }));
      box.appendChild(hostSelect('Tur süresi', [0, 20, 30, 45], r.turnSeconds,
        (v) => (v ? `${v} saniye` : 'Sınırsız'),
        (v) => { R.rules.turnSeconds = v; w.Store.setSetting('turnSeconds', v); }));
    } else if (R.game === 'ciz') {
      box.appendChild(hostSelect('Çizim süresi', [45, 60, 75, 100, 130], r.drawSeconds,
        (v) => `${v} saniye`, (v) => { R.rules.drawSeconds = v; }));
      box.appendChild(hostSelect('Tahmin süresi', [20, 30, 40, 55], r.guessSeconds,
        (v) => `${v} saniye`, (v) => { R.rules.guessSeconds = v; R.rules.writeSeconds = v + 5; }));
    } else {
      box.appendChild(hostSelect('Maç uzunluğu', [3, 5, 7, 11, 21], r.deals,
        (v) => `${v} el`, (v) => { R.rules.deals = v; }));
      box.appendChild(hostSelect('Tur süresi', [0, 20, 30, 45, 60], r.turnSeconds,
        (v) => (v ? `${v} saniye` : 'Sınırsız'),
        (v) => { R.rules.turnSeconds = v; w.Store.setSetting('turnSeconds', v); }));
    }
  }

  function hostSelect(label, values, current, fmt, apply) {
    const sel = el('select', { class: 'input' });
    for (const v of values) sel.appendChild(el('option', { value: String(v), text: fmt(v), selected: current === v }));
    sel.onchange = () => { apply(parseInt(sel.value, 10)); broadcastLobby(); renderRulesPanel(); };
    return el('div', { class: 'rule-row' }, [
      el('div', { class: 'rr-l' }, [el('span', { text: label + ' değiştir' }), el('small', { text: 'Sadece oda kurucusu' })]),
      sel,
    ]);
  }

  function renderInviteList() {
    const box = $('#inviteList');
    const empty = $('#inviteEmpty');
    clear(box);
    const friends = w.Friends.online();
    empty.hidden = friends.length > 0;
    for (const f of friends) {
      const inRoom = R.players.some((p) => p && p.id === f.id);
      box.appendChild(el('div', { class: 'friend-row' }, [
        w.UI.avatar(f.name, f.id, 'fr-av online', f.color),
        el('div', { class: 'fr-info' }, [
          el('div', { class: 'fr-name', text: f.name }),
          el('div', { class: 'fr-sub', text: inRoom ? 'Odada' : 'Çevrimiçi' }),
        ]),
        el('div', { class: 'fr-acts' }, [
          inRoom ? el('span', { class: 'chip chip-live', text: 'KATILDI' })
            : el('button', { class: 'btn btn-primary btn-sm', text: 'DAVET ET', onclick: (ev) => inviteFriend(f, ev.currentTarget) }),
        ]),
      ]));
    }
  }

  function renderChat() {
    const log = $('#lobbyChatLog');
    clear(log);
    for (const m of R.chat.slice(-80)) {
      if (m.sys) log.appendChild(el('div', { class: 'chat-msg sys', text: m.text }));
      else log.appendChild(el('div', { class: 'chat-msg' }, [
        el('b', { text: `${m.name} · ${w.U.fmtTime(m.at)}` }),
        el('span', { text: m.text }),
      ]));
    }
    log.scrollTop = log.scrollHeight;
  }

  function sysMsg(text) {
    R.chat.push({ sys: true, text, at: Date.now() });
    if (R.isHost) broadcastLobby();
    renderChat();
  }

  /* ================================================== ODA KURULUMU ===== */
  async function createRoom(localOnly, game) {
    R.game = GAMES[game] ? game : 'okey101';
    R.mode = 'lobby';
    R.isHost = true;
    R.local = !!localOnly;
    R.rules = defaultRules(R.game);
    R.players = new Array(spec().max).fill(null);
    R.players[0] = pub();
    R.hostId = me().id;
    R.mySeat = 0;
    R.chat = [];
    R.match = null;
    R.ciz = null;
    R.uno = null;

    if (!localOnly) {
      w.UI.netStatus('busy', 'Oda açılıyor');
      const code = await w.Net.openRoom();
      if (!code) {
        w.UI.toast('Oda açılamadı. İnternet bağlantını kontrol et.', 'err');
        w.UI.netStatus(w.Net.ready ? 'on' : 'off', w.Net.ready ? 'Çevrimiçi' : 'Çevrimdışı');
        return false;
      }
      R.code = code;
      w.UI.netStatus('on', 'Oda açık · ' + code);
      sysMsg(`Oda kuruldu. Kod: ${code}`);
    } else {
      R.code = null;
    }
    w.App.go('lobby');
    renderLobby();
    return true;
  }

  async function joinRoom(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!w.U.isCode(c)) { w.UI.toast('Oda kodu 6 karakter olmalı', 'err'); return false; }

    w.UI.netStatus('busy', 'Odaya bağlanılıyor');
    const res = await w.Net.joinRoom(c);
    if (!res.ok) {
      w.UI.toast(res.reason || 'Odaya bağlanılamadı', 'err');
      w.UI.netStatus(w.Net.ready ? 'on' : 'off', w.Net.ready ? 'Çevrimiçi' : 'Çevrimdışı');
      return false;
    }
    R.mode = 'lobby'; R.isHost = false; R.local = false; R.code = c;
    R.match = null; R.ciz = null; R.uno = null;
    w.UI.netStatus('on', 'Odada · ' + c);
    w.App.go('lobby');
    w.SFX.play('join');
    return true;
  }

  function leave(toLobby) {
    stopTimers();
    if (R.isHost) {
      if (!R.local) { w.Net.broadcast({ t: 'kick', reason: 'Oda kapandı' }); w.Net.closeRoom(); }
    } else {
      w.Net.leaveRoom();
    }
    R.mode = 'idle'; R.isHost = false; R.local = false; R.code = null;
    R.players = []; R.match = null; R.ciz = null; R.uno = null; R.chat = [];
    w.OkeyTable.reset();
    w.CizGame.reset();
    w.UnoTable.reset();
    w.UI.closeModal();
    w.UI.netStatus(w.Net.ready ? 'on' : 'off', w.Net.ready ? 'Çevrimiçi' : 'Çevrimdışı');
    w.App.go(toLobby ? 'games' : 'home');
  }

  function addBot(seat) {
    if (!R.isHost) return;
    if (filled() >= spec().max) return;
    R.players[seat] = makeBot(seat);
    w.SFX.play('join');
    sysMsg(`${R.players[seat].name} masaya oturdu (bot)`);
    broadcastLobby(); renderLobby();
  }

  function kickSeat(seat) {
    if (!R.isHost) return;
    const p = R.players[seat];
    if (!p || p.id === me().id) return;
    R.players[seat] = null;
    if (!p.isBot && !R.local) w.Net.kick(p.id, 'Oda kurucusu seni çıkardı');
    sysMsg(`${p.name} masadan kalktı`);
    w.SFX.play('leave');
    broadcastLobby(); renderLobby();
  }

  async function inviteFriend(friend, btn) {
    if (!R.code) { w.UI.toast('Önce çevrimiçi bir oda kurmalısın', 'warn'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'GÖNDERİLDİ'; }
    const reply = await w.Net.sendInvite(friend.id, R.code, R.game);
    if (reply && reply.accepted) w.UI.toast(`${friend.name} daveti kabul etti`, 'ok');
    else if (reply) w.UI.toast(`${friend.name} daveti reddetti`, 'warn');
    else w.UI.toast(`${friend.name} yanıt vermedi`, 'warn');
    setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'DAVET ET'; } }, 3500);
  }

  function sendChat(text) {
    const t = String(text || '').trim().slice(0, 160);
    if (!t) return;
    if (R.isHost) {
      R.chat.push({ name: me().name, from: me().id, text: t, at: Date.now() });
      broadcastLobby(); renderChat();
    } else {
      w.Net.toHost({ t: 'chat', text: t });
    }
    w.SFX.play('chat');
  }

  /* ================================================ HOST YAYINLARI ===== */
  function lobbyPayload() {
    return {
      t: 'lobby',
      code: R.code, hostId: R.hostId, game: R.game,
      players: R.players.map((p) => (p ? { id: p.id, name: p.name, color: p.color, isBot: p.isBot, connected: p.connected } : null)),
      rules: R.rules,
      chat: R.chat.slice(-60),
      inGame: R.mode === 'game',
    };
  }
  function broadcastLobby() {
    if (!R.isHost || R.local) return;
    w.Net.broadcast(lobbyPayload());
  }
  function applyLobbyPayload(p) {
    R.code = p.code; R.hostId = p.hostId;
    R.game = GAMES[p.game] ? p.game : 'okey101';
    R.players = p.players || [];
    R.rules = p.rules || defaultRules(R.game);
    R.chat = p.chat || [];
    R.mySeat = R.players.findIndex((x) => x && x.id === me().id);
    renderLobby();
  }

  /* ==================================================== OYUN BAŞLAT ==== */
  function startGame() {
    if (!R.isHost) return;
    const g = spec();

    /* sabit masa: boşları botla doldur. esnek masa: azsa birkaç bot ekle */
    if (g.fixed) {
      for (let i = 0; i < g.max; i++) if (!R.players[i]) R.players[i] = makeBot(i);
    } else if (filled() < g.min) {
      for (let i = 0; i < g.botFill && filled() < g.botFill; i++) if (!R.players[i]) R.players[i] = makeBot(i);
    }

    /* koltukları sıkıştır: motorlar boşluksuz dizi bekler */
    R.players = R.players.filter(Boolean);
    R.mySeat = R.players.findIndex((p) => p.id === me().id);
    R.mode = 'game';

    if (!R.local) w.Net.broadcast({ t: 'start', game: R.game, players: R.players });

    if (R.game === 'ciz') cizStart();
    else if (R.game === 'uno') unoStart();
    else okeyStart();
  }

  /* ===================================================== 101 OKEY ====== */
  function okeyStart() {
    R.match = E.createMatch(R.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })), R.rules);
    R.match.players.forEach((mp, i) => { mp.color = R.players[i].color; });
    okeyBeginRound();
  }

  function okeyBeginRound() {
    E.startRound(R.match, w.U.randSeed());
    R.match.round.turnEndsAt = okeyDeadline();
    w.App.go('okey');
    w.OkeyTable.mount();
    okeyPush();
    w.OkeyTable.banner(`${R.match.round.no}. EL`, 'BAŞLADI');
    startTimers();
    scheduleBot();
  }

  const okeyDeadline = () => (R.rules.turnSeconds ? Date.now() + R.rules.turnSeconds * 1000 : null);

  function okeyView(seat) {
    const m = R.match, rd = m.round;
    return {
      roundNo: rd.no, rules: R.rules, indicatorId: rd.indicatorId, okey: rd.okey,
      pileLeft: rd.pile.length, turn: rd.turn, phase: rd.phase, lastChance: rd.lastChance,
      turnSeconds: R.rules.turnSeconds, turnEndsAt: rd.turnEndsAt,
      mySeat: seat, finished: rd.finished,
      seats: rd.seats.map((S, i) => ({
        seat: i, id: m.players[i].id, name: m.players[i].name,
        color: R.players[i] ? R.players[i].color : 0, isBot: m.players[i].isBot,
        connected: R.players[i] ? R.players[i].connected !== false : true,
        score: m.players[i].score, handCount: S.hand.length,
        opened: S.opened, openType: S.openType, penalty: S.penalty,
        discards: S.discards.slice(),
        melds: S.melds.map((x) => ({ mid: x.mid, type: x.type, tiles: x.tiles.slice(), points: x.points })),
      })),
      myHand: rd.seats[seat].hand.slice(),
    };
  }

  function okeyPush(justDrawn) {
    if (!R.match || !R.match.round) return;
    const mine = okeyView(R.mySeat);
    if (justDrawn !== undefined && justDrawn !== null) mine.justDrawn = justDrawn;
    w.OkeyTable.render(mine);
    if (R.local) return;
    R.players.forEach((p, seat) => {
      if (!p || p.isBot || p.id === me().id) return;
      w.Net.toPlayer(p.id, { t: 'game', game: 'okey101', view: okeyView(seat) });
    });
  }

  function emitEvent(ev) {
    w.OkeyTable.playEvent(ev);
    if (!R.local) w.Net.broadcast({ t: 'event', game: 'okey101', ev });
  }

  function okeyAction(seat, a) {
    const rd = R.match && R.match.round;
    if (!rd) return { ok: false, reason: 'Oyun yok' };
    if (rd.finished) return { ok: false, reason: 'El bitti' };
    const name = R.players[seat] ? R.players[seat].name : '?';
    let res;

    switch (a.t) {
      case 'drawPile':
        res = E.drawFromPile(rd, seat);
        if (res.ok) emitEvent({ t: 'draw', seat, from: 'pile', name });
        break;
      case 'drawDiscard':
        res = E.drawFromDiscard(rd, seat);
        if (res.ok) emitEvent({ t: 'draw', seat, from: 'discard', tile: res.tile, name });
        break;
      case 'pass':
        res = E.passLastChance(rd, seat);
        break;
      case 'open':
        res = E.openHand(rd, seat, a.groups);
        if (res.ok) emitEvent({ t: 'open', seat, name, mode: res.mode, points: res.points, count: res.melds });
        break;
      case 'lay': {
        const groups = a.groups || (a.tiles ? [a.tiles] : []);
        res = { ok: false, reason: 'Per yok' };
        for (const g of groups) {
          const r = E.layMeld(rd, seat, g);
          if (r.ok) { res = r; emitEvent({ t: 'lay', seat, name }); }
          else if (groups.length === 1) res = r;
        }
        break;
      }
      case 'add':
        res = E.addToMeld(rd, seat, a.mid, a.tile);
        if (res.ok) emitEvent({ t: 'add', seat, name, mid: a.mid, tile: a.tile });
        break;
      case 'discard':
        res = E.discard(rd, seat, a.tile, true);
        if (res.ok) emitEvent({ t: 'discard', seat, tile: a.tile, name });
        break;
      default:
        res = { ok: false, reason: 'Bilinmeyen hamle' };
    }

    if (!res || !res.ok) return res || { ok: false, reason: 'Hata' };
    if (res.finished) { okeyFinishRound(); return res; }

    if (a.t === 'discard') {
      rd.turnEndsAt = okeyDeadline();
      emitEvent({ t: 'turn', seat: rd.turn, name: R.players[rd.turn] ? R.players[rd.turn].name : '' });
    }
    okeyPush(a.t === 'drawPile' || a.t === 'drawDiscard' ? res.tile : null);
    scheduleBot();
    return res;
  }

  const isAutoSeat = (seat) => {
    const p = R.players[seat];
    return !!p && (p.isBot || p.connected === false);
  };

  function scheduleBot() {
    clearTimeout(R.botTimer);
    if (!R.isHost || R.game !== 'okey101') return;
    const rd = R.match && R.match.round;
    if (!rd || rd.finished || !isAutoSeat(rd.turn)) return;
    R.botTimer = setTimeout(() => runBotStep(1), w.OkeyBot.thinkMs(1, rd.phase === 'draw' ? 'draw' : 'act'));
  }

  function runBotStep(level) {
    const rd = R.match && R.match.round;
    if (!rd || rd.finished) return;
    const seat = rd.turn;
    if (!isAutoSeat(seat)) return;

    if (rd.phase === 'draw') {
      const d = w.OkeyBot.decideDraw(rd, seat, level);
      if (d === 'pass') okeyAction(seat, { t: 'pass' });
      else if (d === 'discard') okeyAction(seat, { t: 'drawDiscard' });
      else okeyAction(seat, { t: 'drawPile' });
      if (R.match.round && !R.match.round.finished && R.match.round.turn === seat) {
        R.botTimer = setTimeout(() => runBotStep(level), w.OkeyBot.thinkMs(level, 'act'));
      }
      return;
    }

    const steps = w.OkeyBot.planActions(rd, seat, level);
    let i = 0;
    const next = () => {
      if (!R.match || !R.match.round || R.match.round.finished) return;
      if (i >= steps.length) return;
      const s = steps[i++];
      const r = okeyAction(seat, s);
      if (!r || !r.ok) {
        if (s.t !== 'discard' && R.match.round.turn === seat && R.match.round.phase === 'act') {
          okeyAction(seat, { t: 'discard', tile: w.OkeyBot.pickDiscard(R.match.round, seat, level), force: true });
        }
        return;
      }
      if (i < steps.length) setTimeout(next, 320);
    };
    next();
  }

  function okeyFinishRound() {
    const rd = R.match.round;
    const applied = E.applyResult(R.match);
    stopTimers();
    okeyPush();

    const seatsInfo = R.match.players.map((p, i) => ({
      seat: i, name: p.name, score: p.score, id: p.id, color: R.players[i] ? R.players[i].color : 0,
    }));
    w.Store.bumpStat('okey101', 'played', 1);
    if (rd.result.winnerSeat === R.mySeat) w.Store.bumpStat('okey101', 'won', 1);

    if (!R.local) {
      w.Net.broadcast({ t: 'result', game: 'okey101', result: rd.result, seats: seatsInfo,
        over: applied.over, match: applied.over ? matchPayload() : null });
    }
    if (applied.over) setTimeout(() => w.OkeyTable.showMatchOver(matchPayload(), R.mySeat), 700);
    else setTimeout(() => w.OkeyTable.showResult(rd.result, seatsInfo, () => nextRound(), true), 700);
  }

  const matchPayload = () => ({
    winner: R.match.winner,
    players: R.match.players.map((p, i) => ({ seat: i, name: p.name, score: p.score, roundsWon: p.roundsWon })),
  });

  function nextRound() {
    if (!R.isHost) return;
    w.UI.closeModal();
    if (!R.local) w.Net.broadcast({ t: 'nextRound' });
    okeyBeginRound();
  }

  function startTimers() {
    stopTimers();
    R.tickTimer = setInterval(okeyTick, 900);
  }

  function okeyTick() {
    if (!R.isHost || R.game !== 'okey101') return;
    const rd = R.match && R.match.round;
    if (!rd || rd.finished || !rd.turnEndsAt || Date.now() < rd.turnEndsAt) return;
    if (isAutoSeat(rd.turn)) { rd.turnEndsAt = okeyDeadline(); return; }

    const seat = rd.turn;
    if (rd.phase === 'draw') {
      if (rd.lastChance) okeyAction(seat, { t: 'pass' });
      else okeyAction(seat, { t: 'drawPile' });
    }
    if (R.match.round && !R.match.round.finished && R.match.round.turn === seat && R.match.round.phase === 'act') {
      okeyAction(seat, { t: 'discard', tile: w.OkeyBot.pickDiscard(R.match.round, seat, 1), force: true });
      if (seat === R.mySeat) w.UI.toast('Süren doldu, otomatik oynandı', 'warn');
    }
  }

  /* ================================================== ÇİZ BABACIM ===== */
  function cizStart() {
    R.ciz = C.createGame(R.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot })), R.rules);
    C.beginRound(R.ciz);
    w.App.go('ciz');
    w.CizGame.mount();
    cizPush();
    w.CizGame.banner('ÇİZ BABACIM', 'BİR CÜMLE YAZ');
    startCizTimer();
    scheduleCizBots();
  }

  function cizPush() {
    if (!R.ciz) return;
    w.CizGame.render(C.viewFor(R.ciz, R.mySeat));
    if (R.local) return;
    R.players.forEach((p, seat) => {
      if (!p || p.isBot || p.id === me().id) return;
      w.Net.toPlayer(p.id, { t: 'game', game: 'ciz', view: C.viewFor(R.ciz, seat) });
    });
  }

  function cizAction(seat, a) {
    if (!R.ciz) return { ok: false, reason: 'Oyun yok' };

    if (a.t === 'submit') {
      const res = C.submit(R.ciz, seat, a.round, a.value);
      if (!res.ok) return res;
      cizPush();
      if (res.allDone) {
        /* Süre dolması da tur atlatabilir; ikisi çakışıp turu iki kez
           atlamasın diye beklerken turun değişmediğini doğrula. */
        const at = R.ciz.round;
        setTimeout(() => {
          if (R.ciz && R.ciz.phase === 'play' && R.ciz.round === at) cizAdvance();
        }, 700);
      }
      return res;
    }
    if (a.t === 'presentNext') {
      if (seat !== R.mySeat || !R.isHost) return { ok: false, reason: 'Sadece oda kurucusu' };
      C.presentNext(R.ciz);
      cizPush();
      if (R.ciz.phase === 'done') w.Store.bumpStat('ciz', 'played', 1);
      return { ok: true };
    }
    return { ok: false, reason: 'Bilinmeyen hamle' };
  }

  function cizAdvance() {
    if (!R.ciz || R.ciz.phase !== 'play') return;
    clearCizBotTimers();
    const before = R.ciz.round;
    const r = C.advance(R.ciz);
    cizPush();
    if (r.phase === 'present') {
      w.CizGame.banner('ALBÜM', 'HAZIR');
      w.SFX.play('win');
      stopTimers();
    } else {
      const type = C.roundType(R.ciz.round);
      w.CizGame.banner(`${R.ciz.round + 1}. TUR`, type === 'draw' ? 'ÇİZ' : 'TAHMİN ET');
      w.SFX.play('turn');
      scheduleCizBots();
    }
    return before;
  }

  function startCizTimer() {
    stopTimers();
    R.tickTimer = setInterval(() => {
      if (!R.isHost || !R.ciz || R.ciz.phase !== 'play') return;
      if (!R.ciz.deadline || Date.now() < R.ciz.deadline) return;
      C.fillMissing(R.ciz);
      cizAdvance();
    }, 700);
  }

  function clearCizBotTimers() {
    for (const t of R.cizBotTimers) clearTimeout(t);
    R.cizBotTimers = [];
  }

  function scheduleCizBots() {
    clearCizBotTimers();
    if (!R.isHost || !R.ciz || R.ciz.phase !== 'play') return;
    const round = R.ciz.round;
    const type = C.roundType(round);

    R.players.forEach((p, seat) => {
      if (!p || (!p.isBot && p.connected !== false)) return;
      const wait = Math.min(w.CizBot.thinkMs(type), (C.secondsFor(R.ciz, round) - 3) * 1000);
      R.cizBotTimers.push(setTimeout(() => {
        if (!R.ciz || R.ciz.phase !== 'play' || R.ciz.round !== round) return;
        const seed = (seat * 7919 + round * 104729 + Date.now()) >>> 0;
        const value = type === 'text' ? w.CizBot.text(seed, round === 0) : w.CizBot.drawing(seed);
        cizAction(seat, { t: 'submit', round, value });
      }, Math.max(1200, wait)));
    });
  }

  /* ========================================================= UNO ======= */
  function unoStart() {
    R.uno = N.createGame(
      R.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot })),
      R.rules
    );
    w.App.go('uno');
    w.UnoTable.mount();
    unoBeginRound();
  }

  function unoBeginRound() {
    N.startRound(R.uno, w.U.randSeed());
    unoPush();
    w.UnoTable.banner(`${R.uno.round.no}. EL`, 'BAŞLADI');
    startUnoTimer();
    scheduleUnoBot();
  }

  function unoPush() {
    if (!R.uno || !R.uno.round) return;
    w.UnoTable.render(N.viewFor(R.uno, R.mySeat));
    if (R.local) return;
    R.players.forEach((p, seat) => {
      if (!p || p.isBot || p.id === me().id) return;
      w.Net.toPlayer(p.id, { t: 'game', game: 'uno', view: N.viewFor(R.uno, seat) });
    });
  }

  function unoEvent(ev) {
    w.UnoTable.playEvent(ev);
    if (!R.local) w.Net.broadcast({ t: 'event', game: 'uno', ev });
  }

  const unoName = (seat) => (R.players[seat] ? R.players[seat].name : '?');

  function unoAction(seat, a) {
    if (!R.uno || !R.uno.round) return { ok: false, reason: 'Oyun yok' };
    const rd = R.uno.round;
    let res;

    switch (a.t) {
      case 'play':
        res = N.playCard(R.uno, seat, a.card, a.color);
        break;
      case 'color':
        res = N.chooseColor(R.uno, seat, a.color);
        break;
      case 'draw':
        res = N.draw(R.uno, seat);
        break;
      case 'pass':
        res = N.pass(R.uno, seat);
        break;
      case 'uno':
        res = N.callUno(R.uno, seat);
        if (res.ok) unoEvent({ t: 'uno', seat, name: unoName(seat) });
        break;
      case 'catchUno':
        res = N.catchUno(R.uno, seat, a.target);
        if (res.ok) unoEvent({ t: 'caught', seat: a.target, name: unoName(a.target), by: unoName(seat), penalty: res.penalty });
        break;
      case 'challenge': {
        res = N.resolveChallenge(R.uno, seat, !!a.challenge);
        if (res.ok) {
          const o = res.outcome;
          unoEvent({
            t: 'challenge', challenged: o.challenged, bluff: !!o.bluff, drew: o.drew,
            name: unoName(o.bluff ? o.by : o.target),
          });
        }
        break;
      }
      default:
        res = { ok: false, reason: 'Bilinmeyen hamle' };
    }

    if (!res || !res.ok) return res || { ok: false, reason: 'Hata' };

    if (res.finished) { unoFinishRound(); return res; }

    unoPush();
    scheduleUnoBot();
    return res;
  }

  const unoAutoSeat = (seat) => {
    const p = R.players[seat];
    return !!p && (p.isBot || p.connected === false);
  };

  function clearUnoTimers() {
    for (const t of R.unoTimers) clearTimeout(t);
    R.unoTimers = [];
  }

  /** Botların hamlesini ve "UNO yakalama" davranışını planla. */
  function scheduleUnoBot() {
    clearUnoTimers();
    if (!R.isHost || !R.uno || !R.uno.round || R.uno.round.finished) return;
    const rd = R.uno.round;
    const level = 1;

    /* UNO demeyi unutanı botlar yakalasın */
    if (rd.unoPending) {
      const victim = rd.unoPending.seat;
      R.players.forEach((p, seat) => {
        if (!p || seat === victim || !unoAutoSeat(seat)) return;
        const delay = w.UnoBot.catchDelay(level);
        if (delay === null) return;
        R.unoTimers.push(setTimeout(() => {
          if (!R.uno || !R.uno.round || !R.uno.round.unoPending) return;
          if (R.uno.round.unoPending.seat !== victim) return;
          unoAction(seat, { t: 'catchUno', target: victim });
        }, delay));
      });
    }

    /* Joker+4 itirazı bir bottaysa karar versin */
    if (rd.phase === 'challenge' && rd.challenge && unoAutoSeat(rd.challenge.target)) {
      const target = rd.challenge.target;
      R.unoTimers.push(setTimeout(() => {
        if (!R.uno || !R.uno.round || R.uno.round.phase !== 'challenge') return;
        const view = N.viewFor(R.uno, target);
        unoAction(target, { t: 'challenge', challenge: w.UnoBot.shouldChallenge(view, level) });
      }, w.UnoBot.thinkMs(level, 'challenge')));
      return;
    }

    /* renk seçimi bir bottaysa */
    if (rd.phase === 'color' && rd.pendingWild && unoAutoSeat(rd.pendingWild.seat)) {
      const seat = rd.pendingWild.seat;
      R.unoTimers.push(setTimeout(() => {
        if (!R.uno || !R.uno.round || R.uno.round.phase !== 'color') return;
        unoAction(seat, { t: 'color', color: w.UnoBot.pickColor(R.uno.round.hands[seat], level) });
      }, w.UnoBot.thinkMs(level, 'color')));
      return;
    }

    if (rd.phase !== 'play' || !unoAutoSeat(rd.turn)) return;

    const seat = rd.turn;
    R.unoTimers.push(setTimeout(() => runUnoBotTurn(seat, level), w.UnoBot.thinkMs(level, 'play')));
  }

  function runUnoBotTurn(seat, level) {
    if (!R.uno || !R.uno.round || R.uno.round.finished) return;
    const rd = R.uno.round;
    if (rd.phase !== 'play' || rd.turn !== seat) return;

    const view = N.viewFor(R.uno, seat);
    const choice = w.UnoBot.pickCard(view, level);

    if (choice === null) {
      const d = unoAction(seat, { t: 'draw' });
      if (!d || !d.ok) return;
      if (d.playable) {
        /* çekilen kart oynanabiliyorsa çoğu zaman oynanır */
        R.unoTimers.push(setTimeout(() => {
          if (!R.uno || !R.uno.round || R.uno.round.turn !== seat || R.uno.round.phase !== 'play') return;
          const v2 = N.viewFor(R.uno, seat);
          const pick = w.UnoBot.pickCard(v2, level);
          if (pick === null) { unoAction(seat, { t: 'pass' }); return; }
          botPlay(seat, pick, level);
        }, 700));
      }
      return;
    }
    botPlay(seat, choice, level);
  }

  function botPlay(seat, cardId, level) {
    const rd = R.uno.round;
    const card = N.cardById(cardId);
    /* son ikinci kartı oynarken UNO de (acemi bot unutabilir) */
    if (rd.hands[seat].length === 2 && !w.UnoBot.forgetsUno(level)) {
      unoAction(seat, { t: 'uno' });
    }
    const color = N.isWild(card) ? w.UnoBot.pickColor(rd.hands[seat].filter((x) => x !== cardId), level) : undefined;
    unoAction(seat, { t: 'play', card: cardId, color });
  }

  function startUnoTimer() {
    stopTimers();
    R.tickTimer = setInterval(unoTick, 600);
  }

  function unoTick() {
    if (!R.isHost || !R.uno || !R.uno.round || R.uno.round.finished) return;
    const rd = R.uno.round;

    /* Güvenlik ağı: sıra bir bota (ya da düşmüş oyuncuya) ait olduğu hâlde
       bekleyen zamanlayıcı yoksa oyun kilitlenmesin diye yeniden kur.
       Süre sınırsızken bir oyuncunun tam sırasında düşmesi bu duruma yol açar. */
    if (!R.unoTimers.length) {
      const needsBot =
        (rd.phase === 'play' && unoAutoSeat(rd.turn)) ||
        (rd.phase === 'color' && rd.pendingWild && unoAutoSeat(rd.pendingWild.seat)) ||
        (rd.phase === 'challenge' && rd.challenge && unoAutoSeat(rd.challenge.target));
      if (needsBot) { scheduleUnoBot(); return; }
    }

    /* UNO yakalama penceresi kapandı mı */
    if (N.expireUno(R.uno)) unoPush();

    /* itiraz süresi doldu -> itiraz edilmemiş sayılır */
    if (rd.phase === 'challenge' && rd.challenge && Date.now() > rd.challenge.until) {
      const res = N.autoResolveChallenge(R.uno);
      if (res && res.ok) {
        unoEvent({ t: 'challenge', challenged: false, bluff: false, drew: res.outcome.drew, name: unoName(res.outcome.target) });
        if (R.uno.round.finished) { unoFinishRound(); return; }
        unoPush(); scheduleUnoBot();
      }
      return;
    }

    /* tur süresi doldu -> otomatik oyna */
    if (rd.phase !== 'play' || !rd.turnEndsAt || Date.now() < rd.turnEndsAt) return;
    if (unoAutoSeat(rd.turn)) return;   // botun kendi zamanlayıcısı var

    const seat = rd.turn;
    if (!rd.hasDrawn) {
      const d = unoAction(seat, { t: 'draw' });
      if (d && d.ok && d.playable) unoAction(seat, { t: 'pass' });
    } else {
      unoAction(seat, { t: 'pass' });
    }
    if (seat === R.mySeat) w.UI.toast('Süren doldu, kart çekildi', 'warn');
  }

  function unoFinishRound() {
    const rd = R.uno.round;
    const applied = N.applyResult(R.uno);
    stopTimers();
    unoPush();

    const players = R.uno.players.map((p) => ({
      seat: p.seat, name: p.name, score: p.score, roundsWon: p.roundsWon,
      id: p.id, color: p.color,
    }));

    w.Store.bumpStat('uno', 'played', 1);
    if (rd.result.winnerSeat === R.mySeat) w.Store.bumpStat('uno', 'won', 1);

    if (!R.local) {
      w.Net.broadcast({
        t: 'result', game: 'uno', result: rd.result, seats: players,
        over: applied.over, match: applied.over ? unoMatchPayload() : null,
      });
    }
    if (applied.over) setTimeout(() => w.UnoTable.showMatchOver(unoMatchPayload(), R.mySeat), 800);
    else setTimeout(() => w.UnoTable.showResult(rd.result, players, () => unoNextRound(), true), 800);
  }

  const unoMatchPayload = () => ({
    winner: R.uno.winner,
    players: R.uno.players.map((p) => ({ seat: p.seat, name: p.name, score: p.score, roundsWon: p.roundsWon })),
  });

  function unoNextRound() {
    if (!R.isHost) return;
    w.UI.closeModal();
    if (!R.local) w.Net.broadcast({ t: 'nextRound' });
    unoBeginRound();
  }

  function stopTimers() {
    clearInterval(R.tickTimer); R.tickTimer = null;
    clearTimeout(R.botTimer); R.botTimer = null;
    clearCizBotTimers();
    clearUnoTimers();
  }

  /* ================================================ AĞ OLAY BAĞLARI ==== */
  function wireNet() {
    w.Net.handlers.onPlayerJoin = () => { /* 'join' mesajı beklenir */ };

    w.Net.handlers.onPlayerLeave = (code) => {
      if (!R.isHost) return;
      const seat = R.players.findIndex((p) => p && p.id === code);
      if (seat === -1) return;
      if (R.mode === 'game') {
        R.players[seat].connected = false;
        sysMsg(`${R.players[seat].name} bağlantısı koptu, yerine bot oynuyor`);
        if (R.game === 'ciz') { cizPush(); scheduleCizBots(); }
        else if (R.game === 'uno') { unoPush(); scheduleUnoBot(); }
        else { okeyPush(); scheduleBot(); }
      } else {
        const name = R.players[seat].name;
        R.players[seat] = null;
        sysMsg(`${name} odadan ayrıldı`);
        w.SFX.play('leave');
        broadcastLobby(); renderLobby();
      }
    };

    w.Net.handlers.onRoomMessage = (from, msg, conn) => {
      if (!R.isHost) return;
      switch (msg.t) {
        case 'join': {
          const p = msg.profile || {};
          const old = R.players.findIndex((x) => x && x.id === from);
          if (old !== -1) {
            R.players[old].connected = true;
            R.players[old].name = p.name || R.players[old].name;
            sysMsg(`${R.players[old].name} geri döndü`);
            conn.send(lobbyPayload());
            if (R.mode === 'game') {
              conn.send({ t: 'start', game: R.game, players: R.players });
              const view = R.game === 'ciz' ? C.viewFor(R.ciz, old)
                : R.game === 'uno' ? N.viewFor(R.uno, old) : okeyView(old);
              w.Net.toPlayer(from, { t: 'game', game: R.game, view });
            }
            broadcastLobby(); renderLobby();
            return;
          }
          if (R.mode === 'game') { conn.send({ t: 'kick', reason: 'Oyun çoktan başladı' }); return; }
          if (filled() >= spec().max) { conn.send({ t: 'kick', reason: 'Masa dolu' }); return; }
          let seat = R.players.findIndex((x) => !x);
          if (seat === -1) { seat = R.players.length; R.players.push(null); }
          R.players[seat] = { id: from, name: p.name || from, color: p.color || 0, isBot: false, connected: true };
          sysMsg(`${R.players[seat].name} masaya oturdu`);
          w.SFX.play('join');
          broadcastLobby(); renderLobby();
          break;
        }
        case 'chat': {
          const seat = R.players.findIndex((x) => x && x.id === from);
          if (seat === -1) return;
          R.chat.push({ name: R.players[seat].name, from, text: String(msg.text || '').slice(0, 160), at: Date.now() });
          broadcastLobby(); renderChat(); w.SFX.play('chat');
          break;
        }
        case 'action': {
          const seat = R.players.findIndex((x) => x && x.id === from);
          if (seat === -1) return;
          const res = R.game === 'ciz' ? cizAction(seat, msg.action || {})
            : R.game === 'uno' ? unoAction(seat, msg.action || {})
            : okeyAction(seat, msg.action || {});
          if (!res || !res.ok) w.Net.toPlayer(from, { t: 'error', msg: (res && res.reason) || 'Geçersiz hamle' });
          break;
        }
        case 'leave':
          w.Net.handlers.onPlayerLeave(from);
          break;
        default: break;
      }
    };

    w.Net.handlers.onHostMessage = (msg) => {
      switch (msg.t) {
        case 'lobby':
          applyLobbyPayload(msg);
          break;
        case 'start':
          R.mode = 'game';
          R.game = GAMES[msg.game] ? msg.game : R.game;
          if (Array.isArray(msg.players)) {
            R.players = msg.players;
            R.mySeat = R.players.findIndex((p) => p && p.id === me().id);
          }
          if (R.game === 'ciz') { w.App.go('ciz'); w.CizGame.mount(); }
          else if (R.game === 'uno') { w.App.go('uno'); w.UnoTable.mount(); }
          else { w.App.go('okey'); w.OkeyTable.mount(); }
          break;
        case 'game': {
          R.mode = 'game';
          R.game = GAMES[msg.game] ? msg.game : 'okey101';
          R.mySeat = msg.view.mySeat;
          const target = GAMES[R.game].view;
          const mountFn = R.game === 'ciz' ? w.CizGame.mount
            : R.game === 'uno' ? w.UnoTable.mount : w.OkeyTable.mount;
          if (!document.querySelector(`.view[data-view="${target}"]`).classList.contains('active')) {
            w.App.go(target);
            mountFn();
          }
          if (R.game === 'ciz') w.CizGame.render(msg.view);
          else if (R.game === 'uno') w.UnoTable.render(msg.view);
          else w.OkeyTable.render(msg.view);
          break;
        }
        case 'event':
          if (msg.game === 'uno') w.UnoTable.playEvent(msg.ev);
          else if (msg.game !== 'ciz') w.OkeyTable.playEvent(msg.ev);
          break;
        case 'result': {
          const tbl = msg.game === 'uno' ? w.UnoTable : w.OkeyTable;
          if (msg.over && msg.match) setTimeout(() => tbl.showMatchOver(msg.match, R.mySeat), 800);
          else setTimeout(() => tbl.showResult(msg.result, msg.seats, null, false), 800);
          break;
        }
        case 'nextRound':
          w.UI.closeModal();
          break;
        case 'error':
          w.UI.toast(msg.msg || 'Hata', 'err');
          break;
        case 'kick':
          w.UI.toast(msg.reason || 'Odadan çıkarıldın', 'warn');
          leave(false);
          break;
        default: break;
      }
    };

    w.Net.handlers.onHostGone = () => {
      if (R.isHost || R.mode === 'idle') return;
      w.UI.toast('Oda kurucusunun bağlantısı koptu', 'err');
      leave(false);
    };
  }

  /* =================================================== DIŞ ARAYÜZ ===== */
  function sendAction(action) {
    if (R.isHost) {
      const res = R.game === 'ciz' ? cizAction(R.mySeat, action)
        : R.game === 'uno' ? unoAction(R.mySeat, action)
        : okeyAction(R.mySeat, action);
      if (!res || !res.ok) w.UI.toast((res && res.reason) || 'Geçersiz hamle', 'err');
    } else {
      w.Net.toHost({ t: 'action', action });
    }
  }

  w.Room = {
    GAMES, createRoom, joinRoom, leave, startGame, addBot, kickSeat, sendChat, sendAction,
    renderLobby, renderInviteList, wireNet, nextRound,
    get state() { return R; },
    get isHost() { return R.isHost; },
    get mode() { return R.mode; },
    get code() { return R.code; },
    get game() { return R.game; },
  };
})(window);
