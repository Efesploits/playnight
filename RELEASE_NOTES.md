# Play Night v1.3.0

Arkadaşlarınla oyun gecesi. **Port açmana gerek yok** — bağlantı eşler arası (WebRTC) kurulur.

## İndir

| Dosya | Ne zaman kullan |
|---|---|
| **PlayNight-setup.exe** | Kurulum sihirbazı. Masaüstü ve başlat menüsü kısayolu ekler. |
| **PlayNight-portable.exe** | Kurulum istemez, çift tıkla açılır. Arkadaşına göndermek için ideal. |

> Windows SmartScreen uyarı verebilir: dosya imzalı değil.
> **Ek bilgi → Yine de çalıştır** ile geçebilirsin.

## Yenilikler

### ♟️ SATRANÇ — 1v1 ve 2v2 danışma modu

Tam kurallı satranç: rok, geçerken alma, terfi, pat, 50 hamle, üç tekrar,
yetersiz materyal — hepsi var. Satranç saati (süre + hamle başı artış),
SAN hamle listesi, alınan taşlar ve materyal farkı, sürükle ya da tıkla oyna.

**2v2 danışma modu** bu sürümün yıldızı:

- İki takım, her takımda **2 kişi**. Takım tek renk oynar ve
  **takımdaki herhangi biri** hamleyi yapabilir — kararı aranızda verirsiniz.
- **FİKİR VER** (kısayol **F**): bir kareye bas, oraya gidebilecek taşlarından
  birini seç. Takım arkadaşın tahtada **altın bir ok** görür ve isterse
  **OYNA** ile tek tıkta oynar.
- Fikirler **yalnızca kendi takımına** görünür — rakip takım okları asla görmez.
- Bot takım arkadaşın da sırası gelince sana fikir fısıldar.
- Lobide takım rozetine tıklayarak takımını seçersin; 3. kişi odaya girince
  oda kendiliğinden 2v2 olur.
- Renkler her oyunda değişir; seride çok puan toplayan maçı alır.

Motor 5 klasik perft pozisyonuyla doğrulandı (Kiwipete dahil, 371.000+ düğüm).
Bot alfa-beta + sessiz aramayla oynar, tek hamlelik matı asla kaçırmaz.

## Oyunlar

| Oyun | Kişi |
|---|---|
| 🎴 **101 Okey** | 4 |
| ✏️ **Çiz Babacım** | 2–8 |
| 🃏 **UNO** | 2–6 |
| 🕯️ **Papaz Kaçtı** | 2–6 |
| ♟️ **Satranç** | 2 veya 4 (2v2) |

Hepsi bot destekli ve online oynanabilir. Oda kur, 6 haneli kodu paylaş ya da
arkadaş listenden tek tıkla davet et.

## Bilinen sınırlar

- Yalnızca Windows x64
- Uygulama imzalı değil (SmartScreen uyarısı)
- 3B sahne WebGL ister; çalışmazsa Papaz Kaçtı düz arka planla sorunsuz oynanır
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
```
