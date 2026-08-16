# 🎴 Play Night

Arkadaşlarınla oyun gecesi. Sinematik açılış, mavi-siyah tema ve iki oyun:
tam kurallarıyla **101 Okey** ve Gartic Phone tarzı **Çiz Babacım**.
Windows masaüstü uygulaması (Electron).

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
node tests/engine.test.js  # 141 okey kural testi
node tests/ciz.test.js     # 124 çiz babacım testi
node tests/sim.test.js 25  # botlar 25 tam okey maçı oynar, kural/taş bütünlüğü denetlenir
```

---

## Oyunlar

| Oyun | Kişi | Ne yapılıyor |
|---|---|---|
| **101 Okey** | 4 | Klasik yüzbir: gösterge, okey, 101 puanla açma, işleme, tam puanlama. |
| **Çiz Babacım** | 2–8 | Yaz → çiz → tahmin et → çiz… Cümle elden ele geçtikçe tanınmaz olur, sonunda albüm açılır. |

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
src/js/net.js          WebRTC / PeerJS taşıma katmanı
src/js/room.js         lobi + oyun oturumları (host otoritesi, iki oyunu da taşır)
src/js/friends.js      arkadaş listesi, çevrimiçi durumu, davet
tests/                 kural testleri + tam maç simülasyonu
```

Profil, arkadaşlar ve ayarlar `%APPDATA%\Play Night\playnight-store.json` dosyasında tutulur
(Ayarlar → *Veri klasörü yolu*).
