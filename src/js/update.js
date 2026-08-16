/* =============================================================================
 *  PLAY NIGHT — GÜNCELLEME
 *  GitHub Releases'teki en son sürümü kontrol eder, kurulum dosyasını indirir
 *  ve çalıştırır. İndirme ana süreçte yapılır; buradan yalnızca arayüz sürülür.
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, el, clear } = w.U;

  const bridge = w.pn && w.pn.update ? w.pn.update : null;
  const S = { info: null, busy: false, offProgress: null };

  const fmtMB = (n) => (n / 1048576).toFixed(1) + ' MB';

  /* ------------------------------------------------------------ durum -- */
  function setStatus(text, kind) {
    const n = $('#updStatus');
    if (n) { n.textContent = text || ''; n.className = 'form-msg ' + (kind || ''); }
  }

  /** Başlık çubuğunda "güncelleme var" rozeti. */
  function setBadge(info) {
    const host = $('#updBadge');
    if (!host) return;
    if (!info || !info.available) { host.hidden = true; return; }
    host.hidden = false;
    host.textContent = `v${info.latest} HAZIR`;
    host.onclick = () => showDialog(info);
  }

  /* ---------------------------------------------------------- kontrol -- */
  /** @param manual kullanıcı düğmeye bastıysa true (sessiz kontrolde bildirim yok) */
  async function check(manual) {
    if (!bridge) {
      if (manual) setStatus('Güncelleme yalnızca masaüstü uygulamasında çalışır.', 'err');
      return null;
    }
    if (S.busy) return null;
    S.busy = true;
    if (manual) setStatus('Kontrol ediliyor…', '');

    const info = await bridge.check();
    S.busy = false;
    S.info = info;

    const btn = $('#updCheck');
    if (btn) btn.disabled = false;

    if (!info || !info.ok) {
      const why = info && info.reason === 'rate-limit'
        ? 'GitHub sınırına takıldı, biraz sonra dene.'
        : `Kontrol edilemedi (${(info && info.reason) || 'bağlantı yok'}).`;
      if (manual) setStatus(why, 'err');
      return info;
    }

    if (info.reason === 'no-release') {
      if (manual) setStatus('Henüz yayınlanmış bir sürüm yok.', '');
      setBadge(null);
      return info;
    }

    if (!info.available) {
      if (manual) setStatus(`En güncel sürümdesin (v${info.current}).`, 'ok');
      setBadge(null);
      return info;
    }

    setBadge(info);
    if (manual) { setStatus(`Yeni sürüm bulundu: v${info.latest}`, 'ok'); showDialog(info); }
    else w.UI.toast(`Yeni sürüm var: v${info.latest}`, 'info', 7000);
    return info;
  }

  /* ------------------------------------------------------- indir/kur --- */
  function showDialog(info) {
    if (!info || !info.available) return;

    const notes = el('div', {
      class: 'upd-notes',
      text: info.notes ? info.notes.slice(0, 1200) : 'Sürüm notu yok.',
    });

    const bar = el('i');
    const barWrap = el('div', { class: 'upd-bar', hidden: true }, [bar]);
    const pct = el('div', { class: 'upd-pct', hidden: true, text: '0%' });

    const body = el('div', { class: 'upd-box' }, [
      el('div', { class: 'upd-vers' }, [
        el('span', { class: 'uv-old', text: 'v' + info.current }),
        el('span', { class: 'uv-arrow', text: '→' }),
        el('span', { class: 'uv-new', text: 'v' + info.latest }),
      ]),
      info.asset
        ? el('div', { class: 'upd-file', text: `${info.asset.name} · ${fmtMB(info.asset.size)}` })
        : el('div', { class: 'form-msg err', text: 'Bu sürümde indirilebilir kurulum dosyası yok.' }),
      notes, barWrap, pct,
    ]);

    const actions = [{ label: 'SONRA', kind: 'btn-ghost' }];
    if (info.asset) actions.push({ label: 'İNDİR VE KUR', kind: 'btn-primary', close: false, onClick: () => start() });
    else if (info.pageUrl) actions.push({ label: 'SAYFAYI AÇ', kind: 'btn-primary', onClick: () => w.pn.shell.open(info.pageUrl) });

    const box = w.UI.modal({
      title: 'GÜNCELLEME VAR', sub: `Play Night v${info.latest} yayınlandı.`,
      body, wide: true, actions,
    });

    async function start() {
      const btns = box.querySelectorAll('.m-actions .btn');
      btns.forEach((b) => { b.disabled = true; });
      btns[btns.length - 1].textContent = 'İNDİRİLİYOR…';
      barWrap.hidden = false; pct.hidden = false;

      if (S.offProgress) S.offProgress();
      S.offProgress = bridge.onProgress((p) => {
        const r = p.total ? p.got / p.total : 0;
        bar.style.width = Math.round(r * 100) + '%';
        pct.textContent = `${Math.round(r * 100)}% · ${fmtMB(p.got)} / ${fmtMB(p.total || 0)}`;
      });

      const res = await bridge.download(info.asset);
      if (S.offProgress) { S.offProgress(); S.offProgress = null; }

      if (!res || !res.ok) {
        btns.forEach((b) => { b.disabled = false; });
        btns[btns.length - 1].textContent = 'TEKRAR DENE';
        pct.textContent = 'İndirilemedi: ' + ((res && res.reason) || 'bilinmeyen hata');
        pct.classList.add('err');
        return;
      }

      pct.textContent = 'İndirildi. Kurulum başlatılıyor…';
      pct.classList.remove('err');

      const ok = await w.UI.confirm({
        title: 'KURULUMU BAŞLAT',
        sub: 'Play Night kapanacak ve kurulum sihirbazı açılacak. Kurulum bitince uygulamayı yeniden başlat.',
        confirm: 'KUR VE KAPAT', cancel: 'VAZGEÇ',
      });
      if (!ok) {
        pct.textContent = 'Kurulum dosyası hazır: ' + res.path;
        btns.forEach((b) => { b.disabled = false; });
        btns[btns.length - 1].textContent = 'KURULUMU AÇ';
        btns[btns.length - 1].onclick = () => bridge.install(res.path);
        return;
      }

      const inst = await bridge.install(res.path);
      if (!inst || !inst.ok) {
        pct.textContent = 'Kurulum açılamadı: ' + ((inst && inst.reason) || '');
        pct.classList.add('err');
        btns.forEach((b) => { b.disabled = false; });
      }
    }
  }

  /* --------------------------------------------------------- kurulum -- */
  function wire() {
    const btn = $('#updCheck');
    if (btn) {
      btn.onclick = () => { w.SFX.play('click'); btn.disabled = true; check(true); };
      btn.disabled = !bridge;
    }
    const cur = $('#updCurrent');
    if (cur && w.pn) w.pn.app.info().then((i) => { cur.textContent = 'v' + i.version; }).catch(() => {});
    if (!bridge) setStatus('Tarayıcı önizlemesinde güncelleme kapalı.', '');

    const auto = $('#setAutoUpdate');
    if (auto) {
      auto.checked = w.Store.settings().autoUpdate !== false;
      auto.onchange = (e) => w.Store.setSetting('autoUpdate', e.target.checked);
    }
  }

  /** Açılışta sessiz kontrol (ayardan kapatılabilir). */
  function autoCheck() {
    if (!bridge) return;
    if (w.Store.settings().autoUpdate === false) return;
    setTimeout(() => check(false), 6000);
  }

  w.Update = { check, showDialog, wire, autoCheck, setBadge, get info() { return S.info; } };
})(window);
