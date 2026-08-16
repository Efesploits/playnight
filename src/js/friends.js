/* =============================================================================
 *  PLAY NIGHT — ARKADAŞ SİSTEMİ
 *  ID ile ekleme, çevrimiçi yoklaması, oyuna davet
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, el, clear } = w.U;

  const presence = new Map();   // id -> { online, busy, at }
  let pollTimer = null;
  let polling = false;

  const isOnline = (id) => { const p = presence.get(id); return !!(p && p.online); };
  const online = () => w.Store.get().friends.filter((f) => isOnline(f.id));

  /* ------------------------------------------------------------ çizim -- */
  function render() {
    const d = w.Store.get();
    const list = $('#friendList');
    const empty = $('#friendEmpty');
    clear(list);

    const sorted = d.friends.slice().sort((a, b) => {
      const oa = isOnline(a.id) ? 0 : 1, ob = isOnline(b.id) ? 0 : 1;
      return oa - ob || a.name.localeCompare(b.name, 'tr');
    });

    for (const f of sorted) {
      const p = presence.get(f.id) || {};
      const st = p.online ? (p.busy ? 'ingame' : 'online') : '';
      list.appendChild(el('div', { class: 'friend-row' }, [
        w.UI.avatar(f.name, f.id, 'fr-av ' + st, f.color),
        el('div', { class: 'fr-info' }, [
          el('div', { class: 'fr-name', text: f.name }),
          el('div', { class: 'fr-sub', text: p.online ? (p.busy ? 'Odada · ' + f.id : 'Çevrimiçi · ' + f.id) : 'Çevrimdışı · ' + f.id }),
        ]),
        el('div', { class: 'fr-acts' }, [
          p.online ? el('button', {
            class: 'btn btn-primary btn-sm', text: 'DAVET ET',
            onclick: (ev) => invite(f, ev.currentTarget),
          }) : null,
          el('button', {
            class: 'icon-btn', title: 'Sil', text: '✕',
            onclick: () => remove(f),
          }),
        ]),
      ]));
    }

    empty.hidden = d.friends.length > 0;
    $('#friendCount').textContent = String(d.friends.length);
    $('#statFriends') && w.U.animateNumber($('#statFriends'), d.friends.length);
    $('#statOnline') && w.U.animateNumber($('#statOnline'), online().length);

    renderRequests();
    const badge = $('#friendBadge');
    if (badge) {
      badge.hidden = d.requests.length === 0;
      badge.textContent = String(d.requests.length);
    }
  }

  function renderRequests() {
    const d = w.Store.get();
    const wrap = $('#requestsWrap');
    const list = $('#requestList');
    clear(list);
    wrap.hidden = d.requests.length === 0;
    for (const r of d.requests) {
      list.appendChild(el('div', { class: 'req-row' }, [
        w.UI.avatar(r.name, r.id, 'fr-av', r.color),
        el('div', { class: 'fr-info' }, [
          el('div', { class: 'fr-name', text: r.name }),
          el('div', { class: 'fr-sub', text: 'Seni arkadaş olarak eklemek istiyor' }),
        ]),
        el('div', { class: 'fr-acts' }, [
          el('button', {
            class: 'btn btn-primary btn-sm', text: 'KABUL',
            onclick: async () => {
              await w.Store.addFriend(r);
              await w.Store.removeRequest(r.id);
              w.UI.toast(`${r.name} arkadaş listene eklendi`, 'ok');
              probeOne(r.id);
              render();
            },
          }),
          el('button', {
            class: 'btn btn-ghost btn-sm', text: 'YOKSAY',
            onclick: async () => { await w.Store.removeRequest(r.id); render(); },
          }),
        ]),
      ]));
    }
  }

  /* -------------------------------------------------------- ekle/sil --- */
  async function add(rawId) {
    const id = String(rawId || '').trim().toUpperCase();
    const msg = $('#addFriendMsg');
    const set = (t, k) => { if (msg) { msg.textContent = t; msg.className = 'form-msg ' + (k || ''); } };

    if (!w.U.isCode(id)) { set('ID 6 karakter olmalı (örn. A7K2M9)', 'err'); return false; }
    if (id === w.Store.profile().id) { set('Kendini ekleyemezsin :)', 'err'); return false; }
    if (w.Store.findFriend(id)) { set('Bu kişi zaten listende', 'err'); return false; }
    if (!w.Net.ready) { set('Bağlantı yok, biraz sonra dene', 'err'); return false; }

    set('İstek gönderiliyor…', '');
    const reply = await w.Net.sendFriendRequest(id);

    if (!reply) { set('Ulaşılamadı. Arkadaşın uygulamayı açık tutmalı.', 'err'); return false; }
    if (!reply.accepted) { set('İstek reddedildi.', 'err'); return false; }

    await w.Store.addFriend(reply.profile || { id, name: id });
    set('Eklendi!', 'ok');
    w.UI.toast(`${(reply.profile && reply.profile.name) || id} eklendi`, 'ok');
    presence.set(id, { online: true, busy: false, at: Date.now() });
    render();
    setTimeout(() => set('', ''), 2500);
    return true;
  }

  async function remove(f) {
    const yes = await w.UI.confirm({
      title: 'ARKADAŞI SİL',
      sub: `${f.name} listenden kaldırılsın mı?`,
      confirm: 'SİL', danger: true,
    });
    if (!yes) return;
    await w.Store.removeFriend(f.id);
    presence.delete(f.id);
    render();
  }

  async function invite(f, btn) {
    if (w.Room.mode === 'lobby' && w.Room.isHost && w.Room.code) {
      if (btn) { btn.disabled = true; btn.textContent = 'GÖNDERİLDİ'; }
      const reply = await w.Net.sendInvite(f.id, w.Room.code, 'okey101');
      if (reply && reply.accepted) w.UI.toast(`${f.name} kabul etti`, 'ok');
      else if (reply) w.UI.toast(`${f.name} reddetti`, 'warn');
      else w.UI.toast(`${f.name} yanıt vermedi`, 'warn');
      setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'DAVET ET'; } }, 3500);
      return;
    }
    /* oda yoksa önce kur, sonra davet et */
    const ok = await w.Room.createRoom(false);
    if (ok) setTimeout(() => invite(f, null), 400);
  }

  /* ------------------------------------------------------- yoklama ---- */
  async function probeOne(id) {
    const reply = await w.Net.probe(id);
    presence.set(id, { online: !!reply, busy: !!(reply && reply.busy), at: Date.now() });
    if (reply && reply.profile && reply.profile.name) {
      const f = w.Store.findFriend(id);
      if (f && f.name !== reply.profile.name) {
        await w.Store.update((d) => {
          const x = d.friends.find((y) => y.id === id);
          if (x) { x.name = reply.profile.name; x.color = reply.profile.color; }
        });
      }
    }
    return !!reply;
  }

  async function pollAll(showToast) {
    if (polling || !w.Net.ready) return;
    polling = true;
    const ids = w.Store.get().friends.map((f) => f.id);
    /* aynı anda en fazla 3 yoklama */
    for (let i = 0; i < ids.length; i += 3) {
      await Promise.all(ids.slice(i, i + 3).map(probeOne));
      render();
    }
    polling = false;
    if (showToast) w.UI.toast(`${online().length} arkadaş çevrimiçi`, 'info');
    if (w.Room.mode === 'lobby') w.Room.renderInviteList();
  }

  function startPolling() {
    stopPolling();
    pollAll(false);
    pollTimer = setInterval(() => pollAll(false), 45000);
  }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

  /* --------------------------------------------- gelen istek / davet -- */
  function wire() {
    w.Net.handlers.onFriendRequest = (profile, respond) => {
      const known = w.Store.findFriend(profile.id);
      if (known) { respond(true); return; }     // zaten arkadaş: sessizce onayla

      w.SFX.play('invite');
      w.UI.modal({
        title: 'ARKADAŞLIK İSTEĞİ',
        sub: `${profile.name || profile.id} (ID ${profile.id}) seni arkadaş olarak eklemek istiyor.`,
        closable: false,
        actions: [
          { label: 'REDDET', kind: 'btn-ghost', onClick: () => respond(false) },
          {
            label: 'KABUL ET', kind: 'btn-primary',
            onClick: async () => {
              respond(true);
              await w.Store.addFriend(profile);
              presence.set(profile.id, { online: true, busy: false, at: Date.now() });
              w.UI.toast(`${profile.name} arkadaş listene eklendi`, 'ok');
              render();
            },
          },
        ],
      });
    };

    w.Net.handlers.onInvite = (inv, respond) => {
      const f = w.Store.findFriend(inv.from);
      const name = (inv.profile && inv.profile.name) || (f && f.name) || inv.from;

      if (w.Room.mode === 'game') { respond(false); return; }

      const g = w.Room.GAMES[inv.game] || w.Room.GAMES.okey101;
      w.UI.invitePop({
        from: inv.from, name,
        detail: `${g.name} · Oda ${inv.code}`,
        onAccept: async () => {
          respond(true);
          if (w.Room.mode !== 'idle') w.Room.leave(false);
          setTimeout(() => w.Room.joinRoom(inv.code), 350);
        },
        onDecline: () => respond(false),
      });
    };
  }

  w.Friends = { render, add, remove, invite, pollAll, startPolling, stopPolling, wire, online, isOnline, presence };
})(window);
