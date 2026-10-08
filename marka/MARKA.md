<!-- DOLDURULMADI — Claude: bu satır duruyorsa önce `marka-kimligi` skill'ini çalıştır. Doldurunca bu satırı sil. -->

# Marka kimliği

> Bu dosya kanalının kurgu kimliği. Claude her videoya başlamadan önce bunu okur.
> Elle doldurabilirsin ama en kolayı Claude'a **"markamı kur"** demek: sana soru sorar, referanslarına bakar,
> bu dosyayı ve `src/theme/theme.ts`'i senin için doldurur. Sonra istediğin zaman burayı elle değiştirebilirsin.

## 1. Kanal

- **Kanal adı / handle:**
- **Konu:** (ör. yazılım, yemek, kişisel finans, el işi…)
- **İzleyici:** (kim, ne biliyor, ne bilmiyor)
- **Videonun dili / ekran yazılarının dili:** Türkçe
- **Kanalın tek cümlelik vaadi:**

## 2. Marka fikri (grafiklerin hissi, tek cümle)

> ör. "Bir geliştiricinin çalışma defteri", "Sakin bir öğretmenin tahtası", "Hızlı bir haber bülteni",
> "Sıcak bir mutfak defteri", "Minimal İsviçre posteri"

## 3. Görsel kimlik

| Token | Değer | Not |
|---|---|---|
| Zemin (panel/pano) | | koyu mu açık mı? |
| Metin | | |
| **Vurgu rengi (tek)** | | ekranda bakılacak tek şey bu renkte |
| Negatif / yanlış | | yalnızca ✗ ve üstü çizili iddialar |
| Başlık fontu | | Google Fonts'tan (Türkçe karakter destekli) |
| Metin fontu | | |
| Etiket fontu (mono) | | ör. JetBrains Mono — istemiyorsan "yok" |
| Köşe yuvarlaklığı | | keskin / hafif / yuvarlak |

## 4. Hareket ve tempo

- **Tempo:** sade (≈20–25 olay / 10 dk) · dengeli (≈30–40) · yoğun (≈45+)
- **Giriş hissi:** sakin kayma · sert pop · yazı makinesi · …
- **Zoom / punch-in:** hiç · ara sıra · sık
- **Asla:** (ör. parlama, parçacık, zıplama, sallanma…)

## 5. Ses

- **Efekt yoğunluğu:** hiç · hafif · belirgin
- **Efekt karakteri:** (ör. yumuşak UI tıkları, ahşap tıkırtı, retro oyun sesleri…)
- **Müzik:** her videoda kendim veririm (`public/assets/`) · müzik yok · varsayılan parça (`library/audio/music/`)
- **Müzik seviyesi:** çok kısık · kısık · belirgin

## 6. Açılış ve kapanış

- **Hook tarzı:** (soru · çarpıcı rakam · üstü çizilen iddia · soğuk açılış)
- **Abone kartı:** var / yok — avatar: `public/marka/avatar.jpg` (yüzünün olduğu kare bir fotoğraf)
- **Kapanış kartı:** (ör. "@handle + Kanala abone olmayı unutma :)")
- **Bölüm etiketi stili:** (ör. `● 03  KURULUM` · `Bölüm 3 — Kurulum` · yok)

## 7. Çalışma tercihleri

- **Onay:** onay sormadan bitir, sonra revize ederim · önce içerik kontrol listesini göster · önce planı göster
- **Altyazı:** gömülü değil (SRT ayrı) · gömülü
- **Format:** 4K HDR (iPhone) · 1080p SDR · dikey Reels de lazım

## 8. Sevdiğim / sevmediğim (referanslar)

- Sevdiğim kurgular (link + neyi sevdiğim): → kareleri `marka/style-refs/` içine koy
- Asla istemediğim şeyler:
