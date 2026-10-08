# Claude Kurgu Atölyesi

Konuşan-kafa (talking-head) YouTube videolarını **Claude Code ile, kod yazarak** kurgulamak için hazır bir atölye.
Videonu bir klasöre koyup Claude'a **"bunu kurgula"** diyorsun. Claude sırayla şunları yapıyor:

1. Videoyu deşifre ediyor ve konuşmayı anlıyor.
2. Kurgu planını yazıyor.
3. Kelimeye senkron grafikleri, tam ekran animasyonları, ses efektlerini ve müziği ekliyor.
4. Kalite kontrolünden geçirip teslim ediyor.

Revizyonları da yazarak istiyorsun ("şu yazı sola gelsin", "müziği kıs").

> **Önemli:** Bu repo bir şablon. İlk kurulumda Claude sana kanalınla ilgili sorular soruyor ve **kendi marka
> kimliğini** (renkler, fontlar, tempo, ses) oluşturuyor. Verdiğin her düzeltme de bir "ev kuralı" olarak kaydediliyor.
> Birkaç videodan sonra atölye **senin** tarzında kurgu yapıyor.

---

## Gerekenler

| Ne | Kim kurar | Nasıl |
|---|---|---|
| **Claude Code** + ücretli plan (Pro / Max) | sen | https://claude.com/claude-code |
| **Node.js** + **FFmpeg** | sen (ya da Claude, izin vererek) | `brew install node ffmpeg` |
| **whisper.cpp** (Türkçe deşifre) | Claude kurar, sen onaylarsın | `brew install whisper-cpp` + model (~1,6 GB) |
| npm paketleri (Remotion, React, zod…) | Claude kurar | `npm install` |
| ElevenLabs hesabı | isteğe bağlı | gerekmez; efektler kodla üretilir. Özel efekt istersen kullanılabilir |

Mac (Apple Silicon) önerilir. Varsayılan hat **iPhone 4K HDR** videoları için kurulu; 1080p ve SDR videolar da çalışır.

### Önerilen skill'ler (bir kez)

```bash
npx skills add remotion-dev/skills                  # Remotion'ın resmi skill'i (en önemlisi)
npx skills add digitalsamba/claude-code-video-toolkit   # ffmpeg skill'i (listeden "ffmpeg"i seç)
```

Repoyla birlikte iki skill geliyor:

| Skill | Ne yapar |
|---|---|
| `marka-kimligi` | Kurulum: makine kontrolü, marka röportajı, tema |
| `video-kurgula` | Kurgu akışının tamamı |

---

## Kurulum (5 dakika)

```bash
git clone <bu-repo> kurgu && cd kurgu
claude
```

Claude açılınca şunu yaz:

```
markamı kur
```

Claude eksik araçları kontrol edip kurar, sana ~10 soru sorar ve sonucu şu dosyalara yazar:

- `marka/MARKA.md`
- `src/theme/theme.ts`

Ardından örnek bir kare render edip sana gösterir.

**İpucu:** Beğendiğin kanallardan 3–6 ekran görüntüsünü `marka/style-refs/` klasörüne koy. Claude o kurguların
dilini (yerleşim, tempo, yazı hiyerarşisi) çıkarır ama renklerini kopyalamaz.

---

## Her video için

1. Kurgulanmış (kesilmiş) videonu `public/main.mov` olarak koy.
2. Ekran kayıtlarını, ekran görüntülerini ve **müziğini** `public/assets/` klasörüne koy.
3. Claude'a şunu yaz:

```
bunu kurgula
```

Claude süreleri söyleyip işe başlar. 7–8 dakikalık 4K bir video yaklaşık 3–4 saat sürer; bu sürenin çoğu
render, sen başında beklemek zorunda değilsin. İş bitince `out/` klasöründe şunlar olur:

- `final-hlg.mov`: yüklenecek video
- altyazı (`.srt`)
- ses kanalları ayrı ayrı (stem'ler)
- bir README
- YouTube bölüm listesi

Oturum kapanırsa `devam` yazman yeterli; Claude `work/progress.md` dosyasından kaldığı yerden sürdürür.

### Revizyon

Düz Türkçe yazman yeterli:

- "E07'deki yazı yüzümün üstüne geliyor, sola al"
- "müziği biraz kıs"
- "şu bölüme tam ekran animasyon koy"

Yalnızca değişen parçalar yeniden render edilir.

### Atölyeyi kendine öğretmek (asıl güç burada)

- Bir şeyi **iki kez** düzelttiysen Claude bunu kalıcı kural olarak yazar:
  `.claude/skills/video-kurgula/references/editorial-style.md` → **Ev kuralları**.
- Tek seferde kalıcı olsun istiyorsan **"bunu kural yap"** de.
- Marka değişikliği için "rengimi değiştir" ya da "daha sade olsun" demen yeterli.
- 3–4 videodan sonra ilk teslimler neredeyse revizyonsuz gelir.

---

## Klasör yapısı

```
marka/            ← SENİN kimliğin: MARKA.md + style-refs/
.claude/skills/   ← marka-kimligi (kurulum) + video-kurgula (akış, kurallar, sesler, teslim)
src/              ← Remotion grafik bileşenleri, plan şeması, tema (theme.ts)
scripts/          ← numaralı hat: probe → proxy → deşifre → plan → render → birleştir → ses → QC
library/          ← ses ayarları, (isteğe bağlı) kendi efektlerin, whisper sözlüğü, örnek plan
work/ out/ public/← o anki videonun dosyaları (git'e girmez)
projects/         ← biten videoların arşivi (git'e girmez)
```

Bir videonun bütün kurgusu tek bir dosyada durur: `work/edit-plan.json`. Her grafik için şunlar yazılır:
ne zaman girdiği, ne yazdığı, hangi cümleye dayandığı ve neden orada olduğu.

## Bilmen gerekenler

- **Claude ses duyamaz ve HDR göremez.** Kareleri ve ölçümleri kendisi kontrol eder; müzik dengesini ve son
  görüntüyü senin gözün ve kulağın onaylar. Teslim mesajında neye bakman gerektiğini ayrıca yazar.
- Ses efektleri kodla üretilir (lisans derdi yok). Kendi efektlerini `library/audio/sfx/` içine koyabilirsin.
- Başka kanalların ekran görüntülerini repoya koyma; `marka/style-refs/` klasörü yalnızca sende kalsın.

## Lisans

Bu repodaki kod ve dokümanlar **MIT** lisanslıdır (`LICENSE`): kullan, değiştir, paylaş.

Kurulan paketler kendi lisanslarıyla gelir; repoya kopyalanmaz, `npm install` ile senin bilgisayarına iner:

- **Remotion**: bireyler ve en fazla 3 çalışanlı şirketler için ücretsiz. Daha büyük şirketler için ücretli
  "Company License" gerekir: https://www.remotion.dev/license
- React, zod, Tailwind (MIT) · d3-geo, topojson, world-atlas (ISC) · Google Fonts (OFL) · whisper.cpp (MIT):
  serbest.
- FFmpeg'i kendin kurarsın; ürettiğin videolar sana aittir.
- Videonda kullandığın müzik ve görsellerin hakları senin sorumluluğunda.
