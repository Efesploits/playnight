/* =============================================================================
 *  PLAY NIGHT — UYGULAMA KABUĞU
 *  Açılış, yönlendirme, ayarlar, kurallar
 * ========================================================================== */
(function (w) {
  'use strict';
  const { $, $$, el, clear } = w.U;

  /* ============================================================ KURALLAR */
  const RULES_HTML = `
<div class="rules-doc">
  <h4>MASA VE TAŞLAR</h4>
  <ul>
    <li><b>106 taş:</b> 4 renkte (sarı, mavi, siyah, kırmızı) 1–13 arası sayılar, her taştan <b>2 kopya</b> (104) + <b>2 sahte okey</b>.</li>
    <li><b>4 oyuncu</b> oynar. Herkese <b>21 taş</b>, oyuna başlayan oyuncuya <b>22 taş</b> dağıtılır.</li>
    <li>Bir taş açılır: <b>gösterge</b>. Kalan 20 taş kapalı deste olur.</li>
  </ul>

  <h4>OKEY VE SAHTE OKEY</h4>
  <ul>
    <li><b>Okey</b>, göstergenin <b>aynı renginde bir üst sayısıdır</b>. Gösterge mavi 5 ise okey mavi 6'dır. Gösterge 13 ise okey aynı rengin 1'idir.</li>
    <li>Okey taşı <b>joker</b>dir, istediğin taşın yerine geçer (kendi değerinde de kullanılabilir).</li>
    <li>İki <b>sahte okey</b>, göstergenin taşının yerine geçer. Yukarıdaki örnekte sahte okeyler <b>mavi 5</b> olur.</li>
    <li>Gösterge asla sahte okey olamaz.</li>
  </ul>

  <h4>PERLER</h4>
  <ul>
    <li><b>Seri:</b> Aynı renkten ardışık en az 3 taş (kırmızı 5-6-7).</li>
    <li><b>Grup:</b> Aynı sayıdan farklı renklerde 3 veya 4 taş (sarı 7, mavi 7, siyah 7).</li>
    <li><b>Çift:</b> Birebir aynı iki taş (iki tane kırmızı 9).</li>
    <li>1 taşı serinin başında (1-2-3) ve sonunda (12-13-1) kullanılabilir; 13-1-2 geçersizdir. 1 daima <b>1 puan</b> sayılır.</li>
  </ul>

  <h4>EL AÇMA</h4>
  <ul>
    <li>Yere ilk kez per sermek için <b>tek hamlede en az 101 puan</b> gerekir. Taşın puanı üzerindeki sayıdır; okey, yerine geçtiği taşın puanını sayar.</li>
    <li>Alternatif: <b>en az 5 çift</b> ile açabilirsin (çift oyunu).</li>
    <li><b>Seri ve çift aynı elde karıştırılamaz.</b> Bir kez seçtin mi el boyunca ona bağlısın.</li>
    <li>Açtıktan sonra ek per koymak için puan sınırı yoktur.</li>
  </ul>

  <h4>OYUN AKIŞI</h4>
  <ul>
    <li>Sıran gelince <b>ya kapalı desteden çekersin ya da solundaki oyuncunun attığı taşı alırsın</b>.</li>
    <li>Açıksan yere per koyabilir, <b>işleme</b> yapabilirsin (kendi ve rakiplerin serilerine/gruplarına taş eklemek). Çiftlere işleme yapılamaz.</li>
    <li><b>Her tur bir taş atarak biter</b> — bitirdiğin el dahil.</li>
    <li>21 taşının tamamı yerdeyse ve son taşını attıysan <b>eli bitirdin</b> demektir.</li>
  </ul>

  <h4>CEZALAR</h4>
  <ul>
    <li>Okey taşını atmak: <b>+101</b> (bitirme hamlesi hariç — o zaman puanın iki katına çıkar).</li>
    <li>Masadaki bir pere işlenebilecek taşı atmak: <b>+101</b>.</li>
    <li>Deste biterse ve kimse bitiremezse elinde okey kalan her oyuncuya <b>+101</b>.</li>
  </ul>

  <h4>PUANLAMA</h4>
  <p class="muted small">Puanlar <b>sıfırdan</b> başlar. Bitiren oyuncu <b>eksi</b> puan alır, diğerleri artı yazar.
  Kararlaştırılan el sayısı (varsayılan <b>11 el</b>) dolunca <b>en düşük puanlı oyuncu maçı kazanır</b>.</p>
  <table>
    <thead><tr><th>Bitiş türü</th><th>Kazanan</th><th>Seri açanlar</th><th>Çift açanlar</th><th>Açmayanlar</th></tr></thead>
    <tbody>
      <tr><td>Seri ile, normal taş atarak</td><td class="win">−101</td><td class="lose">el toplamı</td><td class="lose">×2</td><td class="lose">+202</td></tr>
      <tr><td>Seri ile, okey atarak</td><td class="win">−202</td><td class="lose">×2</td><td class="lose">×4</td><td class="lose">+404</td></tr>
      <tr><td>Çift ile, normal taş atarak</td><td class="win">−202</td><td class="lose">×2</td><td class="lose">×4</td><td class="lose">+404</td></tr>
      <tr><td>Çift ile, okey atarak</td><td class="win">−404</td><td class="lose">×4</td><td class="lose">×8</td><td class="lose">+404</td></tr>
      <tr><td>Elden bitirme (kimse açmadan)</td><td class="win">−202</td><td colspan="3" class="lose">herkes +404</td></tr>
      <tr><td>Elden bitirme + okey atarak</td><td class="win">−404</td><td colspan="3" class="lose">herkes +808</td></tr>
    </tbody>
  </table>
  <p class="muted small" style="margin-top:12px">“El toplamı”, oyuncunun elinde kalan taşların sayı değerleri toplamıdır.</p>

  <h4>MASADA KISAYOLLAR</h4>
  <ul>
    <li><b>Boşluk</b> — desteden taş çek &nbsp;·&nbsp; <b>Çift tık</b> — taşı at &nbsp;·&nbsp; <b>Sürükle</b> — taşı diz ya da at</li>
    <li><b>S</b> sayıya göre sırala &nbsp;·&nbsp; <b>D</b> renge göre sırala &nbsp;·&nbsp; <b>A</b> otomatik diz &nbsp;·&nbsp; <b>Enter</b> el aç</li>
    <li>El açmak için ıstakada perleri yan yana diz, <b>araya boş yuva bırak</b>. Uygulama öbekleri kendisi okur.</li>
  </ul>
</div>`;

  const Rules = {
    show() {
      w.UI.modal({ title: '101 OKEY KURALLARI', wide: true, body: RULES_HTML,
        actions: [{ label: 'ANLADIM', kind: 'btn-primary' }] });
    },
  };
  w.Rules = Rules;

  /* ================================================== UNO KURALLARI ==== */
  const UNO_RULES_HTML = `
<div class="rules-doc">
  <h4>DESTE</h4>
  <ul>
    <li><b>108 kart:</b> 4 renk (kırmızı, sarı, yeşil, mavi), her renkte bir <b>0</b>, ikişer <b>1–9</b>,
        ikişer <b>Pas</b>, <b>Yön Değiştir</b> ve <b>+2</b> — renk başına 25 kart.</li>
    <li>Ayrıca <b>4 Joker</b> ve <b>4 Joker+4</b>.</li>
    <li>Herkese <b>7 kart</b> dağıtılır, üstten bir kart açılır.</li>
  </ul>

  <h4>OYNAMA</h4>
  <ul>
    <li>Masadaki kartla <b>renk</b>, <b>sayı</b> ya da <b>sembol</b> eşleştirerek kart oyna.</li>
    <li>Joker her zaman oynanır; oynayan sonraki rengi seçer.</li>
    <li>Oynayacak kartın yoksa <b>bir kart çek</b>. Çektiğin kart oynanabiliyorsa hemen oynayabilirsin,
        oynamak istemezsen pas geç.</li>
    <li>Deste biterse atılan kartlar (en üstteki hariç) karıştırılıp yeni deste olur.</li>
  </ul>

  <h4>AKSİYON KARTLARI</h4>
  <ul>
    <li><b>Pas:</b> sonraki oyuncu sırasını kaybeder.</li>
    <li><b>Yön Değiştir:</b> oyun yönü tersine döner. <b>İki kişilik oyunda Pas gibi çalışır.</b></li>
    <li><b>+2:</b> sonraki oyuncu 2 kart çeker ve sırasını kaybeder.</li>
    <li><b>Joker:</b> rengi sen seçersin.</li>
    <li><b>Joker+4:</b> rengi seçersin, sonraki oyuncu 4 kart çeker ve sırasını kaybeder.</li>
  </ul>

  <h4>JOKER+4 VE İTİRAZ</h4>
  <ul>
    <li>Kural: Joker+4'ü <b>yalnızca elinde masadaki renkten kart yokken</b> oynamalısın.
        (Başka renkten sayı kartların olması sorun değil.)</li>
    <li>Ama oyun seni fiziksel olarak engellemez — <b>blöf yapabilirsin</b>. Uygulama seni uyarır, kararı sen verirsin.</li>
    <li>Sonraki oyuncu <b>itiraz edebilir</b> ve elini görür:</li>
    <li>Blöf yakalanırsa <b>oynayan 4 kart çeker</b>, sıra itiraz edene geçer.</li>
    <li>İtiraz haksızsa <b>itiraz eden 4 yerine 6 kart çeker</b> ve sırasını kaybeder.</li>
  </ul>

  <h4>"UNO!" DEMEK</h4>
  <ul>
    <li>Sondan bir önceki kartını oynarken, yani <b>tek kartın kalacağı anda</b> UNO demelisin.</li>
    <li>Unutur ve sıradaki oyuncu oynamadan önce yakalanırsan <b>2 kart ceza</b> çekersin.</li>
    <li>Rakibin unuttuysa panelindeki <b>YAKALA!</b> düğmesine bas.</li>
  </ul>

  <h4>EL SONU VE PUANLAMA</h4>
  <ul>
    <li>Kartları biten oyuncu eli kazanır. Son kart <b>+2</b> ya da <b>Joker+4</b> ise sonraki oyuncu yine de çeker.</li>
    <li>Kazanan, <b>rakiplerin elinde kalan tüm kartların puanını</b> alır.</li>
  </ul>
  <table>
    <thead><tr><th>Kart</th><th>Puan</th></tr></thead>
    <tbody>
      <tr><td>Sayı kartları (0–9)</td><td>Üzerindeki sayı</td></tr>
      <tr><td>Pas / Yön Değiştir / +2</td><td>20</td></tr>
      <tr><td>Joker / Joker+4</td><td>50</td></tr>
    </tbody>
  </table>
  <p class="muted small" style="margin-top:12px">
    <b>500 puana</b> ilk ulaşan maçı kazanır (oda kurucusu bunu değiştirebilir).</p>

  <h4>KISAYOLLAR</h4>
  <ul>
    <li><b>Boşluk</b> — kart çek / pas geç &nbsp;·&nbsp; <b>U</b> — UNO de</li>
    <li>Oynanabilen kartlar parlar, oynanamayanlar soluklaşır.</li>
  </ul>
</div>`;

  w.UnoRules = {
    show() {
      w.UI.modal({ title: 'UNO KURALLARI', wide: true, body: UNO_RULES_HTML,
        actions: [{ label: 'ANLADIM', kind: 'btn-primary' }] });
    },
  };

  /* ============================================ PAPAZ KAÇTI KURALLARI == */
  const PAPAZ_RULES_HTML = `
<div class="rules-doc">
  <h4>DESTE</h4>
  <ul>
    <li>52'lik desteden <b>3 papaz çıkarılır</b> → <b>49 kart</b> kalır.</li>
    <li>Bu 49 kartın 48'i çift olur (her sayıdan 4'er tane), geriye <b>tek papaz</b> kalır.
        Eşi olmadığı için oyun boyunca birinin elinde kalmak zorundadır.</li>
    <li>Kartlar herkese olabildiğince eşit dağıtılır.</li>
  </ul>

  <h4>ÇİFTLER</h4>
  <ul>
    <li>Oyun başlamadan herkes elindeki çiftleri <b>yere açar</b>.</li>
    <li>Eşleşme <b>sayıya</b> göredir, <b>renk önemsizdir</b>: iki tane 7 çifttir,
        maça 3 ile maça 9 çift değildir.</li>
    <li>Aynı sayıdan dört kart varsa iki çift olur.</li>
  </ul>

  <h4>OYUN AKIŞI</h4>
  <ul>
    <li>Sıra sana gelince <b>sağındaki oyuncunun elinden görmeden bir kart seçersin</b>.
        Kartlar kapalıdır; hangisini alacağın tamamen sana kalmış.</li>
    <li>Çektiğin kart elindekilerden biriyle eşleşirse <b>o çift de yere gider</b>.</li>
    <li>Eşleşmezse kart elinde kalır ve sıra sonrakine geçer.</li>
    <li>Eli biten oyuncu <b>kurtulur</b> ve masadan kalkar; sırası atlanır.</li>
  </ul>

  <h4>BİTİŞ</h4>
  <ul>
    <li>Herkesin eli bitince geriye tek kişi kalır — <b>papaz ondadır ve eli kaybeder</b>.</li>
    <li>Maç varsayılan olarak <b>5 el</b> sürer. Sonunda <b>en az papaz kalan kazanır</b>.</li>
  </ul>

  <h4>KARTLARINI DİZ — BU BİR STRATEJİ</h4>
  <ul>
    <li>Rakip senin elinden <b>konuma göre</b> kart çeker. Yani papazın elinde nerede durduğu
        gerçekten önemlidir.</li>
    <li>Kartlarını <b>sürükleyerek</b> istediğin sıraya koyabilirsin. <b>KARIŞTIR</b> düğmesi
        (ya da <b>K</b> tuşu) hepsini rastgele dizer.</li>
    <li>Çektiğin yeni kart elinin rastgele bir yerine girer — istersen taşı.</li>
    <li>Tek kısıt: <b>sıradaki oyuncu tam senden çekerken karıştıramazsın</b>. Onun dışında serbest.</li>
  </ul>

  <h4>MASADA NELER OLUYOR?</h4>
  <ul>
    <li>Botlar gerçek oyuncular gibi davranır: <b>papazı tutan acemi bot elinde huzursuzca oynar</b>
        ve o kartı biraz öne iter. Buna <b>tell</b> denir.</li>
    <li>Ama dikkat — bazıları <b>blöf</b> yapar, masum bir kartı öne iter. Usta botlar
        gerçek papazı asla göstermez, üstelik senin tell'ini okur.</li>
    <li>Yelpazeden bir karta yaklaştığında kart yukarı kalkar. Seçtiğinde ortaya gelir,
        bir an durur ve <b>çevrilir</b>. O an masadaki herkes nefesini tutar.</li>
    <li>Oyuncular olan bitene laf atar. Papaz sana geldiğinde bunu duyacaksın.</li>
  </ul>
</div>`;

  w.PapazRules = {
    show() {
      w.UI.modal({ title: 'PAPAZ KAÇTI KURALLARI', wide: true, body: PAPAZ_RULES_HTML,
        actions: [{ label: 'ANLADIM', kind: 'btn-primary' }] });
    },
  };

  /* ============================================== SATRANÇ KURALLARI ==== */
  const SATRANC_RULES_HTML = `
<div class="rules-doc">
  <h4>TEMELLER</h4>
  <ul>
    <li>Beyaz başlar, sırayla birer hamle yapılır. Amaç rakip şahı <b>mat</b> etmektir.</li>
    <li><b>Piyon</b> düz gider, çapraz alır; ilk hamlesinde iki kare gidebilir.</li>
    <li><b>At</b> "L" atlar, <b>Fil</b> çapraz, <b>Kale</b> düz, <b>Vezir</b> her yöne gider;
        <b>Şah</b> bir kare oynar.</li>
    <li>Şahın tehdit edildiği kareye oynayamazsın; şah tehditteyse önce onu kurtarmalısın.</li>
  </ul>

  <h4>ÖZEL HAMLELER</h4>
  <ul>
    <li><b>Rok:</b> şah iki kare kaleye doğru gider, kale üstünden atlar. Şah oynamamış,
        kale oynamamış, ara boş ve geçilen kareler tehditsiz olmalı.</li>
    <li><b>Geçerken alma:</b> rakip piyonu iki kare sürdüğünde yanından geçen piyonun onu
        alabilir — ama yalnızca hemen sonraki hamlede.</li>
    <li><b>Terfi:</b> son yataya ulaşan piyon vezir, kale, fil ya da ata dönüşür.</li>
  </ul>

  <h4>BİTİŞ</h4>
  <ul>
    <li><b>Mat:</b> şah tehditte ve kaçış yok — oyun biter.</li>
    <li><b>Pat:</b> sıra sende, tehdit yok ama yasal hamle de yok — <b>berabere</b>.</li>
    <li>Diğer bereberlikler: <b>50 hamle</b> (taş alınmadan/piyon sürülmeden),
        <b>üç tekrar</b>, <b>yetersiz materyal</b>, <b>anlaşma</b>.</li>
    <li><b>Süre:</b> saatin biterse kaybedersin (rakibin mat edecek taşı yoksa berabere).
        Her hamle küçük bir ek süre kazandırır.</li>
  </ul>

  <h4>2v2 DANIŞMA MODU</h4>
  <ul>
    <li>İki takım, her takımda <b>2 kişi</b>. Takım tek renk oynar ve
        <b>takımdaki herhangi biri</b> hamleyi yapabilir — kararı aranızda verin.</li>
    <li><b>FİKİR VER</b> (kısayol <b>F</b>): bir kareye bas, oraya gidebilecek taşlarından
        birini seç. Takım arkadaşın tahtada <b>altın bir ok</b> görür ve isterse
        <b>OYNA</b> ile tek tıkta oynar.</li>
    <li>Fikirler <b>yalnızca kendi takımına</b> görünür — rakip takım okları asla görmez.</li>
    <li>Bot takım arkadaşın da sırası gelince sana fikir fısıldar.</li>
    <li>Renkler her oyunda değişir; seri sonunda çok puan toplayan takım maçı alır.</li>
  </ul>

  <h4>KISAYOLLAR</h4>
  <ul>
    <li>Taşa tıkla ya da sürükle · noktalar gidebileceğin kareler</li>
    <li><b>F</b> — fikir ver modu (2v2) &nbsp;·&nbsp; <b>Esc</b> — seçimi bırak</li>
  </ul>
</div>`;

  w.SatrancRules = {
    show() {
      w.UI.modal({ title: 'SATRANÇ KURALLARI', wide: true, body: SATRANC_RULES_HTML,
        actions: [{ label: 'ANLADIM', kind: 'btn-primary' }] });
    },
  };

  /* =========================================================== ROUTING == */
  let currentView = 'home';

  function go(view) {
    if (view === currentView && view !== 'lobby') return;
    const prev = $(`.view[data-view="${currentView}"]`);
    const next = $(`.view[data-view="${view}"]`);
    if (!next) return;
    if (prev) prev.classList.remove('active');
    next.classList.add('active');
    currentView = view;

    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
    /* oyun ekranlarında kenar çubuğu çekilir, masaya tüm alan kalır */
    $('#app').classList.toggle('game-mode', !!next.classList.contains('game-view'));

    if (view === 'friends') w.Friends.render();
    if (view === 'home') refreshStats();

    /* 3B sahneler yalnızca görünürken çizilsin (pil ve GPU) */
    if (w.PapazTable && w.PapazTable.setActive) w.PapazTable.setActive(view === 'papaz');
    if (charState.preview) {
      if (view === 'settings') { charState.preview.start(); charState.preview.resize(); }
      else charState.preview.stop();
    }
  }

  /* ============================================================ AYARLAR = */
  function refreshStats() {
    const s = w.Store.get().stats.okey101 || {};
    w.U.animateNumber($('#statPlayed'), s.played || 0);
    w.U.animateNumber($('#statWon'), s.won || 0);
    w.U.animateNumber($('#statFriends'), w.Store.get().friends.length);
    w.U.animateNumber($('#statOnline'), w.Friends.online().length);
  }

  function paintProfile() {
    const p = w.Store.profile();
    const av = $('#meAvatar');
    av.textContent = w.U.initials(p.name);
    av.style.background = w.U.avatarStyle(p.id, p.color);
    $('#meName').textContent = p.name;
    $('#meId').querySelector('span').textContent = p.id;
    $('#myIdBig').textContent = p.id;
    $('#setName').value = p.name;
    paintSwatches();
  }

  function paintSwatches() {
    const host = $('#avatarSwatches');
    clear(host);
    const p = w.Store.profile();
    w.U.AVATAR_COLORS.forEach((c, i) => {
      host.appendChild(el('button', {
        class: 'sw' + (i === p.color ? ' on' : ''),
        style: { background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` },
        onclick: async () => {
          await w.Store.update((d) => { d.profile.color = i; });
          paintProfile();
          refreshCharPreview();
        },
      }));
    });
  }

  /* ================================================ KARAKTER EDİTÖRÜ == */
  const charState = { preview: null, acc: null };

  function bindCharEditor() {
    const host = $('#charOpts');
    const canvas = $('#charPreview');
    if (!host || !canvas) return;

    const p = w.Store.profile();
    charState.acc = Object.assign({ hat: 'yok', face: 'yok', hair: 'yok' }, p.acc || {});

    if (!w.Papaz3D || !w.Papaz3D.HAS3D) {
      canvas.remove();
      $('.char-preview').appendChild(el('div', { class: 'no3d-msg',
        text: '3B önizleme bu ortamda kullanılamıyor.' }));
    } else {
      charState.preview = w.Papaz3D.createPreview(canvas);
      if (charState.preview) {
        charState.preview.set(p.color, charState.acc);
        charState.preview.start();
      }
    }

    const A = w.Papaz3D ? w.Papaz3D.ACCESSORIES : { hat: ['yok'], face: ['yok'], hair: ['yok'] };
    const L = w.Papaz3D ? w.Papaz3D.ACC_LABEL : {};
    const ROWS = [['hat', 'Şapka'], ['face', 'Yüz'], ['hair', 'Detay']];

    clear(host);
    for (const [key, label] of ROWS) {
      const chips = el('div', { class: 'char-chips' });
      for (const val of A[key]) {
        chips.appendChild(el('button', {
          class: 'char-chip' + (charState.acc[key] === val ? ' on' : ''),
          text: (L[key] && L[key][val]) || val,
          onclick: (ev) => {
            charState.acc[key] = val;
            [...chips.children].forEach((c) => c.classList.remove('on'));
            ev.currentTarget.classList.add('on');
            if (charState.preview) charState.preview.set(w.Store.profile().color, charState.acc);
            w.SFX.play('pick');
          },
        }));
      }
      host.appendChild(el('div', { class: 'char-row' }, [el('span', { text: label }), chips]));
    }

    $('#saveChar').onclick = async () => {
      await w.Store.update((d) => { d.profile.acc = Object.assign({}, charState.acc); });
      const msg = $('#charMsg');
      msg.textContent = 'Karakterin kaydedildi.';
      msg.className = 'form-msg ok';
      w.SFX.play('ok');
      setTimeout(() => { msg.textContent = ''; }, 2500);
    };
  }

  /** Renk değişince önizleme de güncellensin. */
  function refreshCharPreview() {
    if (charState.preview) charState.preview.set(w.Store.profile().color, charState.acc || {});
  }

  function bindSettings() {
    const s = w.Store.settings();
    $('#setSound').checked = s.sound;
    $('#setMusic').checked = s.music;
    $('#setVolume').value = String(Math.round(s.volume * 100));
    $('#setReduced').checked = s.animations === 'reduced';
    $('#setSkipIntro').checked = !!s.skipIntro;
    $('#setIce').value = s.iceServers ? JSON.stringify(s.iceServers, null, 2) : '';

    const apply = () => {
      w.SFX.configure(w.Store.settings());
      document.body.classList.toggle('reduced', w.Store.settings().animations === 'reduced');
    };

    $('#setSound').onchange = async (e) => { await w.Store.setSetting('sound', e.target.checked); apply(); w.SFX.play('click'); };
    $('#setMusic').onchange = async (e) => { await w.Store.setSetting('music', e.target.checked); apply(); };
    $('#setVolume').oninput = async (e) => { await w.Store.setSetting('volume', parseInt(e.target.value, 10) / 100); apply(); };
    $('#setReduced').onchange = async (e) => { await w.Store.setSetting('animations', e.target.checked ? 'reduced' : 'full'); apply(); };
    $('#setSkipIntro').onchange = async (e) => { await w.Store.setSetting('skipIntro', e.target.checked); };

    $('#saveProfile').onclick = async () => {
      const name = String($('#setName').value || '').trim().slice(0, 16) || 'Oyuncu';
      await w.Store.update((d) => { d.profile.name = name; });
      paintProfile();
      w.UI.toast('Profil kaydedildi', 'ok');
    };

    $('#saveIce').onclick = async () => {
      const raw = String($('#setIce').value || '').trim();
      if (!raw) {
        await w.Store.setSetting('iceServers', null);
        w.Net.setIce(null);
        w.UI.toast('Varsayılan sunuculara dönüldü', 'ok');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('dizi olmalı');
        await w.Store.setSetting('iceServers', parsed);
        w.Net.setIce(parsed);
        w.UI.toast('ICE sunucuları kaydedildi. Yeniden başlatınca etkin olur.', 'ok');
      } catch (err) {
        w.UI.toast('Geçersiz JSON: ' + err.message, 'err');
      }
    };

    $('#openStore').onclick = async () => {
      const p = await w.Store.storePath();
      w.UI.modal({ title: 'VERİ KLASÖRÜ', sub: 'Profil, arkadaşlar ve ayarlar burada saklanır.',
        body: el('div', { class: 'input mono', style: { userSelect: 'text', wordBreak: 'break-all' }, text: p }),
        actions: [{ label: 'KOPYALA', kind: 'btn-primary', onClick: () => w.U.copy(p) }] });
    };

    apply();
  }

  async function paintAbout() {
    const box = $('#aboutBox');
    let info = { version: '1.0.0', electron: '-', chrome: '-', node: '-' };
    try { if (w.pn) info = await w.pn.app.info(); } catch {}
    $('#verLabel').textContent = 'v' + info.version;
    clear(box);
    const rows = [
      ['Uygulama', 'Play Night ' + info.version],
      ['Electron', info.electron],
      ['Chromium', info.chrome],
      ['Node', info.node],
      ['Bağlantı', 'WebRTC (P2P) · port açmaya gerek yok'],
    ];
    for (const [k, v] of rows) box.appendChild(el('div', {}, [el('span', { text: k }), el('b', { text: String(v) })]));
  }

  /* ======================================================== OYNA AKIŞI == */
  function playMenu(game) {
    const g = w.Room.GAMES[game] ? game : 'okey101';
    const soloText = g === 'ciz'
      ? 'Botlarla dene — onlar karalar, sen çizersin.'
      : g === 'uno'
        ? 'Üç bot rakiple hemen başla.'
        : g === 'papaz'
          ? 'Üç bot masaya otursun. Papazı kime yıkacaksın?'
          : g === 'satranc'
            ? 'Bota karşı 1v1 — lobiden 2v2 danışma moduna geçebilirsin.'
            : 'Üç bilgisayar rakibiyle anında masaya otur.';

    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
      bigChoice('🤖', 'BOTLARLA HEMEN OYNA', soloText, () => {
        w.UI.closeModal();
        w.Room.createRoom(true, g).then((ok) => { if (ok) setTimeout(() => w.Room.startGame(), 250); });
      }),
      bigChoice('👥', 'ARKADAŞLARLA ODA KUR', 'Oda kodunu paylaş ya da arkadaşlarını davet et.', () => {
        w.UI.closeModal();
        w.Room.createRoom(false, g);
      }),
      bigChoice('🔑', 'KOD İLE KATIL', 'Arkadaşının verdiği 6 haneli kodu gir.', () => {
        w.UI.closeModal();
        setTimeout(joinPrompt, 150);
      }),
    ]);
    w.UI.modal({ title: w.Room.GAMES[g].name, sub: 'Nasıl oynamak istersin?', body });
  }

  function bigChoice(icon, title, sub, onClick) {
    return el('button', {
      class: 'seat filled', style: { textAlign: 'left', cursor: 'pointer', width: '100%' },
      onclick: () => { w.SFX.play('click'); onClick(); },
    }, [
      el('div', { class: 'seat-av', style: { background: 'linear-gradient(135deg,#2f6bff,#123ba8)', fontSize: '20px' }, text: icon }),
      el('div', { class: 'seat-info' }, [
        el('div', { class: 'seat-name', text: title }),
        el('div', { class: 'seat-tag', text: sub }),
      ]),
      el('div', { class: 'seat-acts', style: { fontSize: '20px', color: 'var(--blue-300)' }, text: '→' }),
    ]);
  }

  function joinPrompt() {
    const input = el('input', {
      class: 'input', placeholder: 'ODA KODU', maxlength: '6',
      style: { textAlign: 'center', fontSize: '26px', letterSpacing: '.25em', fontFamily: 'var(--font-display)' },
      oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); },
      onkeydown: (e) => { if (e.key === 'Enter') submit(); },
    });
    const submit = () => { const v = input.value; w.UI.closeModal(); w.Room.joinRoom(v); };
    w.UI.modal({
      title: 'ODAYA KATIL', sub: 'Arkadaşının paylaştığı 6 haneli kodu gir.',
      body: input,
      actions: [{ label: 'VAZGEÇ', kind: 'btn-ghost' }, { label: 'KATIL', kind: 'btn-primary', onClick: submit }],
    });
    setTimeout(() => input.focus(), 80);
  }

  /* ============================================================== BAĞLA = */
  function wireUI() {
    /* pencere düğmeleri */
    $$('.tb-btn').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.win;
        if (!w.pn) return;
        if (a === 'min') w.pn.win.minimize();
        else if (a === 'max') w.pn.win.maximize();
        else if (a === 'close') w.pn.win.close();
        else if (a === 'full') w.pn.win.fullscreen();
      };
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F11' && w.pn) { e.preventDefault(); w.pn.win.fullscreen(); }
    });

    /* gezinme */
    $$('.nav-item').forEach((b) => {
      b.onclick = () => { w.SFX.play('click'); go(b.dataset.nav); };
      b.onmouseenter = () => w.SFX.play('hover');
    });

    /* ana sayfa */
    $('#ctaPlay').onclick = () => { w.SFX.play('click'); playMenu('okey101'); };
    $('#ctaCiz').onclick = () => { w.SFX.play('click'); playMenu('ciz'); };
    $('#ctaUno').onclick = () => { w.SFX.play('click'); playMenu('uno'); };
    $('#ctaPapaz').onclick = () => { w.SFX.play('click'); playMenu('papaz'); };
    $('#ctaSatranc').onclick = () => { w.SFX.play('click'); playMenu('satranc'); };
    $('#ctaJoin').onclick = () => { w.SFX.play('click'); joinPrompt(); };
    $('#btnRules').onclick = () => { w.SFX.play('click'); Rules.show(); };
    $$('[data-play]').forEach((n) => {
      n.onclick = (e) => { e.stopPropagation(); w.SFX.play('click'); playMenu(n.dataset.play); };
    });

    /* kimlik kopyalama */
    const copyId = async () => {
      const ok = await w.U.copy(w.Store.profile().id);
      w.UI.toast(ok ? 'ID kopyalandı' : 'Kopyalanamadı', ok ? 'ok' : 'err');
    };
    $('#meId').onclick = copyId;
    $('#copyIdBtn').onclick = copyId;

    /* arkadaşlar */
    $('#addFriendBtn').onclick = () => w.Friends.add($('#addFriendInput').value);
    $('#addFriendInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') w.Friends.add(e.target.value); });
    $('#addFriendInput').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });
    $('#refreshFriends').onclick = () => { w.SFX.play('click'); w.Friends.pollAll(true); };

    /* lobi */
    $('#lobbyBack').onclick = () => { w.SFX.play('back'); w.Room.leave(false); };
    $('#leaveRoomBtn').onclick = () => { w.SFX.play('back'); w.Room.leave(false); };
    $('#startGameBtn').onclick = () => { w.SFX.play('click'); w.Room.startGame(); };
    $('#lobbyCode').onclick = async () => {
      const c = w.Room.code;
      if (!c) return;
      const ok = await w.U.copy(c);
      w.UI.toast(ok ? 'Oda kodu kopyalandı' : 'Kopyalanamadı', ok ? 'ok' : 'err');
    };
    $('#lobbyChatSend').onclick = () => { w.Room.sendChat($('#lobbyChatInput').value); $('#lobbyChatInput').value = ''; };
    $('#lobbyChatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { w.Room.sendChat(e.target.value); e.target.value = ''; }
    });
    $$('.tab').forEach((t) => {
      t.onclick = () => {
        $$('.tab').forEach((x) => x.classList.remove('active'));
        $$('.tab-body').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        $(`.tab-body[data-tabbody="${t.dataset.tab}"]`).classList.add('active');
        w.SFX.play('click');
      };
    });

    /* oyun ekranları */
    const leaveGame = async (toLobby) => {
      if (toLobby) { w.Room.leave(true); return; }
      const yes = await w.UI.confirm({
        title: 'OYUNDAN ÇIK', sub: 'Çıkmak istediğine emin misin?',
        confirm: 'ÇIK', danger: true,
      });
      if (yes) w.Room.leave(false);
    };
    w.OkeyTable.onAction = (a) => w.Room.sendAction(a);
    w.OkeyTable.onLeave = leaveGame;
    w.CizGame.onAction = (a) => w.Room.sendAction(a);
    w.CizGame.onLeave = leaveGame;
    w.UnoTable.onAction = (a) => w.Room.sendAction(a);
    w.UnoTable.onLeave = leaveGame;
    w.PapazTable.onAction = (a) => w.Room.sendAction(a);
    w.PapazTable.onLeave = leaveGame;
    w.SatrancTable.onAction = (a) => w.Room.sendAction(a);
    w.SatrancTable.onLeave = leaveGame;

    /* ilk kullanıcı etkileşiminde sesi başlat (tarayıcı politikası) */
    const kick = () => { w.SFX.resume(); if (w.Store.settings().music) w.SFX.startMusic(); document.removeEventListener('pointerdown', kick); };
    document.addEventListener('pointerdown', kick);
  }

  /* ============================================================== AÇILIŞ */
  async function boot() {
    await w.Store.load();
    const s = w.Store.settings();

    document.body.classList.toggle('reduced', s.animations === 'reduced');
    w.SFX.configure(s);
    w.BG.start();

    paintProfile();
    bindCharEditor();
    bindSettings();
    paintAbout();
    wireUI();
    w.Update.wire();
    w.Room.wireNet();
    w.Friends.wire();
    w.OkeyTable.mount();
    refreshStats();

    /* intro */
    w.Intro.run({
      skip: !!s.skipIntro,
      reduced: s.animations === 'reduced',
      onDone: () => {
        $('#app').classList.add('ready');
        setTimeout(() => { if (w.Store.settings().music) w.SFX.startMusic(); }, 400);
      },
    });

    /* Ağ durumu göstergesi: net.js buradan haber verir.
       Bu bağ kurulmazsa başlık çubuğu sonsuza dek "Bağlanıyor" der. */
    w.Net.handlers.onStatus = (state, label) => w.UI.netStatus(state, label);

    /* ağ: intro oynarken arkada bağlan */
    w.UI.netStatus('busy', 'Bağlanıyor');
    const ok = await w.Net.init(w.Store.profile(), s.iceServers);
    if (ok) {
      w.UI.netStatus('on', 'Çevrimiçi');
      w.Friends.startPolling();
    } else {
      w.UI.netStatus('off', 'Çevrimdışı');
      w.UI.toast('Sunucuya bağlanılamadı. Botlarla oynayabilirsin.', 'warn', 6000);
    }
    w.Friends.render();
    w.Update.autoCheck();

    /* çıkarken temizle */
    w.addEventListener('beforeunload', () => { try { w.Net.destroy(); } catch {} });
  }

  w.App = { go, boot, refreshStats, paintProfile, get view() { return currentView; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
