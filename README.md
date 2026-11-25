# PLC Sahada – Ladder Eğitimi

Tarayıcıda çalışan ladder simülatörü ve sahadan örneklerle PLC yazıları.

## Klasörler
- `index.html` – ana sayfa (yazı listesi)
- `sim/index.html` – simülatör. `sim/#ornek-1`, `#ornek-2`, `#ornek-3`, `#bos` linkleri ilgili programı açar
- `yazilar/` – her yazı ayrı bir HTML sayfası
- `assets/` – ortak stil ve görseller

## Yayınlama (GitHub Pages)
1. GitHub'da `plc-egitim` adında herkese açık bir depo oluştur.
2. Bu klasördeki her şeyi depoya yükle (Add file → Upload files, klasörlerle birlikte sürükle-bırak).
3. Settings → Pages → Source: "Deploy from a branch", Branch: `main`, klasör: `/ (root)` → Save.
4. 1-2 dakika sonra site `https://hasanmirzakilinc.github.io/plc-egitim/` adresinde açılır.

## Yeni yazı eklemek
`yazilar/01-start-stop-muhurleme.html` dosyasını kopyala, adını `02-...html` yap, içeriği değiştir.
Ana sayfadaki ilgili "yakında" kartını link (`<a class="card live" ...>`) hâline getir.

Simülatör Claude ile birlikte geliştirildi.
