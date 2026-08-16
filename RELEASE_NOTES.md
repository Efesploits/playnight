# Play Night v1.2.1

Arkadaşlarınla oyun gecesi. **Port açmana gerek yok** — bağlantı eşler arası (WebRTC) kurulur.

## İndir

| Dosya | Ne zaman kullan |
|---|---|
| **PlayNight-setup.exe** | Kurulum sihirbazı. Masaüstü ve başlat menüsü kısayolu ekler. |
| **PlayNight-portable.exe** | Kurulum istemez, çift tıkla açılır. Arkadaşına göndermek için ideal. |

> Windows SmartScreen uyarı verebilir: dosya imzalı değil.
> **Ek bilgi → Yine de çalıştır** ile geçebilirsin.

## Yenilikler

### 🃏 Papaz Kaçtı: kartlarını istediğin gibi diz

Rakip senin elinden **konuma göre** kart çekiyor — yani papazın elinde nerede durduğu
gerçekten önemli. Artık kartlarını dilediğin sıraya koyabilirsin:

- **Sürükle bırak:** kartı tut, istediğin yere taşı. Diğerleri kenara kayıp yer açar.
- **KARIŞTIR düğmesi** (ya da **K** tuşu): hepsini bir hamlede rastgele dizer.
- Çektiğin yeni kart elinin rastgele bir yerine girer — istersen taşırsın.
- Tek kısıt: **sıradaki oyuncu tam senden çekerken karıştıramazsın** (adil olsun diye).

Bu yalnızca görsel bir düzenleme değil — sıralama gerçekten motora işleniyor, yani
papazı saklamak artık işe yarayan bir strateji.

## Oyunlar

| Oyun | Kişi |
|---|---|
| 🎴 **101 Okey** | 4 |
| ✏️ **Çiz Babacım** | 2–8 |
| 🃏 **UNO** | 2–6 |
| 🕯️ **Papaz Kaçtı** | 2–6 |

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
node tests/engine.test.js       # 141 okey
node tests/ciz.test.js          # 124 çiz babacım
node tests/uno.test.js          # 135 uno
node tests/papaz.test.js        # 130 papaz kaçtı
node tests/update.test.js       #  23 güncelleme
node tests/sim.test.js 20       # 20 tam okey maçı
node tests/uno-sim.test.js 20   # 20 tam uno maçı
node tests/papaz-sim.test.js 20 # 20 tam papaz kaçtı maçı
```
