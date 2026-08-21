# 🎴 Play Night

Arkadaşlarınla oyun gecesi. Sinematik açılış, mavi-siyah tema ve dört oyun:
tam kurallarıyla **101 Okey**, Gartic Phone tarzı **Çiz Babacım**, **UNO**,
3B masada oynanan **Papaz Kaçtı**, 2v2 danışma modlu **Satranç** ve 5v5
taktiksel nişancı **M3RANT**. Windows masaüstü uygulaması (Electron).

**Port açmana gerek yok.** Bağlantı eşler arası (WebRTC) kurulur; modem/router ayarı,
port yönlendirme, sabit IP gerekmez.

### ⬇️ [Son sürümü indir](https://github.com/Efesploits/playnight/releases/latest)

`PlayNight-setup.exe` kurulum yapar, `PlayNight-portable.exe` doğrudan çalışır.
Windows SmartScreen uyarırsa **Ek bilgi → Yine de çalıştır** de (dosya imzalı değil).

---

## Çalıştırma

```bash
npm install
npm start
```

## EXE üretme

```bash
npm run dist
```

`dist/` klasöründe iki dosya oluşur:

| Dosya | Ne işe yarar |
|---|---|
| `PlayNight-1.0.0-portable.exe` | Kurulum istemez, çift tıkla çalışır. Arkadaşına da bunu gönder. |
| `PlayNight-1.0.0-setup.exe` | Klasik kurulum sihirbazı, masaüstü + başlat menüsü kısayolu ekler. |

Sadece taşınabilir sürüm için: `npm run dist:portable`

## Testler

```bash
node tests/engine.test.js       # 141 okey kural testi
node tests/ciz.test.js          # 124 çiz babacım testi
node tests/uno.test.js          # 135 uno kural testi
node tests/papaz.test.js        # 130 papaz kaçtı testi
node tests/satranc.test.js      # 109 satranç testi (perft dahil)
node tests/update.test.js       #  23 güncelleme mantığı testi
node tests/sim.test.js 20       # 20 tam okey maçı
node tests/uno-sim.test.js 20   # 20 tam uno maçı
node tests/papaz-sim.test.js 20 # 20 tam papaz kaçtı maçı
node tests/satranc-sim.test.js 10 # 10 tam satranç oyunu (1v1 + 2v2)
npm run smoke:m3rant            # M3RANT açılıyor ve maç başlıyor mu
npm run smoke:launch            # Play Night'tan M3RANT başlatma zinciri
```

---

## Oyunlar

| Oyun | Kişi | Ne yapılıyor |
|---|---|---|
| **101 Okey** | 4 | Klasik yüzbir: gösterge, okey, 101 puanla açma, işleme, tam puanlama. |
| **Çiz Babacım** | 2–8 | Yaz → çiz → tahmin et → çiz… Cümle elden ele geçtikçe tanınmaz olur, sonunda albüm açılır. |
| **UNO** | 2–6 | 108 kart, renk/sayı eşleştir. Joker+4 blöfü ve itirazı, UNO deme cezası, 500 puana yarış. |
| **Papaz Kaçtı** | 2–6 | Karanlık odada, tepeden sarkan ampulün altında **3B masa**. Çift at, sağındakinden kart çek, papazdan kaç. |
| **Satranç** | 2 / 4 | Tam FIDE kuralları, satranç saati, SAN hamle listesi. **2v2 danışma:** takım arkadaşına kare + taş öner (FİKİR VER), yalnızca takımın görür. |
| **M3RANT** | 5v5 | Taktiksel nişancı: bomba kur/imha et, 8 ajan, 3 harita, 18 silah. Kendi penceresinde açılır. |

## Nasıl oynanır

### Tek başına
Ana sayfa → **101 OKEY OYNA** ya da **ÇİZ BABACIM** → *Botlarla hemen oyna*.
Boş koltuklar botla dolar; okey botları gerçekten oynar, çizim botları karalar ve saçmalar.

### Arkadaşlarınla
1. Oyunu seç → **Arkadaşlarla oda kur.** 6 haneli bir **oda kodu** alırsın.
2. Kodu arkadaşına gönder; o **Kod ile katıl** deyip girsin.
3. Ya da **Arkadaşlar** sekmesinden ID'sini ekleyip lobideki **DAVET ET** düğmesine bas —
   uygulaması açıksa anında bildirim düşer.
4. Boş koltuklar oyun başlarken otomatik **bot** olur.

### Arkadaş ekleme
Her oyuncunun 6 haneli bir **Play Night ID**'si vardır (sol altta, tıklayınca kopyalanır).
Arkadaşının ID'sini **Arkadaşlar → Arkadaş ekle** kutusuna yaz. Karşı tarafa istek düşer,
kabul edince listeye eklenir. İkiniz de uygulamayı açık tuttuğunuz sürece çevrimiçi görünürsünüz.

---

## Çiz Babacım kuralları

- Herkesin bir **defteri** vardır. 1. turda kendi defterine bir cümle yazarsın.
- Defterler her tur bir kayar: sana gelen cümleyi **çizersin**.
- Sonraki oyuncu yalnızca **çizimi** görür, ne olduğunu **tahmin eder**. O tahmin bir sonrakine çizdirilir.
- Tur sayısı oyuncu sayısı kadardır (en az 4), yani her defter herkesin elinden **birer kez** geçer.
- Süre dolarsa elindeki hâliyle gönderilir — kimse oyunu kilitleyemez.
- Sonunda defterler tek tek, adım adım açılır. Çizimler yeniden çiziliyormuş gibi canlanır.
- Çizimler PNG değil **fırça darbesi** olarak saklanır: ağdan küçük geçer ve animasyonla oynatılabilir.

Süreler oda kurucusunun ayarından değiştirilebilir (varsayılan: 45 sn yazma, 75 sn çizim, 40 sn tahmin).

## UNO kuralları

Resmi Mattel kuralları uygulandı ([unorules.com](https://www.unorules.com/)):

- **108 kart:** her renkte bir 0, ikişer 1–9, ikişer Pas / Yön Değiştir / +2 (renk başına 25) + 4 Joker + 4 Joker+4.
- Herkese **7 kart**, üstten bir kart açılır. Açılan kart Joker+4 ise desteye geri konur.
- Renk, sayı ya da sembol eşleştirerek oyna. Oynayamıyorsan **bir kart çek**; çektiğin oynanabiliyorsa hemen oynayabilirsin.
- **Yön Değiştir iki kişilik oyunda Pas gibi çalışır.**
- **Joker+4:** kural olarak elinde masadaki renkten kart yokken oynanır — ama oyun bunu engellemez,
  **blöf yapabilirsin**. Sonraki oyuncu itiraz ederse elin açılır:
  blöfse **sen 4 çekersin**, itiraz haksızsa **o 6 çeker**.
- Son ikinci kartını oynarken **UNO** demezsen ve yakalanırsan **2 kart** ceza.
- Deste biterse atılanlar (üstteki hariç) karıştırılıp yeni deste olur.
- **Puanlama:** sayı kartları yüzü kadar, Pas/Yön/+2 20, Jokerler 50. Kazanan rakiplerin
  elinde kalanları alır; **500 puana** ilk ulaşan maçı kazanır (ayarlanabilir).

## Papaz Kaçtı kuralları

Kaynaklar: [Hürriyet](https://www.hurriyet.com.tr/aile/papaz-kacti-nasil-oynanir-oyunun-kurallari-nelerdir-papaz-kimde-kac-kagitla-oynanir-41900733),
[Milliyet](https://www.milliyet.com.tr/oyun/papaz-kacti-nasil-oynanir-papaz-kacti-oyunun-kurallari-nelerdir-6522043),
[Sabah](https://www.sabah.com.tr/yasam/papaz-kacti-nasil-oynanir-papaz-kimde-2-kisi-oynanir-mi-kac-kagit-dagitilir-kac-tane-papaz-olur-k1-6179094).

- 52'lik desteden **3 papaz çıkarılır** → **49 kart**. 48'i çift olur, geriye **eşsiz tek papaz** kalır.
- Kartlar herkese olabildiğince eşit dağıtılır; oyun başlamadan herkes elindeki çiftleri yere açar.
- Eşleşme **sayıya** göredir, renk önemsizdir (iki 7 çifttir, maça 3 ile maça 9 değildir).
- Sıran gelince **sağındaki oyuncunun elinden görmeden bir kart çekersin**. Eşleşirse o çift de yere gider.
- **Kartlarını istediğin gibi dizebilirsin** — sürükle, ya da **KARIŞTIR** (`K`) ile rastgele diz.
  Bu görsel bir süs değil: rakip senin elinden *konuma göre* çektiği için papazı saklamanın gerçek
  yolu budur. Tek kısıt: sıradaki oyuncu tam senden çekerken karıştıramazsın.
- Eli biten **kurtulur** ve masadan kalkar. Sonunda tek kalan — papaz ondadır — eli kaybeder.
- Varsayılan **5 el**; sonunda **en az papaz kalan kazanır**.

### 3B masa

Sahne Three.js ile çizilir: karanlık bir oda, tepeden sarkan ve hafifçe sallanan **tek bir ampul**,
altında yuvarlak keçe masa. Oyuncular masanın etrafında **3B kafalar** olarak oturur.

- **Kafa rengi profil renginden gelir.** Aksesuarlar (şapka/kasket/silindir/taç/fes, gözlük/güneş
  gözlüğü/maske, bıyık/sakal/papyon) **Ayarlar → Karakterin** bölümünden canlı 3B önizlemeyle seçilir.
- Botların da kendine ait, sabit bir görünümü vardır.
- **Tell:** papazı tutan acemi bot kartı elinde huzursuzca oynar ve öne iter. Bazıları blöf yapar;
  usta botlar gerçek papazı asla göstermez, üstelik karşısındakinin tell'ini okur.
- Kart seçtiğinde kart yelpazeden çıkar, ortaya gelir, **bir an durur** ve çevrilir.
  Papaz çıkarsa ampul patlar, masa sarsılır.
- Oyuncular olan bitene konuşma balonlarıyla laf atar.

> **Kart gizliliği:** Rakiplerin kartları hiçbir zaman istemciye gönderilmez — görünümde yalnızca
> *kart sayısı* vardır (`papaz/engine.js` → `viewFor`). 3B sahnede de yalnızca kapalı kart sırtları
> çizilir. Bu, hem birim testiyle hem canlı oyunda doğrulanır.

Three.js `vendor/three.min.js` olarak uygulamayla birlikte gelir; internet gerekmez.
WebGL çalışmazsa oyun düz arka planla sorunsuz oynanmaya devam eder.

## Satranç kuralları

Tam FIDE kural seti: rok, geçerken alma, terfi, pat, 50 hamle, üç tekrar,
yetersiz materyal. Hamle üretici **perft** ile 5 klasik pozisyonda doğrulanır
(başlangıç d4 = 197.281, Kiwipete d3 = 97.862 — hepsi birebir).

- **Satranç saati:** oyuncu başına süre + hamle başı artış (3+2 / 5+0 / 10+5 / 15+10 / sınırsız).
  Bayrak düşerse kaybedersin; rakipte mat edecek taş yoksa berabere.
- **1v1** klasik oyundur. **2v2 danışma** modunda iki takım vardır, her takımda 2 kişi;
  takım tek renk oynar ve **takımdaki herhangi biri** hamleyi yapabilir.
- **FİKİR VER** (`F`): bir kareye bas, oraya gidebilecek taşlarından birini seç.
  Takım arkadaşın tahtada **altın bir ok** görür ve **OYNA** ile tek tıkta oynayabilir.
  Fikirler görünüme yalnızca **kendi takımın için** eklenir (`satranc/engine.js` → `viewFor`);
  rakip takıma giden pakette bu veri hiç yoktur. Bot takım arkadaşı da fikir önerir.
- Renkler her oyunda değişir; seri (varsayılan 2 oyun) sonunda çok puan toplayan kazanır.
- Bot alfa-beta + sessiz arama (yalnız alışlar) + taş-kare tablolarıyla oynar.

## M3RANT

M3RANT ayrı bir depodur (Vite + TypeScript, Three.js + Rapier fizik). Derlenmiş
hâli `vendor/m3rant/` altında bu depoda tutulur, böylece Play Night yan klasöre
ihtiyaç duymadan derlenebilir. Komşuda `../m3rant` kaynağı varsa
`scripts/sync-m3rant.js` her derlemede onu yeniden derleyip tazeler; yoksa
elindeki kopyayla devam eder.

Oyun **kendi penceresinde** açılır ve `app://` ayrıcalıklı şemasından sunulur.
Bunun üç sebebi var:

- Vite `<script type="module">` üretir; modül betikleri CORS'a tabidir ve
  `file://` bunu geçemez — doğrudan diskten yüklemek boş pencere verir.
- Standart şema sayfayı **güvenli bağlam** yapar; WebRTC bunu bekler.
- **Nişan kilidi** gömülü bir çerçevenin izinlerine takılmaz ve oyunun kendi
  Three.js sürümü Papaz Kaçtı'nın sahnesiyle çakışmaz.

Sayfaya kendi CSP'si verilir: WASM fiziği için `'wasm-unsafe-eval'`, üretilen
ses/dokular için `blob:`, PeerJS işaretleşmesi için `wss:`. `eval()` hiçbir
yerde açık değildir.

İlk açılışta oyuncu adı Play Night profilinden `?name=` ile devredilir; M3RANT
bunu yalnızca **ilk profili** oluştururken kullanır, sonra oyuncunun kendi
seçimi geçerlidir.

## Güncelleme

Uygulama sürüm bilgisini depodaki **`update.json`** dosyasından okur. Yayınlamak için
GitHub Releases'e ya da API kimliğine gerek yoktur — **`git push` yetiyor**.

```
main dalı   →  update.json      (sürüm, notlar, indirme adresleri — birkaç KB)
dist dalı   →  PlayNight-setup.exe / PlayNight-portable.exe   (her yayında üstüne yazılır)
```

`dist` ayrı bir **öksüz dal**: her yayında sıfırdan yazıldığı için `main`'in geçmişi
70 MB'lık binary'lerle şişmez. Dosya adları sürümsüzdür, yani indirme adresi hep aynı kalır.

### Yeni sürüm yayınlamak

```bash
npm run release
```

`package.json`'daki sürümü yükselt, bu komutu çalıştır — derler, kurulum dosyalarını
`dist` dalına iter, `update.json`'ı günceller ve `main`'e gönderir. Açık olan uygulamalar
bunu görüp güncellemeyi teklif eder. (Sadece yayınlamak için: `npm run publish`)

### Kullanıcı tarafı

**Ayarlar → Güncelleme → GÜNCELLEMELERİ KONTROL ET.** Yeni sürüm varsa başlık çubuğunda
altın rozet çıkar; tıklayınca sürüm notları, boyut, **hız ve kalan süre** ile indirme başlar.
Bitince onayınla uygulama kapanır ve kurulum açılır. Açılışta sessiz kontrol varsayılan açıktır.

**Kopan indirme kaldığı yerden devam eder** — yarım dosya saklanır ve bir sonraki denemede
HTTP Range ile sürdürülür. Yavaş bağlantılar için önemli.

### Güvenlik

İndirme yalnızca `raw.githubusercontent.com`, `api.github.com` ve GitHub'ın dosya
sunucularından yapılır; başka alan adına yönlendirme reddedilir, yönlendirme sayısı sınırlıdır
ve **yalnızca uygulamanın kendi indirdiği klasördeki `.exe`** çalıştırılabilir.
Manifest okunamazsa GitHub Releases API'sine düşülür.

## Masadaki kontroller

| Girdi | Ne yapar |
|---|---|
| **Boşluk** | Kapalı desteden taş çek |
| Desteye tıkla | Kapalı desteden taş çek |
| Soldaki oyuncunun atık alanına tıkla | Attığı taşı al |
| **Çift tık** / taşı atık alanına sürükle | Taşı at |
| Taşı sürükle | Istakada yerini değiştir |
| **S** / **D** | Sayıya / renge göre sırala |
| **A** | Perleri otomatik diz |
| **Enter** | El aç |
| Taşa tıkla → masadaki pere tıkla | İşleme yap |

> **El açma:** Istakada perleri yan yana diz ve **araya boş yuva bırak**.
> Uygulama bitişik öbekleri per olarak okur; toplam 101 puanı geçince **EL AÇ** düğmesi yeşil yanar.

---

## Uygulanan 101 Okey kuralları

Kural kaynakları: [pagat.com/rummy/okey101](https://www.pagat.com/rummy/okey101.html),
[Vikipedi — Okey 101](https://tr.wikipedia.org/wiki/Okey_101),
[okeydeyim.net](https://www.okeydeyim.net/101-okey-nasil-oynanir.html),
[altinstar.com](https://www.altinstar.com/okey-nasil-oynanir/okey-101-kurallar).

- **106 taş:** 4 renkte 1–13, her taştan 2 kopya (104) + 2 sahte okey.
- **Dağıtım:** 4 oyuncu, herkese 21 taş, başlayana 22. Gösterge açılır, destede 20 taş kalır.
- **Okey:** göstergenin aynı rengindeki bir üst sayı (13 → 1). Joker olarak her taşın yerine geçer.
- **Sahte okey:** göstergenin taşının yerine geçer.
- **Perler:** seri (aynı renk ardışık 3+), grup (aynı sayı farklı renk 3–4), çift (birebir aynı 2 taş).
- **1 taşı** hem 1-2-3 hem 12-13-1 dizisinde kullanılır (13-1-2 geçersiz), daima 1 puan.
- **El açma:** tek hamlede ≥ **101 puan**, ya da ≥ **5 çift**. Seri ile çift karıştırılamaz.
- **İşleme:** açtıktan sonra herkesin seri/gruplarına taş eklenebilir; çiftlere eklenemez.
- **Her tur taş atarak biter** — bitiren el dahil.
- **Cezalar:** okey atmak +101, masadaki pere işlenebilen taşı atmak +101,
  deste bitince elde kalan her okey +101.
- **Deste biterse** sıradaki oyuncu yerdeki taşı almazsa el kazanansız biter.

### Puanlama

Puanlar sıfırdan başlar. Kararlaştırılan el sayısı (varsayılan **11**) dolunca
**en düşük puanlı oyuncu maçı kazanır**.

| Bitiş türü | Kazanan | Seri açanlar | Çift açanlar | Açmayanlar |
|---|---|---|---|---|
| Seri ile, normal taş atarak | −101 | el toplamı | ×2 | +202 |
| Seri ile, okey atarak | −202 | ×2 | ×4 | +404 |
| Çift ile, normal taş atarak | −202 | ×2 | ×4 | +404 |
| Çift ile, okey atarak | −404 | ×4 | ×8 | +404 |
| Elden bitirme (kimse açmadan) | −202 | herkes +404 | | |
| Elden bitirme + okey atarak | −404 | herkes +808 | | |

---

## Bağlantı nasıl çalışıyor?

| Katman | Ne yapıyor |
|---|---|
| **PeerJS bulut aracısı** | Sadece iki tarafı tanıştırır (signaling). Oyun verisi buradan geçmez. |
| **STUN** | NAT arkasındaki gerçek adresi bulur — port açmayı gereksiz kılan kısım budur. |
| **TURN (yedek)** | Doğrudan bağlantı kurulamayan zor ağlarda trafiği aktarır. |
| **WebRTC DataChannel** | Oyun verisi doğrudan iki bilgisayar arasında akar. |

Her oyuncunun iki kimliği olur: kişisel (`pn-<ID>`, arkadaş/davet için) ve oda
(`pnr-<KOD>`, yalnızca oda kuranda). Oda kuran **otoritedir**: kural motorunu o çalıştırır,
diğerlerine yalnızca görmeleri gereken durumu yollar — yani kimse başkasının elini göremez.

Çok kısıtlı ağlarda **Ayarlar → Bağlantı** bölümünden kendi TURN sunucunu tanımlayabilirsin:

```json
[{ "urls": "turn:sunucum.com:3478", "username": "kullanici", "credential": "sifre" }]
```

---

## Proje yapısı

```
electron/main.js        pencere, kalıcı depolama, IPC
electron/preload.js     güvenli köprü (contextIsolation açık)
src/index.html          tüm görünümler
src/css/                theme · intro · views · okey
src/css/               theme · intro · views · okey · ciz
src/js/okey/engine.js  101 Okey kural motoru (saf, DOM'suz, Node'da da çalışır)
src/js/okey/bot.js     okey bot kararları
src/js/okey/table.js   okey masası ve animasyonlar
src/js/ciz/engine.js   Çiz Babacım defter/tur mantığı (saf)
src/js/ciz/draw.js     çizim tuvali, vektör biçimi, tekrar oynatma
src/js/ciz/bot.js      çizim botları
src/js/ciz/game.js     Çiz Babacım arayüzü ve albüm sunumu
src/js/uno/engine.js   UNO kural motoru (saf)
src/js/uno/bot.js      UNO botları (blöf ve itiraz kararları dahil)
src/js/uno/table.js    UNO masası, renk seçici, itiraz penceresi
src/js/papaz/engine.js Papaz Kaçtı kural motoru (saf)
src/js/papaz/bot.js    botlar: kart seçimi, tell'ler, laf atmalar
src/js/papaz/scene3d.js 3B oda, ampul, masa ve karakterler (Three.js)
src/js/papaz/table.js  masa arayüzü, çekme sahnesi, isim/balon katmanı
src/js/satranc/engine.js satranç kural motoru (0x88, perft'le doğrulanmış, saf)
src/js/satranc/bot.js  satranç botu (alfa-beta + sessiz arama)
src/js/satranc/table.js tahta, saatler, hamle listesi, FİKİR VER katmanı
vendor/m3rant/        M3RANT'ın derlenmiş hâli (app:// ile sunulur)
scripts/sync-m3rant.js  M3RANT'ı komşu depodan derleyip içeri alır
src/js/update.js       sürüm kontrolü ve kurulum arayüzü
src/js/net.js          WebRTC / PeerJS taşıma katmanı
src/js/room.js         lobi + oyun oturumları (host otoritesi, iki oyunu da taşır)
src/js/friends.js      arkadaş listesi, çevrimiçi durumu, davet
tests/                 kural testleri + tam maç simülasyonu
```

Profil, arkadaşlar ve ayarlar `%APPDATA%\Play Night\playnight-store.json` dosyasında tutulur
(Ayarlar → *Veri klasörü yolu*).
