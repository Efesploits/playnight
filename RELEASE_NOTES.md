# Play Night v1.1.0

Arkadaşlarınla oyun gecesi. **Port açmana gerek yok** — bağlantı eşler arası (WebRTC) kurulur.

## İndir

| Dosya | Ne zaman kullan |
|---|---|
| **PlayNight-1.1.0-setup.exe** | Kurulum sihirbazı. Masaüstü ve başlat menüsü kısayolu ekler. |
| **PlayNight-1.1.0-portable.exe** | Kurulum istemez, çift tıkla açılır. Arkadaşına göndermek için ideal. |

> Windows SmartScreen uyarı verebilir: dosya imzalı değil.
> **Ek bilgi → Yine de çalıştır** ile geçebilirsin.

## Yenilikler

### 🃏 UNO eklendi — 2-6 kişi
- 108 kartlık klasik deste, resmi Mattel kurallarıyla
- Pas, Yön Değiştir, +2, Joker ve Joker+4
- **Joker+4 blöfü ve itirazı:** kural gereği elinde masadaki renkten kart yokken oynamalısın,
  ama blöf yapabilirsin. Rakip itiraz eder, elin açılır — blöfse 4, haksız itirazsa o 6 çeker.
- **UNO demeyi unutursan yakalanırsın:** rakiplerin panelinde çıkan YAKALA! düğmesiyle 2 kart ceza
- Yön göstergesi, aktif renge göre değişen masa ışığı, renk seçici, süre halkası
- 500 puana ilk ulaşan kazanır (100/200/300/500 seçilebilir)

### 🔄 Güncelleme sistemi
- **Ayarlar → Güncelleme**'den tek tıkla sürüm kontrolü
- Yeni sürüm varsa başlık çubuğunda altın rozet belirir
- Sürüm notları, dosya boyutu ve ilerleme çubuğuyla indirme
- Onayınla uygulama kapanır, kurulum açılır
- Açılışta sessiz kontrol (kapatılabilir)

### Düzeltmeler
- Başlık çubuğu bağlantı göstergesi sonsuza dek "Bağlanıyor" yazıyordu — düzeltildi
- 101 Okey per çözücüsü, grup perini kurarken seriye lazım olan taşı çalabiliyordu;
  bu bazı 100+ puanlık elleri açılamaz gösteriyordu — düzeltildi, botlar da güçlendi
- Oyun ekranlarında kenar çubuğu artık tamamen gizleniyor
- Türkçe büyük harf dönüşümü (i → İ) düzeltildi

## Oyunlar

| Oyun | Kişi |
|---|---|
| 🎴 **101 Okey** | 4 |
| ✏️ **Çiz Babacım** | 2–8 |
| 🃏 **UNO** | 2–6 |

Hepsi bot destekli ve online oynanabilir. Oda kur, 6 haneli kodu paylaş ya da
arkadaş listenden tek tıkla davet et.

## Bilinen sınırlar

- Yalnızca Windows x64
- Uygulama imzalı değil (SmartScreen uyarısı)
- Çok kısıtlı ağlarda yedek TURN sunucuları kamusal/ücretsizdir;
  sorun çıkarsa **Ayarlar → Bağlantı**'dan kendi TURN sunucunu tanımlayabilirsin
- Arkadaş listesinde çevrimiçi görünmek için iki tarafın da uygulamayı açık tutması gerekir

## Test

```
node tests/engine.test.js     # 141 okey kural testi
node tests/ciz.test.js        # 124 çiz babacım testi
node tests/uno.test.js        # 135 uno kural testi
node tests/update.test.js     #  23 güncelleme testi
node tests/sim.test.js 20     # 20 tam okey maçı
node tests/uno-sim.test.js 20 # 20 tam uno maçı
```
