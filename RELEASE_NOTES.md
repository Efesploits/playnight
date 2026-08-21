# Play Night v1.4.0

Arkadaşlarınla oyun gecesi. **Port açmana gerek yok** — bağlantı eşler arası (WebRTC) kurulur.

## İndir

| Dosya | Ne zaman kullan |
|---|---|
| **PlayNight-setup.exe** | Kurulum sihirbazı. Masaüstü ve başlat menüsü kısayolu ekler. |
| **PlayNight-portable.exe** | Kurulum istemez, çift tıkla açılır. Arkadaşına göndermek için ideal. |

> Windows SmartScreen uyarı verebilir: dosya imzalı değil.
> **Ek bilgi → Yine de çalıştır** ile geçebilirsin.

## Yenilikler

### 🎯 M3RANT artık Play Night'ın içinde

5v5 taktiksel nişancı oyunu **M3RANT** uygulamayla birlikte geliyor. Oyunlar
sekmesinden **BAŞLAT**'a bastığında kendi penceresinde açılıyor:

- **8 ajan**, dörder yetenekle — dumanlar, flaşlar, duvarlar, tuzaklar, ultiler
- **3 harita**: Basecamp, Ridge, Hollow
- **18 silah**, öğrenilebilir tepme desenleri, duvar delme, mesafeye göre hasar
- Alım turu, kredi, bomba kurma/imha, 13 galibiyete ilk ulaşan kazanır
- Dört zorlukta **botlar** ve altı haneli oda koduyla **online** oynanış
- Karakterler, kaplamalar, sesler — hepsi kodla üretiliyor, tek bir görsel dosya yok

Ayrı pencerede açılması bilinçli: nişan kilidi (pointer lock) gömülü bir
çerçevenin izinlerine takılmıyor, oyun tüm pencereyi kullanıyor ve kendi
Three.js sürümü Papaz Kaçtı'nın 3B masasıyla çakışmıyor. Play Night arkada
açık kalıyor, oyunu kapatınca geri dönüyorsun.

**İlk açılışta adın Play Night profilinden alınıyor.** Sonrasında M3RANT içinde
adını değiştirirsen o geçerli olur — Play Night bir daha üstüne yazmaz.

## Oyunlar

| Oyun | Kişi |
|---|---|
| 🎴 **101 Okey** | 4 |
| ✏️ **Çiz Babacım** | 2–8 |
| 🃏 **UNO** | 2–6 |
| 🕯️ **Papaz Kaçtı** | 2–6 |
| ♟️ **Satranç** | 2 veya 4 (2v2) |
| 🎯 **M3RANT** | 5v5 |

Kart ve masa oyunları bot destekli ve oda koduyla online oynanır. M3RANT kendi
ağını ve oda kodunu kullanır.

## Bilinen sınırlar

- Yalnızca Windows x64
- Uygulama imzalı değil (SmartScreen uyarısı)
- M3RANT ve Papaz Kaçtı'nın 3B sahnesi WebGL ister
- Çok kısıtlı ağlarda yedek TURN sunucuları kamusal/ücretsizdir;
  **Ayarlar → Bağlantı**'dan kendi TURN sunucunu tanımlayabilirsin
- Arkadaş listesinde çevrimiçi görünmek için iki tarafın da uygulamayı açık tutması gerekir
- İndirme yavaşsa kopan indirme kaldığı yerden devam eder

## Test

```
node tests/engine.test.js         # 141 okey
node tests/ciz.test.js            # 124 çiz babacım
node tests/uno.test.js            # 135 uno
node tests/papaz.test.js          # 130 papaz kaçtı
node tests/satranc.test.js        # 109 satranç (perft dahil)
node tests/update.test.js         #  23 güncelleme
node tests/sim.test.js 20         # 20 tam okey maçı
node tests/uno-sim.test.js 20     # 20 tam uno maçı
node tests/papaz-sim.test.js 20   # 20 tam papaz kaçtı maçı
node tests/satranc-sim.test.js 10 # 10 tam satranç oyunu (1v1 + 2v2)
npm run smoke:m3rant              # M3RANT açılıyor ve maç başlıyor mu
npm run smoke:launch              # Play Night'tan başlatma zinciri
```
