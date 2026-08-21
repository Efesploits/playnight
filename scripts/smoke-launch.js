/* Play Night -> M3RANT baslatma zinciri testi.
   Gercek electron/main.js'i yukler, ana pencerede Oyunlar sekmesine gidip
   M3RANT kartina basar ve ikinci pencerenin gercekten actigini dogrular.
   Calistir:  PN_SMOKE=1 npx electron .  */
'use strict';
const { app, BrowserWindow } = require('electron');

require('../electron/main.js');   // gercek uygulama

const log = (...a) => console.log('[baslat]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = [];

app.whenReady().then(async () => {
  await wait(2500);
  const wins = BrowserWindow.getAllWindows();
  if (!wins.length) { console.log('[baslat] ana pencere yok'); app.exit(1); return; }
  const main = wins[0];
  const js = (c) => main.webContents.executeJavaScript(c);

  try {
    await wait(2500);
    const boot = await js(`({ view: window.App && window.App.view,
      bridge: !!(window.pn && window.pn.m3rant),
      card: !!document.querySelector('[data-launch="m3rant"]'),
      cta: !!document.getElementById('ctaM3rant') })`);
    log('acilis: ' + JSON.stringify(boot));
    if (!boot.bridge) bad.push('preload koprusu yok');
    if (!boot.card) bad.push('oyun karti yok');

    const info = await js(`window.pn.m3rant.info()`);
    log('m3rant bilgi: ' + JSON.stringify(info));
    if (!info.available) bad.push('vendor/m3rant bulunamadi');

    /* karta bas -> onay penceresi -> BASLAT */
    await js(`document.querySelector('[data-launch="m3rant"]').click()`);
    await wait(700);
    const modal = await js(`(() => { const m = document.getElementById('modalBox');
      return { text: m.textContent.replace(/\s+/g,' ').slice(0, 110),
        buttons: [...m.querySelectorAll('button')].map(b => b.textContent.trim()) }; })()`);
    log('kutu: ' + JSON.stringify(modal));

    await js(`[...document.querySelectorAll('#modalBox button')].find(b => b.textContent.includes('BAŞLAT')).click()`);
    await wait(6000);

    const all = BrowserWindow.getAllWindows();
    const m3 = all.find((w) => w.getTitle() === 'M3RANT' || w.webContents.getURL().startsWith('app://'));
    log('pencere sayisi: ' + all.length + ', m3rant url: ' + (m3 ? m3.webContents.getURL() : 'YOK'));
    if (!m3) bad.push('M3RANT penceresi acilmadi');
    else {
      const probe = await m3.webContents.executeJavaScript(
        `({ title: document.title, canvas: !!document.querySelector('canvas'),
           name: (JSON.parse(localStorage.getItem('m3rant.profile.v1')||'{}')).name || null })`);
      log('m3rant icerik: ' + JSON.stringify(probe));
      if (!probe.canvas) bad.push('oyun cizime baslamadi');

      /* ikinci kez basinca yeni pencere acmamali, one getirmeli */
      const again = await js(`window.pn.m3rant.open({})`);
      await wait(600);
      const count = BrowserWindow.getAllWindows().length;
      log('tekrar acma: ' + JSON.stringify(again) + ' pencere=' + count);
      if (count !== all.length) bad.push('ikinci cagri yeni pencere acti');
    }
  } catch (e) { bad.push('sonda hata: ' + e.message); }

  console.log(bad.length ? '\n[baslat] HATALAR:\n - ' + bad.join('\n - ') : '\n[baslat] TEMIZ');
  app.exit(bad.length ? 1 : 0);
});

setTimeout(() => { console.log('[baslat] ZAMAN ASIMI'); app.exit(1); }, 60000);
