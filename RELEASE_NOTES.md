# Play Night v1.0.0

Arkadaşlarınla oyun gecesi. **Port açmana gerek yok** — bağlantı eşler arası (WebRTC) kurulur.

## İndir

| Dosya | Ne zaman kullan |
|---|---|
| **PlayNight-1.0.0-setup.exe** | Kurulum sihirbazı. Masaüstü ve başlat menüsü kısayolu ekler. |
| **PlayNight-1.0.0-portable.exe** | Kurulum istemez, çift tıkla açılır. Arkadaşına göndermek için ideal. |

> Windows SmartScreen uyarı verebilir: dosya imzalı değil.
> **Ek bilgi → Yine de çalıştır** ile geçebilirsin.

## Oyunlar

### 🎴 101 Okey — 4 kişi
Klasik yüzbir, tam kurallarıyla:
- 106 taş, herkese 21 (başlayana 22), gösterge ve okey
- 101 puanla ya da 5 çiftle el açma, seri/çift ayrımı
- İşleme, okey atma cezası, deste bitiminde son alma hakkı
- Pagat'ın tam puanlama tablosu (elden bitirme ve okeyle bitirme katları dahil)
- Istakada perleri yan yana diz, araya boşluk bırak — uygulama öbekleri kendi okur

### ✏️ Çiz Babacım — 2-8 kişi
Gartic Phone tarzı:
- Bir cümle yaz → biri onu çizsin → bir başkası çizimi tahmin etsin → tekrar çizilsin
- Her defter herkesin elinden birer kez geçer
- Sonunda albüm adım adım açılır, çizimler yeniden çiziliyormuş gibi canlanır
- 14 renk, 5 kalınlık, silgi, geri al, temizle

## Öne çıkanlar

- Sinematik açılış animasyonu (ESC ile atlanır, ayarlardan kapatılır)
- Mavi-siyah tema, bold tipografi, akıcı geçişler
- **Port açmadan multiplayer:** oda kur, 6 haneli kodu paylaş
- **Arkadaş sistemi:** ID ile ekle, çevrimiçi durumunu gör, tek tıkla oyuna davet et
- **Botlar:** boş koltuklar dolar; okey botları gerçekten oynar
- Tüm sesler uygulama içinde sentezlenir, dış dosya yoktur

## Bilinen sınırlar

- Yalnızca Windows x64
- Uygulama imzalı değil (SmartScreen uyarısı)
- Çok kısıtlı ağlarda yedek TURN sunucuları kamusal/ücretsizdir;
  sorun çıkarsa **Ayarlar → Bağlantı**'dan kendi TURN sunucunu tanımlayabilirsin
- Arkadaş listesinde çevrimiçi görünmek için iki tarafın da uygulamayı açık tutması gerekir

## Test

```
node tests/engine.test.js   # 141 okey kural testi
node tests/ciz.test.js      # 124 çiz babacım testi
node tests/sim.test.js 25   # 25 tam maç bot simülasyonu
```
