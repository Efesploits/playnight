/* =============================================================================
 *  PLAY NIGHT — AĞ KATMANI
 *
 *  Port açmaya gerek yok:
 *   - Eşleştirme (signaling) için PeerJS bulut aracısı kullanılır.
 *   - Veri doğrudan eşler arası WebRTC DataChannel üzerinden akar (STUN ile
 *     NAT delinir). Zor ağlarda ücretsiz TURN sunucuları devreye girer.
 *
 *  İki peer kimliği vardır:
 *   - Kişisel:  pn-<id>    (arkadaş isteği, davet, çevrimiçi yoklaması)
 *   - Oda:      pnr-<kod>  (yalnızca oda kuran açar, oyuncular buraya bağlanır)
 * ========================================================================== */
(function (w) {
  'use strict';

  const DEFAULT_ICE = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ];

  const selfIdOf = (code) => 'pn-' + String(code).toLowerCase();
  const roomIdOf = (code) => 'pnr-' + String(code).toLowerCase();
  const codeFromSelfId = (pid) => String(pid || '').replace(/^pn-/, '').toUpperCase();

  /* ----------------------------------------------------------- durum --- */
  const state = {
    selfPeer: null,
    roomPeer: null,
    myCode: null,
    profile: null,
    ready: false,
    conns: new Map(),      // roomPeer üzerindeki oyuncu bağlantıları (host)
    hostConn: null,        // istemcinin host'a bağlantısı
    iceServers: DEFAULT_ICE,
    reconnectTries: 0,
  };

  const handlers = {
    onStatus: () => {},    // (state, label)
    onFriendRequest: () => {},
    onInvite: () => {},
    onRoomMessage: () => {},   // host: (fromCode, msg)   client: (msg)
    onPlayerJoin: () => {},
    onPlayerLeave: () => {},
    onHostMessage: () => {},
    onHostGone: () => {},
  };

  function peerOpts() {
    return { debug: 0, config: { iceServers: state.iceServers, sdpSemantics: 'unified-plan' } };
  }

  /* ============================================================ KİŞİSEL == */
  function init(profile, iceServers) {
    state.profile = profile;
    state.myCode = profile.id;
    if (Array.isArray(iceServers) && iceServers.length) state.iceServers = iceServers;

    return new Promise((resolve) => {
      let settled = false;
      const attempt = (tries) => {
        handlers.onStatus('busy', tries ? `Yeniden bağlanıyor (${tries})` : 'Bağlanıyor');
        let peer;
        try { peer = new w.Peer(selfIdOf(profile.id), peerOpts()); }
        catch (e) { handlers.onStatus('off', 'Bağlanamadı'); return resolve(false); }

        const bail = setTimeout(() => {
          if (settled) return;
          try { peer.destroy(); } catch {}
          if (tries < 3) attempt(tries + 1);
          else { handlers.onStatus('off', 'Çevrimdışı'); settled = true; resolve(false); }
        }, 12000);

        peer.on('open', () => {
          clearTimeout(bail);
          state.selfPeer = peer;
          state.ready = true;
          state.reconnectTries = 0;
          handlers.onStatus('on', 'Çevrimiçi');
          const cp = document.getElementById('connPeer');
          if (cp) cp.textContent = peer.id;
          if (!settled) { settled = true; resolve(true); }
        });

        peer.on('connection', (conn) => wireIncoming(conn));

        peer.on('disconnected', () => {
          if (state.ready) {
            handlers.onStatus('busy', 'Yeniden bağlanıyor');
            setTimeout(() => { try { peer.reconnect(); } catch {} }, 1200);
          }
        });

        peer.on('error', (err) => {
          const type = err && err.type;
          if (type === 'unavailable-id') {
            clearTimeout(bail);
            try { peer.destroy(); } catch {}
            if (tries < 4) { setTimeout(() => attempt(tries + 1), 2500); return; }
            handlers.onStatus('off', 'ID kullanımda');
            if (!settled) { settled = true; resolve(false); }
            return;
          }
          if (type === 'peer-unavailable') return; // normal: karşı taraf çevrimdışı
          if (type === 'network' || type === 'server-error' || type === 'socket-error') {
            handlers.onStatus('off', 'Sunucuya ulaşılamıyor');
            return;
          }
          console.warn('[net] peer error:', type, err);
        });
      };
      attempt(0);
    });
  }

  /** Kişisel peer'a gelen bağlantı: arkadaş isteği / davet / yoklama */
  function wireIncoming(conn) {
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      const from = codeFromSelfId(conn.peer);
      switch (msg.t) {
        case 'ping':
          safeSend(conn, { t: 'pong', profile: pubProfile(), busy: !!state.roomPeer });
          break;
        case 'freq':
          handlers.onFriendRequest(msg.profile || { id: from }, (accepted) => {
            safeSend(conn, { t: 'fack', accepted: !!accepted, profile: pubProfile() });
          });
          break;
        case 'invite':
          handlers.onInvite({ from, code: msg.code, game: msg.game, profile: msg.profile || { id: from } },
            (accepted) => safeSend(conn, { t: 'iack', accepted: !!accepted }));
          break;
        default: break;
      }
    });
    conn.on('error', () => {});
  }

  const pubProfile = () => ({
    id: state.profile ? state.profile.id : null,
    name: state.profile ? state.profile.name : '?',
    color: state.profile ? state.profile.color : 0,
  });

  function safeSend(conn, msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) { /* yut */ }
  }

  /**
   * Bir arkadaşın kişisel peer'ına kısa süreli bağlanıp mesaj gönderir.
   * @returns Promise<any|null>  cevap veya null (çevrimdışı / cevapsız)
   */
  function ask(friendCode, msg, timeoutMs) {
    return new Promise((resolve) => {
      if (!state.selfPeer || !state.ready) return resolve(null);
      let conn, done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        setTimeout(() => { try { conn && conn.close(); } catch {} }, 400);
        resolve(v);
      };
      const timer = setTimeout(() => finish(null), timeoutMs || 6000);
      try {
        conn = state.selfPeer.connect(selfIdOf(friendCode), { reliable: true });
      } catch { return finish(null); }
      conn.on('open', () => safeSend(conn, msg));
      conn.on('data', (reply) => finish(reply));
      conn.on('error', () => finish(null));
      conn.on('close', () => finish(null));
    });
  }

  const probe = (code) => ask(code, { t: 'ping', profile: pubProfile() }, 5500);
  const sendFriendRequest = (code) => ask(code, { t: 'freq', profile: pubProfile() }, 20000);
  const sendInvite = (code, roomCode, game) =>
    ask(code, { t: 'invite', code: roomCode, game: game || 'okey101', profile: pubProfile() }, 20000);

  /* =============================================================== ODA === */
  /** Oda aç (host). Kod çakışırsa yeni kod dener. */
  function openRoom() {
    return new Promise((resolve) => {
      const attempt = (tries) => {
        if (tries > 6) return resolve(null);
        const code = w.U.makeCode(6);
        let peer;
        try { peer = new w.Peer(roomIdOf(code), peerOpts()); }
        catch { return resolve(null); }

        const bail = setTimeout(() => { try { peer.destroy(); } catch {}; attempt(tries + 1); }, 12000);

        peer.on('open', () => {
          clearTimeout(bail);
          state.roomPeer = peer;
          state.conns.clear();
          resolve(code);
        });

        peer.on('connection', (conn) => {
          const from = codeFromSelfId(conn.peer);
          conn.on('open', () => {
            state.conns.set(from, conn);
            handlers.onPlayerJoin(from, conn);
          });
          conn.on('data', (msg) => {
            if (msg && typeof msg === 'object') handlers.onRoomMessage(from, msg, conn);
          });
          const drop = () => {
            if (state.conns.get(from) === conn) {
              state.conns.delete(from);
              handlers.onPlayerLeave(from);
            }
          };
          conn.on('close', drop);
          conn.on('error', drop);
        });

        peer.on('error', (err) => {
          const type = err && err.type;
          if (type === 'unavailable-id') {
            clearTimeout(bail);
            try { peer.destroy(); } catch {}
            attempt(tries + 1);
          } else if (type !== 'peer-unavailable') {
            console.warn('[net] room error:', type);
          }
        });
      };
      attempt(0);
    });
  }

  function closeRoom() {
    for (const [, c] of state.conns) { try { c.close(); } catch {} }
    state.conns.clear();
    if (state.roomPeer) { try { state.roomPeer.destroy(); } catch {} state.roomPeer = null; }
  }

  /** Odaya katıl (istemci). */
  function joinRoom(code) {
    return new Promise((resolve) => {
      if (!state.selfPeer || !state.ready) return resolve({ ok: false, reason: 'Bağlantı yok' });
      let conn, done = false;
      const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
      const timer = setTimeout(() => {
        try { conn && conn.close(); } catch {}
        finish({ ok: false, reason: 'Oda bulunamadı ya da yanıt vermiyor' });
      }, 15000);

      try {
        conn = state.selfPeer.connect(roomIdOf(code), { reliable: true });
      } catch { return finish({ ok: false, reason: 'Bağlanılamadı' }); }

      conn.on('open', () => {
        state.hostConn = conn;
        safeSend(conn, { t: 'join', profile: pubProfile() });
        finish({ ok: true, conn });
      });
      conn.on('data', (msg) => { if (msg && typeof msg === 'object') handlers.onHostMessage(msg); });
      conn.on('close', () => { if (state.hostConn === conn) { state.hostConn = null; handlers.onHostGone(); } });
      conn.on('error', (e) => {
        if (e && e.type === 'peer-unavailable') finish({ ok: false, reason: 'Böyle bir oda yok' });
        else finish({ ok: false, reason: 'Bağlantı hatası' });
      });
    });
  }

  function leaveRoom() {
    if (state.hostConn) {
      safeSend(state.hostConn, { t: 'leave' });
      try { state.hostConn.close(); } catch {}
      state.hostConn = null;
    }
  }

  /* -------------------------------------------------------- gönderim --- */
  const toHost = (msg) => safeSend(state.hostConn, msg);
  const toPlayer = (code, msg) => safeSend(state.conns.get(code), msg);
  function broadcast(msg, exceptCode) {
    for (const [code, c] of state.conns) if (code !== exceptCode) safeSend(c, msg);
  }
  const kick = (code, reason) => {
    const c = state.conns.get(code);
    if (c) { safeSend(c, { t: 'kick', reason: reason || 'Odadan çıkarıldın' }); setTimeout(() => { try { c.close(); } catch {} }, 250); }
    state.conns.delete(code);
  };

  function setIce(list) {
    state.iceServers = Array.isArray(list) && list.length ? list : DEFAULT_ICE;
  }

  function destroy() {
    closeRoom();
    leaveRoom();
    if (state.selfPeer) { try { state.selfPeer.destroy(); } catch {} state.selfPeer = null; }
    state.ready = false;
  }

  w.Net = {
    init, destroy, setIce, DEFAULT_ICE,
    probe, sendFriendRequest, sendInvite,
    openRoom, closeRoom, joinRoom, leaveRoom,
    toHost, toPlayer, broadcast, kick,
    handlers,
    get ready() { return state.ready; },
    get myCode() { return state.myCode; },
    get isHost() { return !!state.roomPeer; },
    get playerCodes() { return Array.from(state.conns.keys()); },
    get connCount() { return state.conns.size; },
  };
})(window);
