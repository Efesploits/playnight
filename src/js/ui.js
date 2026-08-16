/* PLAY NIGHT — bildirim, modal, ortak arayüz parçaları */
(function (w) {
  'use strict';
  const { $, el, clear } = w.U;

  /* ------------------------------------------------------------ TOAST -- */
  const ICONS = { info: 'i', ok: '✓', warn: '!', err: '×' };

  function toast(msg, kind, ms) {
    const host = $('#toasts');
    if (!host) return;
    const k = kind || 'info';
    const node = el('div', { class: `toast ${k}` }, [
      el('span', { class: 'ti', text: ICONS[k] || 'i' }),
      el('span', { text: msg }),
    ]);
    host.appendChild(node);
    if (k === 'err') w.SFX.play('err');
    else if (k === 'ok') w.SFX.play('ok');
    else if (k === 'warn') w.SFX.play('warn');

    const life = ms || (k === 'err' ? 4600 : 3000);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 320);
    }, life);
    /* en fazla 5 bildirim */
    while (host.children.length > 5) host.firstChild.remove();
    return node;
  }

  /* ------------------------------------------------------------ MODAL -- */
  let modalOpen = false;
  let onEsc = null;

  function closeModal() {
    const host = $('#modalHost');
    if (!host || host.hidden) return;
    host.hidden = true;
    clear($('#modalBox'));
    modalOpen = false;
    onEsc = null;
  }

  /**
   * modal({ title, sub, body:Node|string, actions:[{label,kind,onClick,close}],
   *         wide, closable })
   */
  function modal(opts) {
    const host = $('#modalHost');
    const box = $('#modalBox');
    clear(box);
    const o = opts || {};

    if (o.closable !== false) {
      box.appendChild(el('button', {
        class: 'icon-btn m-close', text: '✕',
        onclick: () => { w.SFX.play('back'); closeModal(); },
      }));
    }
    if (o.title) box.appendChild(el('h3', { text: o.title }));
    if (o.sub) box.appendChild(el('p', { class: 'm-sub', text: o.sub }));
    if (o.body) {
      box.appendChild(typeof o.body === 'string' ? el('div', { html: o.body }) : o.body);
    }
    if (o.actions && o.actions.length) {
      const row = el('div', { class: 'm-actions' });
      for (const a of o.actions) {
        row.appendChild(el('button', {
          class: `btn ${a.kind || 'btn-ghost'}`, text: a.label,
          onclick: () => {
            w.SFX.play('click');
            if (a.close !== false) closeModal();
            if (a.onClick) a.onClick();
          },
        }));
      }
      box.appendChild(row);
    }
    box.style.width = o.wide ? 'min(880px, 100%)' : '';
    host.hidden = false;
    modalOpen = true;
    onEsc = o.closable === false ? null : closeModal;

    const back = host.querySelector('.modal-back');
    back.onclick = o.closable === false ? null : () => { w.SFX.play('back'); closeModal(); };
    return box;
  }

  function confirm(opts) {
    return new Promise((resolve) => {
      modal({
        title: opts.title || 'Emin misin?',
        sub: opts.sub,
        body: opts.body,
        closable: true,
        actions: [
          { label: opts.cancel || 'VAZGEÇ', kind: 'btn-ghost', onClick: () => resolve(false) },
          { label: opts.confirm || 'DEVAM', kind: opts.danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
        ],
      });
      const back = $('#modalHost .modal-back');
      const prev = back.onclick;
      back.onclick = () => { if (prev) prev(); resolve(false); };
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen && onEsc) { onEsc(); }
  });

  /* ------------------------------------------------------ AVATAR / SEAT */
  function avatar(name, seed, cls, colorIdx) {
    return el('div', {
      class: cls || 'fr-av',
      style: { background: w.U.avatarStyle(seed || name, colorIdx) },
      text: w.U.initials(name),
    });
  }

  /* ------------------------------------------------- DAVET BİLDİRİMİ --- */
  function invitePop(opts) {
    const host = $('#inviteHost');
    const node = el('div', { class: 'invite-pop' }, [
      el('div', { class: 'ip-av', style: { background: w.U.avatarStyle(opts.from) }, text: w.U.initials(opts.name) }),
      el('div', { class: 'ip-txt' }, [
        el('b', { text: `${opts.name} seni davet ediyor` }),
        el('span', { text: opts.detail || '101 Okey · Oda kurdu' }),
      ]),
      el('div', { class: 'ip-acts' }, [
        el('button', {
          class: 'btn btn-primary btn-sm', text: 'KATIL',
          onclick: () => { node.remove(); opts.onAccept && opts.onAccept(); },
        }),
        el('button', {
          class: 'btn btn-ghost btn-sm', text: 'YOKSAY',
          onclick: () => { node.remove(); opts.onDecline && opts.onDecline(); },
        }),
      ]),
    ]);
    host.appendChild(node);
    w.SFX.play('invite');
    const timer = setTimeout(() => {
      if (node.isConnected) { node.remove(); opts.onDecline && opts.onDecline(); }
    }, 45000);
    node.addEventListener('remove', () => clearTimeout(timer));
    return node;
  }

  /* ------------------------------------------------- BAĞLANTI GÖSTERGE  */
  function netStatus(state, label) {
    const n = $('#tbNet');
    if (!n) return;
    n.className = 'tb-net ' + (state || '');
    n.querySelector('.net-label').textContent = label || '';
    const cs = $('#connState');
    if (cs) cs.textContent = label || '—';
  }

  w.UI = { toast, modal, closeModal, confirm, avatar, invitePop, netStatus };
})(window);
