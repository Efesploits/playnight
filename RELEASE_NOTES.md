# Play Night v1.2.0

Arkadaşlarınla oyun gecesi. **Port açmana gerek yok** — bağlantı eşler arası (WebRTC) kurulur.

## İndir

| Dosya | Ne zaman kullan |
|---|---|
| **PlayNight-1.2.0-setup.exe** | Kurulum sihirbazı. Masaüstü ve başlat menüsü kısayolu ekler. |
| **PlayNight-1.2.0-portable.exe** | Kurulum istemez, çift tıkla açılır. Arkadaşına göndermek için ideal. |

> Windows SmartScreen uyarı verebilir: dosya imzalı değil.
> **Ek bilgi → Yine de çalıştır** ile geçebilirsin.

## Yenilikler

### 🕯️ Papaz Kaçtı — 2-6 kişi, **3B masa**

Karanlık bir oda, tepeden sarkan ve hafifçe sallanan tek bir ampul, altında yuvarlak keçe masa.
Oyuncular masanın etrafında 3B kafalar olarak oturuyor.

- **Kafan senin profil renginde.** Aksesuarları **Ayarlar → Karakterin**'den canlı 3B önizlemeyle seç:
  şapka / kasket / silindir / taç / fes, gözlük / güneş gözlüğü / maske, bıyık / sakal / papyon.
- **Tell mekaniği:** papazı tutan acemi bot kartı elinde huzursuzca oynar ve öne iter.
  Bazıları blöf yapar. Usta botlar gerçek papazı asla göstermez — üstelik seninkini okur.
- Kart seçtiğinde kart yelpazeden çıkar, ortaya gelir, **bir an durur**, sonra çevrilir.
  Papaz çıkarsa ampul patlar, masa sarsılır.
- Oyuncular olan bitene konuşma balonlarıyla laf atar.
- Tam kurallarıyla: 49 kart (3 papaz çıkarılmış), açılış çiftleri, sağdakinden çekme,
  eli biten kurtulur, sonunda papaz kimde kalırsa o kaybeder. 5 elde en az papaz kalan kazanır.

**Kart gizliliği:** Rakiplerin kartları hiçbir zaman istemciye gönderilmiyor — yalnızca kart *sayısı*
gidiyor. 3B sahnede de sadece kapalı kart sırtları çiziliyor. Hem birim testiyle hem canlı oyunda doğrulandı.

### Düzeltmeler
- Papaz Kaçtı'da kart seçimi sunucuya iletilmiyordu — düzeltildi
- Konuşma balonu ilk karede yanlış yerde beliriyordu
- Hamle reddedilirse masa kilitlenmesin diye kurtarma süresi eklendi

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

## Test

```
node tests/engine.test.js       # 141 okey
node tests/ciz.test.js          # 124 çiz babacım
node tests/uno.test.js          # 135 uno
node tests/papaz.test.js        # 113 papaz kaçtı
node tests/update.test.js       #  23 güncelleme
node tests/sim.test.js 20       # 20 tam okey maçı
node tests/uno-sim.test.js 20   # 20 tam uno maçı
node tests/papaz-sim.test.js 20 # 20 tam papaz kaçtı maçı
```
